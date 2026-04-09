import express from 'express'
import type { LogEntry } from './logger'
import type { DockerConfig } from '../core/types'
import { getHtml } from './html'

export interface JobStatus {
  running: boolean
  lastRun: string | null
  nextRun: string | null
}

export interface AppContext {
  getConfig(): DockerConfig | null
  saveConfig(config: DockerConfig): void
  getStatus(): { keepalive: JobStatus; doubleCard: JobStatus }
  getLogs(): LogEntry[]
  clearLogs(): void
  triggerKeepalive(): Promise<void>
  triggerDoubleCard(): Promise<void>
}

function maskCookie(cookie: string): string {
  if (cookie.length <= 20) return '***'
  return cookie.substring(0, 10) + '...' + cookie.substring(cookie.length - 10)
}

export function createServer(ctx: AppContext): express.Express {
  const app = express()
  app.use(express.json())

  app.get('/', (_req, res) => {
    res.type('html').send(getHtml())
  })

  app.get('/api/config', (_req, res) => {
    const config = ctx.getConfig()
    if (!config) return res.json({ exists: false })
    res.json({
      exists: true,
      data: { ...config, cookie: maskCookie(config.cookie) },
    })
  })

  app.get('/api/config/raw', (_req, res) => {
    const config = ctx.getConfig()
    if (!config) return res.json({ exists: false })
    res.json({ exists: true, data: config })
  })

  app.post('/api/config', (req, res) => {
    try {
      const config = req.body as DockerConfig
      if (!config.cookie) return res.status(400).json({ error: '缺少 cookie' })
      if (!config.keepalive && !config.doubleCard) {
        return res.status(400).json({ error: '至少需要 keepalive 或 doubleCard 配置' })
      }
      ctx.saveConfig(config)
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

  app.post('/api/trigger/:type', async (req, res) => {
    const { type } = req.params
    try {
      if (type === 'keepalive') await ctx.triggerKeepalive()
      else if (type === 'doubleCard') await ctx.triggerDoubleCard()
      else return res.status(400).json({ error: '未知任务类型' })
      res.json({ ok: true })
    } catch (e: any) {
      res.status(500).json({ error: e.message })
    }
  })

  return app
}
