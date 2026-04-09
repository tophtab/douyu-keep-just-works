import * as fs from 'fs'
import * as path from 'path'
import { CronJob } from 'cron'
import { executeKeepaliveJob, executeDoubleCardJob } from '../core/job'
import type { DockerConfig, JobConfig } from '../core/types'
import { addLog, getLogs, clearLogs, createLogger } from './logger'
import { createServer } from './server'
import type { JobStatus, AppContext } from './server'

const CONFIG_PATH = process.env.CONFIG_PATH || '/app/config/config.json'
const WEB_PORT = parseInt(process.env.WEB_PORT || '3000', 10)

let currentConfig: DockerConfig | null = null
let keepaliveJob: CronJob | null = null
let doubleCardJob: CronJob | null = null
let keepaliveStatus: JobStatus = { running: false, lastRun: null, nextRun: null }
let doubleCardStatus: JobStatus = { running: false, lastRun: null, nextRun: null }

const logSystem = createLogger('系统')
const logKeepalive = createLogger('保活')
const logDoubleCard = createLogger('双倍')

function loadConfigFromDisk(): DockerConfig | null {
  const configPath = path.resolve(CONFIG_PATH)
  if (!fs.existsSync(configPath)) return null
  const raw = fs.readFileSync(configPath, 'utf-8')
  const config = JSON.parse(raw) as DockerConfig
  if (!config.cookie) throw new Error('配置缺少 cookie 字段')
  if (!config.keepalive && !config.doubleCard) throw new Error('配置至少需要 keepalive 或 doubleCard 其中之一')
  return config
}

function saveConfigToDisk(config: DockerConfig): void {
  const configPath = path.resolve(CONFIG_PATH)
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

function stopJobs(): void {
  if (keepaliveJob) { keepaliveJob.stop(); keepaliveJob = null }
  if (doubleCardJob) { doubleCardJob.stop(); doubleCardJob = null }
  keepaliveStatus = { running: false, lastRun: null, nextRun: null }
  doubleCardStatus = { running: false, lastRun: null, nextRun: null }
}

function startJobs(config: DockerConfig): void {
  stopJobs()
  currentConfig = config

  if (config.keepalive) {
    const keepaliveConfig = config.keepalive
    const runKeepalive = async () => {
      logKeepalive('开始执行任务...')
      keepaliveStatus.lastRun = new Date().toISOString()
      try {
        await executeKeepaliveJob(keepaliveConfig, config.cookie, msg => logKeepalive(msg))
      } catch (error: any) {
        logKeepalive(`任务执行出错: ${error.message || error}`)
      }
      if (keepaliveJob) keepaliveStatus.nextRun = keepaliveJob.nextDate().toISO()
    }
    runKeepalive()
    keepaliveJob = new CronJob(keepaliveConfig.cron, () => { runKeepalive() }, null, false, 'Asia/Shanghai')
    keepaliveJob.start()
    keepaliveStatus.running = true
    keepaliveStatus.nextRun = keepaliveJob.nextDate().toISO()
    logSystem(`保活任务已启动, cron: ${keepaliveConfig.cron}, 房间数: ${Object.keys(keepaliveConfig.send).length}`)
  }

  if (config.doubleCard) {
    const doubleCardConfig = config.doubleCard
    const runDoubleCard = async () => {
      logDoubleCard('开始执行任务...')
      doubleCardStatus.lastRun = new Date().toISOString()
      try {
        await executeDoubleCardJob(doubleCardConfig, config.cookie, msg => logDoubleCard(msg))
      } catch (error: any) {
        logDoubleCard(`任务执行出错: ${error.message || error}`)
      }
      if (doubleCardJob) doubleCardStatus.nextRun = doubleCardJob.nextDate().toISO()
    }
    runDoubleCard()
    doubleCardJob = new CronJob(doubleCardConfig.cron, () => { runDoubleCard() }, null, false, 'Asia/Shanghai')
    doubleCardJob.start()
    doubleCardStatus.running = true
    doubleCardStatus.nextRun = doubleCardJob.nextDate().toISO()
    logSystem(`双倍卡任务已启动, cron: ${doubleCardConfig.cron}, 房间数: ${Object.keys(doubleCardConfig.send).length}`)
  }
}

function main(): void {
  logSystem('斗鱼粉丝牌续牌 Docker 版启动')

  // Try loading existing config — don't exit if missing
  try {
    const config = loadConfigFromDisk()
    if (config) {
      logSystem('配置加载成功')
      startJobs(config)
    } else {
      logSystem('未找到配置文件，请通过 WebUI 进行配置')
    }
  } catch (error: any) {
    logSystem(`配置加载失败: ${error.message}`)
  }

  // Always start WebUI
  const ctx: AppContext = {
    getConfig: () => currentConfig,
    saveConfig: (config: DockerConfig) => {
      saveConfigToDisk(config)
      startJobs(config)
      logSystem('配置已更新，任务已重启')
    },
    getStatus: () => ({ keepalive: { ...keepaliveStatus }, doubleCard: { ...doubleCardStatus } }),
    getLogs: () => getLogs(),
    clearLogs: () => clearLogs(),
    triggerKeepalive: async () => {
      if (!currentConfig?.keepalive) throw new Error('保活任务未配置')
      logKeepalive('手动触发执行...')
      await executeKeepaliveJob(currentConfig.keepalive, currentConfig.cookie, msg => logKeepalive(msg))
    },
    triggerDoubleCard: async () => {
      if (!currentConfig?.doubleCard) throw new Error('双倍卡任务未配置')
      logDoubleCard('手动触发执行...')
      await executeDoubleCardJob(currentConfig.doubleCard, currentConfig.cookie, msg => logDoubleCard(msg))
    },
  }

  const app = createServer(ctx)
  app.listen(WEB_PORT, '0.0.0.0', () => {
    logSystem(`WebUI 已启动: http://0.0.0.0:${WEB_PORT}`)
  })

  const shutdown = () => {
    logSystem('收到停止信号，正在关闭...')
    stopJobs()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main()
