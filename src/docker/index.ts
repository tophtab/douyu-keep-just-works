import * as fs from 'fs'
import * as path from 'path'
import { CronJob } from 'cron'
import { executeKeepaliveJob, executeDoubleCardJob } from '../core/job'
import type { DockerConfig } from '../core/types'
import { addLog, createLogger, getLogs, clearLogs } from './logger'
import { createServer, type AppContext, type JobStatus } from './server'

const CONFIG_PATH = process.env.CONFIG_PATH || '/app/config/config.json'
const WEB_PORT = Number(process.env.WEB_PORT) || 3000

const log = createLogger('系统')

let config: DockerConfig | null = null
let keepaliveJob: CronJob | null = null
let doubleCardJob: CronJob | null = null
let keepaliveStatus: JobStatus = { running: false, lastRun: null, nextRun: null }
let doubleCardStatus: JobStatus = { running: false, lastRun: null, nextRun: null }

function loadConfigFromFile(): DockerConfig | null {
  const p = path.resolve(CONFIG_PATH)
  if (!fs.existsSync(p)) return null
  try {
    const raw = fs.readFileSync(p, 'utf-8')
    const c = JSON.parse(raw) as DockerConfig
    if (!c.cookie) return null
    return c
  } catch { return null }
}

function saveConfigToFile(c: DockerConfig): void {
  const p = path.resolve(CONFIG_PATH)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, JSON.stringify(c, null, 2), 'utf-8')
}

function stopJobs(): void {
  if (keepaliveJob) { keepaliveJob.stop(); keepaliveJob = null }
  if (doubleCardJob) { doubleCardJob.stop(); doubleCardJob = null }
  keepaliveStatus = { running: false, lastRun: null, nextRun: null }
  doubleCardStatus = { running: false, lastRun: null, nextRun: null }
}

function startJobs(): void {
  if (!config) return
  stopJobs()

  if (config.keepalive) {
    const kc = config.keepalive
    const runKeepalive = async () => {
      keepaliveStatus.lastRun = new Date().toISOString()
      const klog = createLogger('保活')
      klog('开始执行任务...')
      try { await executeKeepaliveJob(kc, config!.cookie, msg => klog(msg)) }
      catch (e: any) { klog(`任务出错: ${e.message || e}`) }
      if (keepaliveJob) keepaliveStatus.nextRun = keepaliveJob.nextDate().toISO()
    }
    runKeepalive()
    keepaliveJob = new CronJob(kc.cron, runKeepalive, null, false, 'Asia/Shanghai')
    keepaliveJob.start()
    keepaliveStatus.running = true
    keepaliveStatus.nextRun = keepaliveJob.nextDate().toISO()
    log(`保活任务已启动, cron: ${kc.cron}, 房间数: ${Object.keys(kc.send).length}`)
  }

  if (config.doubleCard) {
    const dc = config.doubleCard
    const runDoubleCard = async () => {
      doubleCardStatus.lastRun = new Date().toISOString()
      const dlog = createLogger('双倍')
      dlog('开始执行任务...')
      try { await executeDoubleCardJob(dc, config!.cookie, msg => dlog(msg)) }
      catch (e: any) { dlog(`任务出错: ${e.message || e}`) }
      if (doubleCardJob) doubleCardStatus.nextRun = doubleCardJob.nextDate().toISO()
    }
    runDoubleCard()
    doubleCardJob = new CronJob(dc.cron, runDoubleCard, null, false, 'Asia/Shanghai')
    doubleCardJob.start()
    doubleCardStatus.running = true
    doubleCardStatus.nextRun = doubleCardJob.nextDate().toISO()
    log(`双倍卡检测已启动, cron: ${dc.cron}, 房间数: ${Object.keys(dc.send).length}`)
  }
}

const ctx: AppContext = {
  getConfig: () => config,
  saveConfig: (c: DockerConfig) => {
    config = c
    saveConfigToFile(c)
    log('配置已更新')
    startJobs()
  },
  getStatus: () => ({ keepalive: { ...keepaliveStatus }, doubleCard: { ...doubleCardStatus } }),
  getLogs,
  clearLogs,
  triggerKeepalive: async () => {
    if (!config?.keepalive) throw new Error('保活任务未配置')
    keepaliveStatus.lastRun = new Date().toISOString()
    const klog = createLogger('保活-手动')
    await executeKeepaliveJob(config.keepalive, config.cookie, msg => klog(msg))
  },
  triggerDoubleCard: async () => {
    if (!config?.doubleCard) throw new Error('双倍卡任务未配置')
    doubleCardStatus.lastRun = new Date().toISOString()
    const dlog = createLogger('双倍-手动')
    await executeDoubleCardJob(config.doubleCard, config.cookie, msg => dlog(msg))
  },
}

function main(): void {
  log('斗鱼粉丝牌续牌 Docker 版启动')

  // Start web server first
  const app = createServer(ctx)
  app.listen(WEB_PORT, () => log(`WebUI 已启动: http://localhost:${WEB_PORT}`))

  // Try loading existing config
  config = loadConfigFromFile()
  if (config) {
    log('已加载配置文件')
    startJobs()
  } else {
    log('未找到配置文件，请通过 WebUI 进行配置')
  }

  process.on('SIGTERM', () => { log('收到停止信号'); stopJobs(); process.exit(0) })
  process.on('SIGINT', () => { log('收到停止信号'); stopJobs(); process.exit(0) })
}

main()
