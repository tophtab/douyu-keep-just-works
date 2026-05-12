import type express from 'express'
import { errorMessage, isMissingCookieMessage } from './server-errors'
import type { AppContext } from './server-types'

function sendFansError(res: express.Response, error: unknown): void {
  const message = errorMessage(error)
  if (isMissingCookieMessage(message)) {
    res.status(400).json({ error: message })
    return
  }
  res.status(500).json({ error: message })
}

export function registerFansRoutes(app: express.Express, ctx: AppContext): void {
  app.post('/api/fans/reconcile', async (_req, res) => {
    try {
      const result = await ctx.syncWithFans()
      res.json(result)
    } catch (e: unknown) {
      sendFansError(res, e)
    }
  })

  app.get('/api/fans', async (_req, res) => {
    try {
      const fans = await ctx.fetchFans()
      res.json(fans)
    } catch (e: unknown) {
      sendFansError(res, e)
    }
  })

  app.get('/api/fans/status/base', async (_req, res) => {
    try {
      const fansStatus = await ctx.fetchFansStatusBase()
      res.json(fansStatus)
    } catch (e: unknown) {
      sendFansError(res, e)
    }
  })

  app.get('/api/fans/status/details', async (_req, res) => {
    try {
      const fansStatus = await ctx.fetchFansStatusDetails()
      res.json(fansStatus)
    } catch (e: unknown) {
      sendFansError(res, e)
    }
  })

  app.get('/api/fans/status', async (_req, res) => {
    try {
      const fansStatus = await ctx.fetchFansStatus()
      res.json(fansStatus)
    } catch (e: unknown) {
      sendFansError(res, e)
    }
  })

  app.get('/api/yuba/status', async (_req, res) => {
    try {
      const yubaStatus = await ctx.fetchYubaStatus()
      res.json(yubaStatus)
    } catch (e: unknown) {
      sendFansError(res, e)
    }
  })
}
