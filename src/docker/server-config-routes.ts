import type express from 'express'
import { isCookieCloudReady } from '../core/cookie-cloud'
import type { DockerConfig } from '../core/types'
import type { DockerConfigUpdate } from './config-store'
import { getNextCronRuns, validateCronExpression } from './cron'
import { validateCookieCloudConfig } from './config-validation'
import { sendJsonOk } from './server-route-utils'
import type { AppContext } from './server-types'
import { getTaskOverviewSummary, hasEnabledTaskConfig, TASK_TYPES, validateTaskConfig } from './task-metadata'

function hasConfiguredCookieSource(config: DockerConfig | null | undefined): boolean {
  return Boolean(
    config?.loginCookies.main.trim()
    || config?.loginCookies.yuba.trim(),
  ) || isCookieCloudReady(config?.cookieCloud)
}

function summarizeCookieSource(config: DockerConfig | null | undefined): string {
  const hasLocalCookie = Boolean(
    config?.loginCookies.main.trim()
    || config?.loginCookies.yuba.trim(),
  )
  const hasCookieCloud = isCookieCloudReady(config?.cookieCloud)

  if (hasLocalCookie && hasCookieCloud) {
    return 'hybrid'
  }
  if (hasCookieCloud) {
    return 'cookieCloud'
  }
  if (hasLocalCookie) {
    return 'local'
  }
  return 'none'
}

function summarizeConfig(config: DockerConfig | null) {
  return {
    cookieSaved: hasConfiguredCookieSource(config),
    cookieSource: summarizeCookieSource(config),
    cookieCloudConfigured: isCookieCloudReady(config?.cookieCloud),
    passportConfigured: Boolean(config?.loginCookies.passport.trim()),
    ...getTaskOverviewSummary(config),
  }
}

function validateConfigPayload(payload: DockerConfigUpdate): string | null {
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
  if (payload.loginCookies && (typeof payload.loginCookies !== 'object' || Array.isArray(payload.loginCookies))) {
    return 'loginCookies 配置无效'
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
      data: config,
    })
  })

  app.get('/api/overview', (_req, res) => {
    const config = ctx.getConfig()
    const status = ctx.getStatus()
    const recentLogs = ctx.getLogs().slice(-10)
    res.json({
      ...summarizeConfig(config),
      timezone: 'Asia/Shanghai',
      ready: Boolean(hasConfiguredCookieSource(config) && hasEnabledTaskConfig(config)),
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
    const payload = req.body as DockerConfigUpdate
    const validationError = validateConfigPayload(payload)
    if (validationError) {
      return res.status(400).json({ error: validationError })
    }

    await sendJsonOk(
      res,
      () => ctx.saveTaskConfig(payload),
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
