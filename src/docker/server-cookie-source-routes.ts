import type express from 'express'
import { isCookieSourceConfigMessage } from './server-errors'
import { sendJsonOk, sendJsonResult } from './server-route-utils'
import type { AppContext } from './server-types'

function resolveCookieSourceErrorStatus(message: string): number {
  return isCookieSourceConfigMessage(message) || message.includes('扫码登录') || message.includes('鱼吧重试缺少') ? 400 : 500
}

export function registerCookieSourceRoutes(app: express.Express, ctx: AppContext): void {
  app.post('/api/cookie-source/check', async (_req, res) => {
    await sendJsonResult(res, () => ctx.inspectCookieSource(), resolveCookieSourceErrorStatus)
  })

  app.post('/api/cookie-source/passport-login/start', async (_req, res) => {
    await sendJsonOk(res, () => ctx.startPassportQrLogin(), resolveCookieSourceErrorStatus)
  })

  app.get('/api/cookie-source/passport-login/status', async (_req, res) => {
    await sendJsonOk(res, () => ctx.getPassportQrLoginStatus(), resolveCookieSourceErrorStatus)
  })

  app.post('/api/cookie-source/passport-login/poll', async (_req, res) => {
    await sendJsonOk(res, () => ctx.pollPassportQrLogin(), resolveCookieSourceErrorStatus)
  })

  app.post('/api/cookie-source/passport-login/cancel', async (_req, res) => {
    await sendJsonOk(res, () => ctx.cancelPassportQrLogin(), resolveCookieSourceErrorStatus)
  })

  app.post('/api/cookie-source/passport-login/retry-yuba', async (_req, res) => {
    await sendJsonOk(res, () => ctx.retryPassportQrLoginYuba(), resolveCookieSourceErrorStatus)
  })
}
