import type express from 'express'
import { isCookieCloudReady } from '../core/cookie-cloud'
import { isCookieSourceConfigMessage } from './server-errors'
import { sendJsonResult } from './server-route-utils'
import type { AppContext } from './server-types'

function resolveCookieSourceErrorStatus(message: string): number {
  return isCookieSourceConfigMessage(message) ? 400 : 500
}

export function registerCookieSourceRoutes(app: express.Express, ctx: AppContext): void {
  app.post('/api/cookie-source/check', async (_req, res) => {
    await sendJsonResult(res, () => ctx.inspectCookieSource(), resolveCookieSourceErrorStatus)
  })

  app.get('/api/cookie-source/effective', async (_req, res) => {
    await sendJsonResult(res, () => ctx.getEffectiveCookies(true), resolveCookieSourceErrorStatus)
  })

  app.post('/api/cookie-source/persist', async (_req, res) => {
    if (!isCookieCloudReady(ctx.getConfig()?.cookieCloud)) {
      return res.status(400).json({ error: 'CookieCloud 未启用' })
    }

    await sendJsonResult(res, async () => {
      const result = await ctx.persistEffectiveCookies(true)
      return { ok: true, data: result }
    }, resolveCookieSourceErrorStatus)
  })
}
