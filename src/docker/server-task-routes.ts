import type express from 'express'
import { errorMessage, isMissingCookieMessage } from './server-errors'
import type { AppContext } from './server-types'

export function registerTaskRoutes(app: express.Express, ctx: AppContext): void {
  app.post('/api/trigger/:type', async (req, res) => {
    const { type } = req.params
    try {
      if (type === 'collectGift') {
        await ctx.triggerCollectGift()
      } else if (type === 'keepalive') {
        await ctx.triggerKeepalive()
      } else if (type === 'doubleCard') {
        await ctx.triggerDoubleCard()
      } else if (type === 'expiringGift') {
        await ctx.triggerExpiringGift()
      } else if (type === 'yubaCheckIn') {
        await ctx.triggerYubaCheckIn()
      } else {
        return res.status(400).json({ error: '未知任务类型' })
      }
      res.json({ ok: true })
    } catch (e: unknown) {
      const message = errorMessage(e)
      if (
        isMissingCookieMessage(message)
        || message.endsWith('未配置')
        || message === '任务正在执行中，请稍后再试'
      ) {
        return res.status(400).json({ error: message })
      }
      res.status(500).json({ error: message })
    }
  })
}
