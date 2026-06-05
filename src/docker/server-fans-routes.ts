import type express from 'express'
import { isCookieCredentialMessage } from './server-errors'
import { sendJsonResult } from './server-route-utils'
import type { AppContext, CacheRefreshOptions } from './server-types'

function resolveFansErrorStatus(message: string): number {
  return isCookieCredentialMessage(message) ? 400 : 500
}

function isForceRefreshValue(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.some(isForceRefreshValue)
  }
  return value === '1' || value === 'true'
}

function getCacheRefreshOptions(req: express.Request): CacheRefreshOptions {
  return {
    forceRefresh: isForceRefreshValue(req.query.force),
  }
}

export function registerFansRoutes(app: express.Express, ctx: AppContext): void {
  app.post('/api/fans/reconcile', async (_req, res) => {
    await sendJsonResult(res, () => ctx.syncWithFans(), resolveFansErrorStatus)
  })

  app.get('/api/fans', async (req, res) => {
    await sendJsonResult(res, () => ctx.fetchFans(getCacheRefreshOptions(req)), resolveFansErrorStatus)
  })

  app.get('/api/fans/status/base', async (req, res) => {
    await sendJsonResult(res, () => ctx.fetchFansStatusBase(getCacheRefreshOptions(req)), resolveFansErrorStatus)
  })

  app.get('/api/fans/status/details', async (req, res) => {
    await sendJsonResult(res, () => ctx.fetchFansStatusDetails(getCacheRefreshOptions(req)), resolveFansErrorStatus)
  })

  app.get('/api/fans/status', async (req, res) => {
    await sendJsonResult(res, () => ctx.fetchFansStatus(getCacheRefreshOptions(req)), resolveFansErrorStatus)
  })

  app.get('/api/yuba/status', async (req, res) => {
    await sendJsonResult(res, () => ctx.fetchYubaStatus(getCacheRefreshOptions(req)), resolveFansErrorStatus)
  })
}
