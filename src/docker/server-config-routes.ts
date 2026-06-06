import type express from 'express'
import { isCookieCloudReady } from '../core/cookie-cloud'
import type { CookieCloudConfig, DockerConfig, ManualCookieConfig, ManualPassportConfig } from '../core/types'
import { getNextCronRuns, validateCronExpression } from './cron'
import { validateCookieCloudConfig } from './config-validation'
import { sendJsonOk } from './server-route-utils'
import type { AppContext } from './server-types'
import { collectTaskUpdatePayload, getTaskOverviewSummary, hasActiveTaskConfig, TASK_TYPES, validateTaskConfig } from './task-metadata'

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

function maskManualPassport(config: ManualPassportConfig | undefined): ManualPassportConfig | undefined {
  if (!config) {
    return undefined
  }

  return {
    cookie: config.cookie ? maskCookie(config.cookie) : '',
  }
}

function maskConfigManualPassport<T extends { config: DockerConfig }>(result: T): T {
  return {
    ...result,
    config: {
      ...result.config,
      manualPassport: maskManualPassport(result.config.manualPassport),
    },
  }
}

function summarizeConfig(config: DockerConfig | null) {
  return {
    cookieSaved: hasConfiguredCookieSource(config),
    cookieSource: summarizeCookieSource(config),
    cookieCloudConfigured: isCookieCloudReady(config?.cookieCloud),
    manualPassportConfigured: Boolean(config?.manualPassport?.cookie?.trim()),
    ...getTaskOverviewSummary(config),
  }
}

function validateConfigPayload(payload: Partial<DockerConfig>): string | null {
  for (const type of TASK_TYPES) {
    const taskConfig = payload[type]
    if (!taskConfig) {
      continue
    }
    const error = validateTaskConfig(type, taskConfig)
    if (error) {
      return error
    }
  }
  if (payload.manualCookies && (typeof payload.manualCookies !== 'object' || Array.isArray(payload.manualCookies))) {
    return 'manualCookies 配置无效'
  }
  if (payload.manualPassport && (typeof payload.manualPassport !== 'object' || Array.isArray(payload.manualPassport))) {
    return 'manualPassport 配置无效'
  }
  if (payload.cookieCloud) {
    const error = validateCookieCloudConfig(payload.cookieCloud)
    if (error) {
      return error
    }
  }
  if (payload.ui && typeof payload.ui !== 'object') {
    return 'ui 配置无效'
  }
  return null
}

function resolveConfigRouteErrorStatus(): number {
  return 500
}

export function registerConfigRoutes(app: express.Express, ctx: AppContext): void {
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
        manualPassport: maskManualPassport(config.manualPassport),
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
      ready: Boolean(hasConfiguredCookieSource(config) && hasActiveTaskConfig(config)),
      status,
      recentLogs,
    })
  })

  app.post('/api/cookie', async (req, res) => {
    const mainCookie = String(req.body?.mainCookie ?? req.body?.cookie ?? '').trim()
    const yubaCookie = String(req.body?.yubaCookie || '').trim()
    if (!mainCookie && !yubaCookie) {
      return res.status(400).json({ error: '缺少 cookie' })
    }

    await sendJsonOk(res, () => ctx.saveCookie({ main: mainCookie, yuba: yubaCookie }), resolveConfigRouteErrorStatus)
  })

  app.post('/api/config', async (req, res) => {
    const payload = req.body as Partial<DockerConfig>
    const validationError = validateConfigPayload(payload)
    if (validationError) {
      return res.status(400).json({ error: validationError })
    }

    await sendJsonOk(
      res,
      async () => maskConfigManualPassport(await ctx.saveTaskConfig({
        manualCookies: payload.manualCookies,
        manualPassport: payload.manualPassport,
        cookieCloud: payload.cookieCloud,
        ...collectTaskUpdatePayload(payload),
        ui: payload.ui,
      })),
      resolveConfigRouteErrorStatus,
    )
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
}
