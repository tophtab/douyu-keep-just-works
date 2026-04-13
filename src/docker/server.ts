import crypto from 'node:crypto'
import express from 'express'
import type { CollectGiftConfig, DockerConfig, DoubleCardConfig, FanStatus, Fans, JobConfig } from '../core/types'
import type { LogEntry } from './logger'
import { getNextCronRuns, validateCronExpression } from './cron'
import { DOCKER_WEBUI_PAGE_ROUTES, getHtml } from './html'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export interface JobStatus {
  running: boolean
  lastRun: string | null
  nextRun: string | null
}

export interface AppContext {
  webPassword: string
  getConfig(): DockerConfig | null
  saveCookie(cookie: string): void
  saveTaskConfig(config: {
    collectGift?: CollectGiftConfig | null
    keepalive?: JobConfig | null
    doubleCard?: DoubleCardConfig | null
    ui?: DockerConfig['ui']
  }): Promise<{ config: DockerConfig; fans: Fans[] }>
  syncWithFans(): Promise<{ config: DockerConfig; fans: Fans[] }>
  getStatus(): { collectGift: JobStatus; keepalive: JobStatus; doubleCard: JobStatus }
  getLogs(): LogEntry[]
  clearLogs(): void
  triggerCollectGift(): Promise<void>
  triggerKeepalive(): Promise<void>
  triggerDoubleCard(): Promise<void>
  fetchFans(cookie: string): Promise<Fans[]>
  fetchFansStatus(cookie: string): Promise<FanStatus[]>
}

const AUTH_COOKIE_NAME = 'dykw_session'
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const DOCKER_WEBUI_PAGE_PATHS = new Set<string>(Object.values(DOCKER_WEBUI_PAGE_ROUTES))

function isTaskActive(config: { active?: boolean } | null | undefined): boolean {
  return Boolean(config && config.active !== false)
}

function normalizePagePath(path: string): string {
  if (!path || path === '/') {
    return '/'
  }
  return path.replace(/\/+$/, '') || '/'
}

function isDockerWebUiPagePath(path: string): boolean {
  return DOCKER_WEBUI_PAGE_PATHS.has(normalizePagePath(path))
}

function maskCookie(cookie: string): string {
  if (cookie.length <= 20) {
    return '***'
  }
  return `${cookie.substring(0, 10)}...${cookie.substring(cookie.length - 10)}`
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

export function createServer(ctx: AppContext): express.Express {
  const app = express()
  const sessions = new Map<string, number>()

  app.use(express.json())

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

  function summarizeConfig(config: DockerConfig | null) {
    return {
      cookieSaved: Boolean(config?.cookie),
      collectGiftConfigured: isTaskActive(config?.collectGift),
      keepaliveConfigured: isTaskActive(config?.keepalive),
      doubleCardConfigured: isTaskActive(config?.doubleCard),
      keepaliveRooms: Object.keys(config?.keepalive?.send || {}).length,
      doubleCardRooms: Object.keys(config?.doubleCard?.send || {}).length,
    }
  }

  function validateCronConfig(name: string, config: { cron: string }): string | null {
    if ('active' in config && config.active !== undefined && typeof (config as { active?: unknown }).active !== 'boolean') {
      return `${name} 启用状态无效`
    }
    return validateCronExpression(name, config.cron)
  }

  function validateJobConfig(name: string, config: JobConfig): string | null {
    const cronError = validateCronConfig(name, config)
    if (cronError) {
      return cronError
    }
    if (config.model !== 1 && config.model !== 2) {
      return `${name} 分配模式无效`
    }
    if (!config.send || typeof config.send !== 'object') {
      return `${name} 房间配置无效`
    }

    if (config.model === 1) {
      for (const [key, item] of Object.entries(config.send)) {
        if (!Number.isFinite(item.weight) || item.weight < 0) {
          return `${name} 房间 ${key} 的权重值无效`
        }
      }
    } else {
      const remainderRooms = Object.entries(config.send)
        .filter(([, item]) => item.number === -1)
        .map(([key]) => key)

      for (const [key, item] of Object.entries(config.send)) {
        if (!Number.isFinite(item.number) || item.number < -1) {
          return `${name} 房间 ${key} 的数量无效`
        }
      }

      if (remainderRooms.length > 1) {
        return `${name} 固定数量模式最多只能有一个房间配置为-1`
      }
    }

    return null
  }

  function validateDoubleCardConfig(config: DoubleCardConfig): string | null {
    const error = validateJobConfig('doubleCard', config)
    if (error) {
      return error
    }
    if (config.enabled !== undefined && (typeof config.enabled !== 'object' || Array.isArray(config.enabled))) {
      return 'doubleCard 勾选配置无效'
    }

    const enabledKeys = Object.entries(config.enabled || {})
      .filter(([, enabled]) => Boolean(enabled))
      .map(([key]) => key)
    if (config.model === 1 && enabledKeys.length > 0) {
      const totalWeight = enabledKeys.reduce((sum, key) => sum + (config.send?.[key]?.weight || 0), 0)
      if (totalWeight <= 0) {
        return 'doubleCard 按权重模式至少需要一个已勾选房间填写大于 0 的权重值'
      }
    }

    return null
  }

  app.get('*', (req, res, next) => {
    if (!isDockerWebUiPagePath(req.path)) {
      next()
      return
    }
    res.type('html').send(getHtml())
  })

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

  app.use((req, res, next) => {
    if (
      isDockerWebUiPagePath(req.path)
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

  app.get('/api/config', (_req, res) => {
    const config = ctx.getConfig()
    if (!config) {
      return res.json({ exists: false })
    }
    res.json({
      exists: true,
      data: { ...config, cookie: maskCookie(config.cookie) },
    })
  })

  app.get('/api/config/raw', (_req, res) => {
    const config = ctx.getConfig()
    if (!config) {
      return res.json({ exists: false })
    }
    res.json({ exists: true, data: config })
  })

  app.get('/api/overview', (_req, res) => {
    const config = ctx.getConfig()
    const status = ctx.getStatus()
    const recentLogs = ctx.getLogs().slice(-10)
    res.json({
      ...summarizeConfig(config),
      timezone: 'Asia/Shanghai',
      ready: Boolean(config?.cookie && (
        isTaskActive(config?.collectGift)
        || isTaskActive(config?.keepalive)
        || isTaskActive(config?.doubleCard)
      )),
      status,
      recentLogs,
    })
  })

  app.post('/api/cookie', (req, res) => {
    try {
      const cookie = String(req.body?.cookie || '').trim()
      if (!cookie) {
        return res.status(400).json({ error: '缺少 cookie' })
      }
      ctx.saveCookie(cookie)
      res.json({ ok: true })
    } catch (e: unknown) {
      res.status(500).json({ error: errorMessage(e) })
    }
  })

  app.post('/api/config', (req, res) => {
    try {
      const payload = req.body as Partial<DockerConfig>
      if (payload.collectGift) {
        const error = validateCronConfig('collectGift', payload.collectGift)
        if (error) {
          return res.status(400).json({ error })
        }
      }
      if (payload.keepalive) {
        const error = validateJobConfig('keepalive', payload.keepalive)
        if (error) {
          return res.status(400).json({ error })
        }
      }
      if (payload.doubleCard) {
        const error = validateDoubleCardConfig(payload.doubleCard)
        if (error) {
          return res.status(400).json({ error })
        }
      }
      if (payload.ui && typeof payload.ui !== 'object') {
        return res.status(400).json({ error: 'ui 配置无效' })
      }
      ctx.saveTaskConfig({
        collectGift: payload.collectGift,
        keepalive: payload.keepalive,
        doubleCard: payload.doubleCard,
        ui: payload.ui,
      }).then((result) => {
        res.json({ ok: true, data: result })
      }).catch((e: unknown) => {
        res.status(500).json({ error: errorMessage(e) })
      })
    } catch (e: unknown) {
      res.status(500).json({ error: errorMessage(e) })
    }
  })

  app.post('/api/fans/reconcile', async (_req, res) => {
    try {
      const result = await ctx.syncWithFans()
      res.json(result)
    } catch (e: unknown) {
      const message = errorMessage(e)
      if (message === '请先配置 cookie') {
        return res.status(400).json({ error: message })
      }
      res.status(500).json({ error: message })
    }
  })

  app.get('/api/status', (_req, res) => {
    res.json(ctx.getStatus())
  })

  app.get('/api/cron-preview', (req, res) => {
    const cron = String(req.query.value || '').trim()
    const error = validateCronExpression('cron 表达式', cron)
    if (error) {
      return res.status(400).json({ error })
    }
    res.json({ runs: getNextCronRuns(cron) })
  })

  app.get('/api/logs', (_req, res) => {
    res.json(ctx.getLogs())
  })

  app.delete('/api/logs', (_req, res) => {
    ctx.clearLogs()
    res.json({ ok: true })
  })

  app.get('/api/fans', async (_req, res) => {
    const config = ctx.getConfig()
    if (!config?.cookie) {
      return res.status(400).json({ error: '请先配置 cookie' })
    }
    try {
      const fans = await ctx.fetchFans(config.cookie)
      res.json(fans)
    } catch (e: unknown) {
      res.status(500).json({ error: errorMessage(e) })
    }
  })

  app.get('/api/fans/status', async (_req, res) => {
    const config = ctx.getConfig()
    if (!config?.cookie) {
      return res.status(400).json({ error: '请先配置 cookie' })
    }
    try {
      const fans = await ctx.fetchFansStatus(config.cookie)
      res.json(fans)
    } catch (e: unknown) {
      res.status(500).json({ error: errorMessage(e) })
    }
  })

  app.post('/api/trigger/:type', async (req, res) => {
    const { type } = req.params
    try {
      if (type === 'collectGift') {
        await ctx.triggerCollectGift()
      } else if (type === 'keepalive') {
        await ctx.triggerKeepalive()
      } else if (type === 'doubleCard') {
        await ctx.triggerDoubleCard()
      } else {
        return res.status(400).json({ error: '未知任务类型' })
      }
      res.json({ ok: true })
    } catch (e: unknown) {
      const message = errorMessage(e)
      if (
        message === '请先配置 cookie'
        || message.endsWith('未配置')
        || message === '任务正在执行中，请稍后再试'
      ) {
        return res.status(400).json({ error: message })
      }
      res.status(500).json({ error: message })
    }
  })

  return app
}
