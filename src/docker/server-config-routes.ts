import type express from 'express'
import { isCookieCloudReady } from '../core/cookie-cloud'
import type { DockerConfig } from '../core/types'
import { hasConfiguredCookieSource, maskCookie, maskCookieCloud, maskManualCookies, maskManualPassport, summarizeCookieSource } from './cookie-source-summary'
import { getNextCronRuns, validateCronExpression } from './cron'
import { validateCookieCloudConfig, validateCronConfig, validateDoubleCardConfig, validateExpiringGiftConfig, validateJobConfig, validateYubaCheckInConfig } from './config-validation'
import { sendJsonOk } from './server-route-utils'
import type { AppContext } from './server-types'
import { hasActiveTaskConfig, isTaskActive } from './task-metadata'

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
    collectGiftConfigured: isTaskActive(config?.collectGift),
    keepaliveConfigured: isTaskActive(config?.keepalive),
    doubleCardConfigured: isTaskActive(config?.doubleCard),
    expiringGiftConfigured: isTaskActive(config?.expiringGift),
    yubaCheckInConfigured: isTaskActive(config?.yubaCheckIn),
    keepaliveRooms: Object.keys(config?.keepalive?.send || {}).length,
    doubleCardRooms: Object.keys(config?.doubleCard?.send || {}).length,
    expiringGiftRooms: Object.keys(config?.expiringGift?.send || {}).length,
  }
}

function validateConfigPayload(payload: Partial<DockerConfig>): string | null {
  if (payload.collectGift) {
    const error = validateCronConfig('collectGift', payload.collectGift)
    if (error) {
      return error
    }
  }
  if (payload.keepalive) {
    const error = validateJobConfig('keepalive', payload.keepalive)
    if (error) {
      return error
    }
  }
  if (payload.doubleCard) {
    const error = validateDoubleCardConfig(payload.doubleCard)
    if (error) {
      return error
    }
  }
  if (payload.expiringGift) {
    const error = validateExpiringGiftConfig(payload.expiringGift)
    if (error) {
      return error
    }
  }
  if (payload.yubaCheckIn) {
    const error = validateYubaCheckInConfig(payload.yubaCheckIn)
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
        collectGift: payload.collectGift,
        keepalive: payload.keepalive,
        doubleCard: payload.doubleCard,
        expiringGift: payload.expiringGift,
        yubaCheckIn: payload.yubaCheckIn,
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
