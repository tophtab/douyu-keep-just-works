import type express from 'express'
import type { AppContext } from './server-types'

export function registerPushReportRoutes(app: express.Express, ctx: AppContext): void {
  app.get('/api/push-report', (_req, res) => {
    try {
      res.json(ctx.getPushReportSnapshot())
    } catch (e: unknown) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
    }
  })

  app.post('/api/push-report/channel', async (req, res) => {
    try {
      const body = (req.body || {}) as { enabled?: unknown, baseUrl?: unknown, token?: unknown, mode?: unknown }
      const update: Record<string, unknown> = {}

      if (typeof body.enabled === 'boolean') {
        update.enabled = body.enabled
      }
      if (typeof body.baseUrl === 'string') {
        update.baseUrl = body.baseUrl.trim()
      }
      if (typeof body.mode === 'string') {
        update.mode = body.mode === 'text' ? 'text' : 'card'
      }
      // 令牌留空表示「不修改」，避免界面里回填明文
      if (typeof body.token === 'string' && body.token.trim()) {
        update.token = body.token.trim()
      }

      await ctx.saveTaskConfig({ pushChannel: update } as never)
      res.json({ ok: true, channel: ctx.getPushReportSnapshot().channel })
    } catch (e: unknown) {
      res.status(500).json({ error: e instanceof Error ? e.message : String(e) })
    }
  })

  app.post('/api/push-report/test', async (_req, res) => {
    const result = await ctx.sendPushTest()
    if (!result.ok) {
      return res.status(502).json({ error: result.error || '推送失败' })
    }
    res.json({ ok: true })
  })

  app.post('/api/push-report/send', async (_req, res) => {
    const result = await ctx.sendPushReportNow()
    if (!result.ok) {
      return res.status(502).json({ error: result.error || '推送失败' })
    }
    res.json({ ok: true })
  })
}
