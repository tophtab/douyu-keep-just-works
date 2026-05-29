import type express from 'express'
import { isCookieCredentialMessage } from './server-errors'
import { sendJsonResult } from './server-route-utils'
import type { AppContext } from './server-types'

function resolveFansErrorStatus(message: string): number {
  return isCookieCredentialMessage(message) ? 400 : 500
}

export function registerFansRoutes(app: express.Express, ctx: AppContext): void {
  app.post('/api/fans/reconcile', async (_req, res) => {
    await sendJsonResult(res, () => ctx.syncWithFans(), resolveFansErrorStatus)
  })

  app.get('/api/fans', async (_req, res) => {
    await sendJsonResult(res, () => ctx.fetchFans(), resolveFansErrorStatus)
  })

  app.get('/api/fans/status/base', async (_req, res) => {
    await sendJsonResult(res, () => ctx.fetchFansStatusBase(), resolveFansErrorStatus)
  })

  app.get('/api/fans/status/details', async (_req, res) => {
    await sendJsonResult(res, () => ctx.fetchFansStatusDetails(), resolveFansErrorStatus)
  })

  app.get('/api/fans/status', async (_req, res) => {
    await sendJsonResult(res, () => ctx.fetchFansStatus(), resolveFansErrorStatus)
  })

  app.get('/api/yuba/status', async (_req, res) => {
    await sendJsonResult(res, () => ctx.fetchYubaStatus(), resolveFansErrorStatus)
  })
}
