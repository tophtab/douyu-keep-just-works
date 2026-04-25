import crypto from 'node:crypto'
import express from 'express'
import { isCookieCloudReady } from '../core/cookie-cloud'
import type { CollectGiftConfig, CookieCloudConfig, CookieDiagnostics, DockerConfig, DoubleCardConfig, EffectiveCookiePreview, Fans, FansStatusResponse, JobConfig, ManualCookieConfig, YubaCheckInConfig, YubaStatusResponse } from '../core/types'
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
  saveCookie(cookies: ManualCookieConfig): void
  saveTaskConfig(config: {
    manualCookies?: ManualCookieConfig
    cookieCloud?: DockerConfig['cookieCloud']
    collectGift?: CollectGiftConfig | null
    keepalive?: JobConfig | null
    doubleCard?: DoubleCardConfig | null
    yubaCheckIn?: YubaCheckInConfig | null
    ui?: DockerConfig['ui']
  }): Promise<{ config: DockerConfig; fans: Fans[] }>
  syncWithFans(): Promise<{ config: DockerConfig; fans: Fans[] }>
  getStatus(): { collectGift: JobStatus; keepalive: JobStatus; doubleCard: JobStatus; yubaCheckIn: JobStatus }
  getLogs(): LogEntry[]
  clearLogs(): void
  inspectCookieSource(forceRefresh?: boolean): Promise<CookieDiagnostics>
  getEffectiveCookies(forceRefresh?: boolean): Promise<EffectiveCookiePreview>
  persistEffectiveCookies(forceRefresh?: boolean): Promise<{
    config: DockerConfig
    effective: EffectiveCookiePreview
    updated: boolean
  }>
  triggerCollectGift(): Promise<void>
  triggerKeepalive(): Promise<void>
  triggerDoubleCard(): Promise<void>
  triggerYubaCheckIn(): Promise<void>
  fetchFans(): Promise<Fans[]>
  fetchFansStatus(): Promise<FansStatusResponse>
  fetchYubaStatus(): Promise<YubaStatusResponse>
}

const AUTH_COOKIE_NAME = 'dykw_session'
const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30
const DOCKER_WEBUI_PAGE_PATHS = new Set<string>(Object.values(DOCKER_WEBUI_PAGE_ROUTES))

function isTaskActive(config: { active?: boolean } | null | undefined): boolean {
  return Boolean(config && config.active !== false)
}

function hasConfiguredCookieSource(config: DockerConfig | null | undefined): boolean {
  return Boolean(
    config?.manualCookies?.main?.trim()
    || config?.manualCookies?.yuba?.trim()
    || config?.cookie?.trim(),
  ) || isCookieCloudReady(config?.cookieCloud)
}

function summarizeCookieSource(config: DockerConfig | null | undefined): string {
  const hasManualCookie = Boolean(
    config?.manualCookies?.main?.trim()
    || config?.manualCookies?.yuba?.trim()
    || config?.cookie?.trim(),
  )
  const hasCookieCloud = isCookieCloudReady(config?.cookieCloud)

  if (hasManualCookie && hasCookieCloud) {
    return 'hybrid'
  }
  if (hasCookieCloud) {
    return 'cookieCloud'
  }
  if (hasManualCookie) {
    return 'manual'
  }
  return 'none'
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

function maskCookieCloud(config: CookieCloudConfig | undefined): CookieCloudConfig | undefined {
  if (!config) {
    return undefined
  }

  return {
    ...config,
    password: config.password ? maskCookie(config.password) : '',
  }
}

function maskManualCookies(config: ManualCookieConfig | undefined): ManualCookieConfig | undefined {
  if (!config) {
    return undefined
  }

  return {
    main: config.main ? maskCookie(config.main) : '',
    yuba: config.yuba ? maskCookie(config.yuba) : '',
  }
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
      cookieSaved: hasConfiguredCookieSource(config),
      cookieSource: summarizeCookieSource(config),
      cookieCloudConfigured: isCookieCloudReady(config?.cookieCloud),
      collectGiftConfigured: isTaskActive(config?.collectGift),
      keepaliveConfigured: isTaskActive(config?.keepalive),
      doubleCardConfigured: isTaskActive(config?.doubleCard),
      yubaCheckInConfigured: isTaskActive(config?.yubaCheckIn),
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

  function validateYubaCheckInConfig(config: YubaCheckInConfig): string | null {
    const cronError = validateCronConfig('yubaCheckIn', config)
    if (cronError) {
      return cronError
    }
    if (config.mode !== undefined && config.mode !== 'followed') {
      return 'yubaCheckIn 模式无效'
    }
    return null
  }

  function validateCookieCloudConfig(config: CookieCloudConfig): string | null {
    if (config.active !== undefined && typeof config.active !== 'boolean') {
      return 'CookieCloud 启用状态无效'
    }
    if (config.cryptoType !== undefined && config.cryptoType !== 'legacy') {
      return 'CookieCloud 加密算法无效'
    }
    if (config.cron !== undefined) {
      const cronError = validateCronConfig('cookieCloud', {
        cron: config.cron,
      })
      if (cronError) {
        return cronError
      }
    }
    if (config.active === true) {
      if (!String(config.endpoint || '').trim()) {
        return 'CookieCloud endpoint 不能为空'
      }
      if (!String(config.uuid || '').trim()) {
        return 'CookieCloud UUID 不能为空'
      }
      if (!String(config.password || '').trim()) {
        return 'CookieCloud 密码不能为空'
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
      data: {
        ...config,
        cookie: maskCookie(config.cookie),
        manualCookies: maskManualCookies(config.manualCookies),
        cookieCloud: maskCookieCloud(config.cookieCloud),
      },
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
      ready: Boolean(hasConfiguredCookieSource(config) && (
        isTaskActive(config?.collectGift)
        || isTaskActive(config?.keepalive)
        || isTaskActive(config?.doubleCard)
        || isTaskActive(config?.yubaCheckIn)
      )),
      status,
      recentLogs,
    })
  })

  app.post('/api/cookie', (req, res) => {
    try {
      const mainCookie = String(req.body?.mainCookie ?? req.body?.cookie ?? '').trim()
      const yubaCookie = String(req.body?.yubaCookie || '').trim()
      if (!mainCookie && !yubaCookie) {
        return res.status(400).json({ error: '缺少 cookie' })
      }
      ctx.saveCookie({ main: mainCookie, yuba: yubaCookie })
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
      if (payload.yubaCheckIn) {
        const error = validateYubaCheckInConfig(payload.yubaCheckIn)
        if (error) {
          return res.status(400).json({ error })
        }
      }
      if (payload.manualCookies) {
        if (typeof payload.manualCookies !== 'object' || Array.isArray(payload.manualCookies)) {
          return res.status(400).json({ error: 'manualCookies 配置无效' })
        }
      }
      if (payload.cookieCloud) {
        const error = validateCookieCloudConfig(payload.cookieCloud)
        if (error) {
          return res.status(400).json({ error })
        }
      }
      if (payload.ui && typeof payload.ui !== 'object') {
        return res.status(400).json({ error: 'ui 配置无效' })
      }
      ctx.saveTaskConfig({
        manualCookies: payload.manualCookies,
        cookieCloud: payload.cookieCloud,
        collectGift: payload.collectGift,
        keepalive: payload.keepalive,
        doubleCard: payload.doubleCard,
        yubaCheckIn: payload.yubaCheckIn,
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
    try {
      const fans = await ctx.fetchFans()
      res.json(fans)
    } catch (e: unknown) {
      const message = errorMessage(e)
      if (message === '请先配置 cookie') {
        return res.status(400).json({ error: message })
      }
      res.status(500).json({ error: message })
    }
  })

  app.get('/api/fans/status', async (_req, res) => {
    try {
      const fansStatus = await ctx.fetchFansStatus()
      res.json(fansStatus)
    } catch (e: unknown) {
      const message = errorMessage(e)
      if (message === '请先配置 cookie') {
        return res.status(400).json({ error: message })
      }
      res.status(500).json({ error: message })
    }
  })

  app.get('/api/yuba/status', async (_req, res) => {
    try {
      const yubaStatus = await ctx.fetchYubaStatus()
      res.json(yubaStatus)
    } catch (e: unknown) {
      const message = errorMessage(e)
      if (message === '请先配置 cookie') {
        return res.status(400).json({ error: message })
      }
      res.status(500).json({ error: message })
    }
  })

  app.post('/api/cookie-source/check', async (_req, res) => {
    try {
      const result = await ctx.inspectCookieSource(true)
      res.json(result)
    } catch (e: unknown) {
      const message = errorMessage(e)
      if (message === '请先配置 cookie' || message.includes('配置不完整')) {
        return res.status(400).json({ error: message })
      }
      res.status(500).json({ error: message })
    }
  })

  app.get('/api/cookie-source/effective', async (_req, res) => {
    try {
      const result = await ctx.getEffectiveCookies(true)
      res.json(result)
    } catch (e: unknown) {
      const message = errorMessage(e)
      if (message === '请先配置 cookie' || message.includes('配置不完整')) {
        return res.status(400).json({ error: message })
      }
      res.status(500).json({ error: message })
    }
  })

  app.post('/api/cookie-source/persist', async (_req, res) => {
    try {
      if (!isCookieCloudReady(ctx.getConfig()?.cookieCloud)) {
        return res.status(400).json({ error: 'CookieCloud 未启用' })
      }

      const result = await ctx.persistEffectiveCookies(true)
      res.json({ ok: true, data: result })
    } catch (e: unknown) {
      const message = errorMessage(e)
      if (message === '请先配置 cookie' || message.includes('配置不完整')) {
        return res.status(400).json({ error: message })
      }
      res.status(500).json({ error: message })
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
      } else if (type === 'yubaCheckIn') {
        await ctx.triggerYubaCheckIn()
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
