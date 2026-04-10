import * as fs from 'node:fs'
import * as path from 'node:path'
import process from 'node:process'
import { CronJob } from 'cron'
import { executeDoubleCardJob, executeKeepaliveJob } from '../core/job'
import { getFansList } from '../core/api'
import { checkDoubleCard } from '../core/double-card'
import type { DockerConfig, FanStatus, JobConfig } from '../core/types'
import { clearLogs, createLogger, getLogs } from './logger'
import { createServer } from './server'
import type { AppContext, JobStatus } from './server'

const CONFIG_PATH = process.env.CONFIG_PATH || '/app/config/config.json'
const WEB_PORT = Number.parseInt(process.env.WEB_PORT || '3000', 10)

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
  if (!fs.existsSync(configPath)) {
    return null
  }
  const raw = fs.readFileSync(configPath, 'utf-8')
  return JSON.parse(raw) as DockerConfig
}

function saveConfigToDisk(config: DockerConfig): void {
  const configPath = path.resolve(CONFIG_PATH)
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

function stopJobs(): void {
  if (keepaliveJob) {
    keepaliveJob.stop()
    keepaliveJob = null
  }
  if (doubleCardJob) {
    doubleCardJob.stop()
    doubleCardJob = null
  }
  keepaliveStatus = { running: false, lastRun: null, nextRun: null }
  doubleCardStatus = { running: false, lastRun: null, nextRun: null }
}

function startJobs(config: DockerConfig): void {
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
      if (keepaliveJob) {
        keepaliveStatus.nextRun = keepaliveJob.nextDate().toISO()
      }
    }
    runKeepalive()
    keepaliveJob = new CronJob(keepaliveConfig.cron, () => {
      runKeepalive()
    }, null, false, 'Asia/Shanghai')
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
      if (doubleCardJob) {
        doubleCardStatus.nextRun = doubleCardJob.nextDate().toISO()
      }
    }
    runDoubleCard()
    doubleCardJob = new CronJob(doubleCardConfig.cron, () => {
      runDoubleCard()
    }, null, false, 'Asia/Shanghai')
    doubleCardJob.start()
    doubleCardStatus.running = true
    doubleCardStatus.nextRun = doubleCardJob.nextDate().toISO()
    logSystem(`双倍卡任务已启动, cron: ${doubleCardConfig.cron}, 房间数: ${Object.keys(doubleCardConfig.send).length}`)
  }
}

function hasConfiguredJobs(config: DockerConfig): boolean {
  return Boolean(config.keepalive || config.doubleCard)
}

function applyConfig(config: DockerConfig, reason: 'startup' | 'cookie_saved' | 'tasks_saved'): void {
  currentConfig = config
  stopJobs()

  if (!config.cookie) {
    if (reason === 'startup') {
      logSystem('配置已加载，但 cookie 为空，请通过 WebUI 填写 cookie')
    } else if (hasConfiguredJobs(config)) {
      logSystem('任务配置已保存，但 cookie 为空，任务未启动')
    } else if (reason === 'tasks_saved') {
      logSystem('任务配置已保存，可继续保存 Cookie')
    } else {
      logSystem('Cookie 为空，请先保存 Cookie')
    }
    return
  }

  if (!hasConfiguredJobs(config)) {
    if (reason === 'startup') {
      logSystem('配置已加载，但未启用任何任务')
    } else if (reason === 'cookie_saved') {
      logSystem('Cookie 已保存，可继续配置任务')
    } else {
      logSystem('任务配置已保存，但未启用任何任务')
    }
    return
  }

  startJobs(config)

  if (reason === 'cookie_saved') {
    logSystem('Cookie 已更新，现有任务已重新加载')
  } else if (reason === 'tasks_saved') {
    logSystem('任务配置已更新，任务已重启')
  }
}

function getDefaultConfig(): DockerConfig {
  return {
    cookie: '',
    keepalive: {
      cron: '0 0 8 * * *',
      model: 1,
      send: {},
      time: '跟随执行模式',
      timeValue: [0, 1, 2, 3, 4, 5, 6],
    },
  }
}

function main(): void {
  logSystem('斗鱼粉丝牌续牌 Docker 版启动')

  try {
    const config = loadConfigFromDisk()
    if (config) {
      logSystem('配置加载成功')
      applyConfig(config, 'startup')
    } else {
      const defaultConfig = getDefaultConfig()
      saveConfigToDisk(defaultConfig)
      currentConfig = defaultConfig
      logSystem('已生成默认配置文件，请通过 WebUI 填写 cookie 和房间配置')
    }
  } catch (error: any) {
    logSystem(`配置加载失败: ${error.message}`)
  }

  // Always start WebUI
  const ctx: AppContext = {
    getConfig: () => currentConfig,
    saveCookie: (cookie: string) => {
      const nextConfig: DockerConfig = {
        cookie,
        ...(currentConfig?.keepalive ? { keepalive: currentConfig.keepalive } : {}),
        ...(currentConfig?.doubleCard ? { doubleCard: currentConfig.doubleCard } : {}),
      }
      saveConfigToDisk(nextConfig)
      applyConfig(nextConfig, 'cookie_saved')
    },
    saveTaskConfig: (config: { keepalive?: JobConfig; doubleCard?: JobConfig }) => {
      const nextConfig: DockerConfig = {
        cookie: currentConfig?.cookie || '',
        ...(config.keepalive ? { keepalive: config.keepalive } : {}),
        ...(config.doubleCard ? { doubleCard: config.doubleCard } : {}),
      }
      saveConfigToDisk(nextConfig)
      applyConfig(nextConfig, 'tasks_saved')
    },
    getStatus: () => ({ keepalive: { ...keepaliveStatus }, doubleCard: { ...doubleCardStatus } }),
    getLogs: () => getLogs(),
    clearLogs: () => clearLogs(),
    triggerKeepalive: async () => {
      if (!currentConfig?.keepalive) {
        throw new Error('保活任务未配置')
      }
      if (!currentConfig.cookie) {
        throw new Error('请先配置 cookie')
      }
      logKeepalive('手动触发执行...')
      await executeKeepaliveJob(currentConfig.keepalive, currentConfig.cookie, msg => logKeepalive(msg))
    },
    triggerDoubleCard: async () => {
      if (!currentConfig?.doubleCard) {
        throw new Error('双倍卡任务未配置')
      }
      if (!currentConfig.cookie) {
        throw new Error('请先配置 cookie')
      }
      logDoubleCard('手动触发执行...')
      await executeDoubleCardJob(currentConfig.doubleCard, currentConfig.cookie, msg => logDoubleCard(msg))
    },
    fetchFans: async (cookie: string) => {
      return await getFansList(cookie)
    },
    fetchFansStatus: async (cookie: string) => {
      const fans = await getFansList(cookie)
      const statuses = await Promise.all(fans.map(async (fan): Promise<FanStatus> => {
        const doubleInfo = await checkDoubleCard(fan.roomId, cookie)
        return {
          ...fan,
          doubleActive: doubleInfo.active,
          doubleExpireTime: doubleInfo.expireTime,
        }
      }))
      return statuses
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
