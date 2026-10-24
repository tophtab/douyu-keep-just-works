import crypto from 'node:crypto'
import type express from 'express'
import type { AppContext } from './server-types'

const AUTH_COOKIE_NAME = 'dykw_session'
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

export interface AuthHandlers {
  isAuthenticated(req: express.Request): boolean
  registerAuthRoutes(app: express.Express): void
  registerProtectedBoundary(app: express.Express, isPublicPagePath: (path: string) => boolean): void
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) {
    return {}
  }

  return cookieHeader.split(';').reduce((acc, chunk) => {
    const [name, ...rest] = chunk.split('=')
    const key = name?.trim()
    if (!key) {
      return acc
    }

    acc[key] = decodeURIComponent(rest.join('=').trim())
    return acc
  }, {} as Record<string, string>)
}

function serializeCookie(name: string, value: string, options: {
  maxAge?: number
  httpOnly?: boolean
  sameSite?: 'Strict' | 'Lax'
} = {}): string {
  const segments = [`${name}=${encodeURIComponent(value)}`, 'Path=/']

  if (typeof options.maxAge === 'number') {
    segments.push(`Max-Age=${options.maxAge}`)
  }
  if (options.httpOnly !== false) {
    segments.push('HttpOnly')
  }
  if (options.sameSite) {
    segments.push(`SameSite=${options.sameSite}`)
  }

  return segments.join('; ')
}

const LOGIN_FAIL_WINDOW_MS = 5 * 60 * 1000
const LOGIN_FAIL_LIMIT = 5
const LOGIN_LOCK_MS = 60 * 1000

export function createAuthHandlers(ctx: AppContext): AuthHandlers {
  const sessions = new Map<string, number>()
  // 简单的暴力破解防护：同一 IP 5 分钟内失败 5 次，锁 60 秒
  const loginFailures = new Map<string, { count: number, firstAt: number, lockedUntil: number }>()

  function cleanupExpiredSessions(): void {
    const now = Date.now()
    for (const [token, expiresAt] of sessions.entries()) {
      if (expiresAt <= now) {
        sessions.delete(token)
      }
    }
  }

  function getSessionToken(req: express.Request): string | null {
    const cookies = parseCookies(req.headers.cookie)
    const token = cookies[AUTH_COOKIE_NAME]
    return token || null
  }

  function isAuthenticated(req: express.Request): boolean {
    cleanupExpiredSessions()
    const token = getSessionToken(req)
    if (!token) {
      return false
    }

    const expiresAt = sessions.get(token)
    if (!expiresAt || expiresAt <= Date.now()) {
      sessions.delete(token)
      return false
    }

    return true
  }

  function issueSession(res: express.Response): void {
    const token = crypto.randomBytes(24).toString('hex')
    sessions.set(token, Date.now() + (AUTH_COOKIE_MAX_AGE_SECONDS * 1000))
    res.setHeader('Set-Cookie', serializeCookie(AUTH_COOKIE_NAME, token, {
      maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
      sameSite: 'Strict',
    }))
  }

  function clearSession(req: express.Request, res: express.Response): void {
    const token = getSessionToken(req)
    if (token) {
      sessions.delete(token)
    }
    res.setHeader('Set-Cookie', serializeCookie(AUTH_COOKIE_NAME, '', {
      maxAge: 0,
      sameSite: 'Strict',
    }))
  }

  function clientKey(req: express.Request): string {
    return req.ip || req.socket?.remoteAddress || 'unknown'
  }

  function checkLoginThrottle(req: express.Request): string | null {
    const key = clientKey(req)
    const entry = loginFailures.get(key)
    if (!entry) {
      return null
    }
    const now = Date.now()
    if (entry.lockedUntil > now) {
      const seconds = Math.ceil((entry.lockedUntil - now) / 1000)
      return `密码错误次数过多，请 ${seconds} 秒后再试`
    }
    if (now - entry.firstAt > LOGIN_FAIL_WINDOW_MS) {
      loginFailures.delete(key)
    }
    return null
  }

  function recordLoginFailure(req: express.Request): void {
    const key = clientKey(req)
    const now = Date.now()
    const entry = loginFailures.get(key)
    if (!entry || now - entry.firstAt > LOGIN_FAIL_WINDOW_MS) {
      loginFailures.set(key, { count: 1, firstAt: now, lockedUntil: 0 })
      return
    }
    entry.count += 1
    if (entry.count >= LOGIN_FAIL_LIMIT) {
      entry.lockedUntil = now + LOGIN_LOCK_MS
      entry.count = 0
      entry.firstAt = now
    }
  }

  function clearLoginFailures(req: express.Request): void {
    loginFailures.delete(clientKey(req))
  }

  function registerAuthRoutes(app: express.Express): void {
    app.get('/api/auth/status', (req, res) => {
      res.json({ authenticated: isAuthenticated(req) })
    })

    app.post('/api/auth/login', (req, res) => {
      const password = typeof req.body?.password === 'string' ? req.body.password : ''
      if (!password) {
        return res.status(400).json({ error: '请输入密码' })
      }

      const throttled = checkLoginThrottle(req)
      if (throttled) {
        return res.status(429).json({ error: throttled })
      }

      if (!ctx.passwordStore.verify(password)) {
        recordLoginFailure(req)
        return res.status(400).json({ error: '密码错误' })
      }

      clearLoginFailures(req)
      issueSession(res)
      res.json({ ok: true })
    })

    app.post('/api/auth/logout', (req, res) => {
      clearSession(req, res)
      res.json({ ok: true })
    })

    // 登录页展示的密码提示（未登录可读，只返回提示文本）
    app.get('/api/auth/hint', (_req, res) => {
      res.json({ hint: ctx.passwordStore.hint() })
    })

    // 当前密码来源（是否自定义过、更新时间），不含任何密码内容
    app.get('/api/auth/password-info', (req, res) => {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: '请先登录' })
      }
      res.json(ctx.passwordStore.info())
    })

    // 设置密码提示（需登录）；空串表示清除
    app.post('/api/auth/hint', (req, res) => {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: '请先登录' })
      }
      const hint = typeof req.body?.hint === 'string' ? req.body.hint : ''
      const result = ctx.passwordStore.setHint(hint)
      if (!result.ok) {
        return res.status(400).json({ error: result.error || '保存失败' })
      }
      res.json({ ok: true, hint: result.hint || '' })
    })

    // 修改密码：校验旧密码 → 写 scrypt 哈希 → 注销其他会话，当前会话换新
    app.post('/api/auth/password', (req, res) => {
      if (!isAuthenticated(req)) {
        return res.status(401).json({ error: '请先登录' })
      }

      const currentPassword = typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : ''
      const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : ''
      if (!currentPassword || !newPassword) {
        return res.status(400).json({ error: '请填写当前密码和新密码' })
      }

      const throttled = checkLoginThrottle(req)
      if (throttled) {
        return res.status(429).json({ error: throttled })
      }

      const result = ctx.passwordStore.change(currentPassword, newPassword)
      if (!result.ok) {
        recordLoginFailure(req)
        return res.status(400).json({ error: result.error || '修改失败' })
      }

      clearLoginFailures(req)
      // 改密后所有旧会话失效，给当前请求换一个新会话，避免自己被踢下线
      sessions.clear()
      issueSession(res)
      res.json({ ok: true, info: ctx.passwordStore.info() })
    })
  }

  function registerProtectedBoundary(app: express.Express, isPublicPagePath: (path: string) => boolean): void {
    app.use((req, res, next) => {
      if (
        isPublicPagePath(req.path)
        || req.path === '/api/auth/status'
        || req.path === '/api/auth/login'
        || req.path === '/api/auth/logout'
        || (req.path === '/api/auth/hint' && req.method === 'GET')
      ) {
        next()
        return
      }

      if (isAuthenticated(req)) {
        next()
        return
      }

      if (req.path.startsWith('/api/')) {
        res.status(401).json({ error: '请先登录' })
        return
      }

      res.redirect('/')
    })
  }

  return {
    isAuthenticated,
    registerAuthRoutes,
    registerProtectedBoundary,
  }
}
