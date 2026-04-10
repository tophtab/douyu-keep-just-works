import express from 'express'
import type { DockerConfig, FanStatus, Fans, JobConfig } from '../core/types'
import type { LogEntry } from './logger'
import { getHtml } from './html'

export interface JobStatus {
  running: boolean
  lastRun: string | null
  nextRun: string | null
}

export interface AppContext {
  getConfig(): DockerConfig | null
  saveCookie(cookie: string): void
  saveTaskConfig(config: { keepalive?: JobConfig; doubleCard?: JobConfig }): void
  getStatus(): { keepalive: JobStatus; doubleCard: JobStatus }
  getLogs(): LogEntry[]
  clearLogs(): void
  triggerKeepalive(): Promise<void>
  triggerDoubleCard(): Promise<void>
  fetchFans(cookie: string): Promise<Fans[]>
  fetchFansStatus(cookie: string): Promise<FanStatus[]>
}

function maskCookie(cookie: string): string {
  if (cookie.length <= 20) {
    return '***'
  }
  return `${cookie.substring(0, 10)}...${cookie.substring(cookie.length - 10)}`
}

export function createServer(ctx: AppContext): express.Express {
  const app = express()
  app.use(express.json())

  function summarizeConfig(config: DockerConfig | null) {
    return {
      cookieSaved: Boolean(config?.cookie),
      keepaliveConfigured: Boolean(config?.keepalive),
      doubleCardConfigured: Boolean(config?.doubleCard),
      keepaliveRooms: Object.keys(config?.keepalive?.send || {}).length,
      doubleCardRooms: Object.keys(config?.doubleCard?.send || {}).length,
    }
  }

  function validateJobConfig(name: string, config: JobConfig): string | null {
    if (!config.cron) {
      return `${name} 缺少 cron`
    }
    if (config.model !== 1 && config.model !== 2) {
      return `${name} 分配模式无效`
    }
    if (!config.send || typeof config.send !== 'object') {
      return `${name} 房间配置无效`
    }
    return null
  }

  app.get('/', (_req, res) => {
    res.type('html').send(getHtml())
  })

  app.get('/api/config', (_req, res) => {
    const config = ctx.getConfig()
    if (!config) {
      return res.json({ exists: false })
    }
    res.json({
      exists: true,
      data: { ...config, cookie: maskCookie(config.cookie) },
    })
  })

  app.get('/api/config/raw', (_req, res) => {
    const config = ctx.getConfig()
    if (!config) {
      return res.json({ exists: false })
    }
    res.json({ exists: true, data: config })
  })

  app.get('/api/overview', (_req, res) => {
    const config = ctx.getConfig()
    const status = ctx.getStatus()
    const recentLogs = ctx.getLogs().slice(-8)
    res.json({
      ...summarizeConfig(config),
      ready: Boolean(config?.cookie && (config?.keepalive || config?.doubleCard)),
      status,
      recentLogs,
    })
  })

  app.post('/api/cookie', (req, res) => {
    try {
      const cookie = String(req.body?.cookie || '').trim()
      if (!cookie) {
        return res.status(400).json({ error: '缺少 cookie' })
      }
      ctx.saveCookie(cookie)
      res.json({ ok: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/config', (req, res) => {
    try {
      const payload = req.body as Partial<DockerConfig>
      if (payload.keepalive) {
        const error = validateJobConfig('keepalive', payload.keepalive)
        if (error) {
          return res.status(400).json({ error })
        }
      }
      if (payload.doubleCard) {
        const error = validateJobConfig('doubleCard', payload.doubleCard)
        if (error) {
          return res.status(400).json({ error })
        }
      }
      ctx.saveTaskConfig({
        keepalive: payload.keepalive,
        doubleCard: payload.doubleCard,
      })
      res.json({ ok: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/status', (_req, res) => {
    res.json(ctx.getStatus())
  })

  app.get('/api/logs', (_req, res) => {
    res.json(ctx.getLogs())
  })

  app.delete('/api/logs', (_req, res) => {
    ctx.clearLogs()
    res.json({ ok: true })
  })

  app.get('/api/fans', async (_req, res) => {
    const config = ctx.getConfig()
    if (!config?.cookie) {
      return res.status(400).json({ error: '请先配置 cookie' })
    }
    try {
      const fans = await ctx.fetchFans(config.cookie)
      res.json(fans)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.get('/api/fans/status', async (_req, res) => {
    const config = ctx.getConfig()
    if (!config?.cookie) {
      return res.status(400).json({ error: '请先配置 cookie' })
    }
    try {
      const fans = await ctx.fetchFansStatus(config.cookie)
      res.json(fans)
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  app.post('/api/trigger/:type', async (req, res) => {
    const { type } = req.params
    try {
      if (type === 'keepalive') {
        await ctx.triggerKeepalive()
      } else if (type === 'doubleCard') {
        await ctx.triggerDoubleCard()
      } else {
        return res.status(400).json({ error: '未知任务类型' })
      }
      res.json({ ok: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  return app
}
