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

export function createAuthHandlers(ctx: AppContext): AuthHandlers {
  const sessions = new Map<string, number>()

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

  function registerAuthRoutes(app: express.Express): void {
    app.get('/api/auth/status', (req, res) => {
      res.json({ authenticated: isAuthenticated(req) })
    })

    app.post('/api/auth/login', (req, res) => {
      const password = typeof req.body?.password === 'string' ? req.body.password : ''
      if (!password) {
        return res.status(400).json({ error: '请输入密码' })
      }
      if (password !== ctx.webPassword) {
        return res.status(400).json({ error: '密码错误' })
      }

      issueSession(res)
      res.json({ ok: true })
    })

    app.post('/api/auth/logout', (req, res) => {
      clearSession(req, res)
      res.json({ ok: true })
    })
  }

  function registerProtectedBoundary(app: express.Express, isPublicPagePath: (path: string) => boolean): void {
    app.use((req, res, next) => {
      if (
        isPublicPagePath(req.path)
        || req.path === '/api/auth/status'
        || req.path === '/api/auth/login'
        || req.path === '/api/auth/logout'
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
