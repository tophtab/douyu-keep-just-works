import type express from 'express'
import { isCookieCredentialMessage } from './server-errors'
import { sendJsonError } from './server-route-utils'
import type { AppContext } from './server-types'
import { isTaskType } from './task-metadata'

function resolveTaskErrorStatus(message: string): number {
  return (
    isCookieCredentialMessage(message)
    || message.endsWith('未配置')
    || message === '任务正在执行中，请稍后再试'
  )
    ? 400
    : 500
}

export function registerTaskRoutes(app: express.Express, ctx: AppContext): void {
  app.post('/api/trigger/:type', async (req, res) => {
    const { type } = req.params
    try {
      if (!isTaskType(type)) {
        return res.status(400).json({ error: '未知任务类型' })
      }
      await ctx.triggerTask(type)
      res.json({ ok: true })
    } catch (e: unknown) {
      sendJsonError(res, e, resolveTaskErrorStatus)
    }
  })
}
