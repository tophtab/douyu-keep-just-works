import type express from 'express'
import { isCookieCloudReady } from '../core/cookie-cloud'
import { errorMessage, isCookieSourceConfigMessage } from './server-errors'
import type { AppContext } from './server-types'

function sendCookieSourceError(res: express.Response, error: unknown): void {
  const message = errorMessage(error)
  if (isCookieSourceConfigMessage(message)) {
    res.status(400).json({ error: message })
    return
  }
  res.status(500).json({ error: message })
}

export function registerCookieSourceRoutes(app: express.Express, ctx: AppContext): void {
  app.post('/api/cookie-source/check', async (_req, res) => {
    try {
      const result = await ctx.inspectCookieSource(true)
      res.json(result)
    } catch (e: unknown) {
      sendCookieSourceError(res, e)
    }
  })

  app.get('/api/cookie-source/effective', async (_req, res) => {
    try {
      const result = await ctx.getEffectiveCookies(true)
      res.json(result)
    } catch (e: unknown) {
      sendCookieSourceError(res, e)
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
      sendCookieSourceError(res, e)
    }
  })
}
