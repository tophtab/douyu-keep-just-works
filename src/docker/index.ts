import * as fs from 'node:fs'
import * as path from 'node:path'
import process from 'node:process'
import { CronJob } from 'cron'
import { getFansList } from '../core/api'
import { checkDoubleCard } from '../core/double-card'
import { executeCollectGiftJob, executeDoubleCardJob, executeKeepaliveJob } from '../core/job'
import { createDefaultDockerConfig, normalizeDockerConfig, reconcileDockerConfig } from '../core/medal-sync'
import type { CollectGiftConfig, DockerConfig, DoubleCardConfig, FanStatus, Fans, JobConfig } from '../core/types'
import { assertDockerConfigCrons } from './cron'
import { clearLogs, createLogger, getLogs } from './logger'
import { createServer } from './server'
import type { AppContext, JobStatus } from './server'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const CONFIG_PATH = process.env.CONFIG_PATH || '/app/config/config.json'
const WEB_PORT = Number.parseInt(process.env.WEB_PORT || '3000', 10)
const DOCKER_TIMEZONE = 'Asia/Shanghai'

type TaskType = 'collectGift' | 'keepalive' | 'doubleCard'
type AppStatus = Record<TaskType, JobStatus>

let currentConfig: DockerConfig | null = null
const jobs: Record<TaskType, CronJob | null> = {
  collectGift: null,
  keepalive: null,
  doubleCard: null,
}
const statuses: AppStatus = {
  collectGift: { running: false, lastRun: null, nextRun: null },
  keepalive: { running: false, lastRun: null, nextRun: null },
  doubleCard: { running: false, lastRun: null, nextRun: null },
}
const activeRuns: Record<TaskType, boolean> = {
  collectGift: false,
  keepalive: false,
  doubleCard: false,
}

const logSystem = createLogger('系统')
const taskLoggers = {
  collectGift: createLogger('领取'),
  keepalive: createLogger('保活'),
  doubleCard: createLogger('双倍'),
} satisfies Record<TaskType, (message: string) => void>

function loadConfigFromDisk(): DockerConfig | null {
  const configPath = path.resolve(CONFIG_PATH)
  if (!fs.existsSync(configPath)) {
    return null
  }
  const raw = fs.readFileSync(configPath, 'utf-8')
  return normalizeDockerConfig(JSON.parse(raw) as DockerConfig, { ensureCollectGift: true })
}

function saveConfigToDisk(config: DockerConfig): void {
  const configPath = path.resolve(CONFIG_PATH)
  const dir = path.dirname(configPath)
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
}

function configsEqual(a: DockerConfig | null, b: DockerConfig): boolean {
  if (!a) {
    return false
  }
  return JSON.stringify(a) === JSON.stringify(b)
}

function createIdleStatus(): JobStatus {
  return { running: false, lastRun: null, nextRun: null }
}

function createStatusTimestamp(): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: DOCKER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date()).replace(' ', 'T')
}

function stopJobs(): void {
  ;(Object.keys(jobs) as TaskType[]).forEach((key) => {
    const job = jobs[key]
    if (job) {
      job.stop()
      jobs[key] = null
    }
    statuses[key] = createIdleStatus()
  })
}

async function runTaskWithLock(
  type: TaskType,
  runTask: () => Promise<void>,
  options: {
    onBusy: 'skip' | 'throw'
    busyMessage: string
  },
): Promise<boolean> {
  if (activeRuns[type]) {
    if (options.onBusy === 'skip') {
      taskLoggers[type](options.busyMessage)
      return false
    }
    throw new Error(options.busyMessage)
  }

  activeRuns[type] = true
  try {
    await runTask()
    return true
  } finally {
    activeRuns[type] = false
  }
}

function startScheduledTask(
  type: TaskType,
  label: string,
  cron: string,
  runTask: () => Promise<void>,
  summary?: string,
): void {
  const logger = taskLoggers[type]
  const run = async () => {
    await runTaskWithLock(type, async () => {
      logger('开始执行任务...')
      statuses[type].lastRun = createStatusTimestamp()
      await runTask()
    }, {
      onBusy: 'skip',
      busyMessage: '任务仍在执行中，跳过本次触发',
    }).catch((error: unknown) => {
      logger(`任务执行出错: ${errorMessage(error)}`)
    })

    const job = jobs[type]
    if (job) {
      statuses[type].nextRun = job.nextDate().toISO()
    }
  }

  const job = new CronJob(cron, () => {
    void run()
  }, null, false, DOCKER_TIMEZONE)
  jobs[type] = job
  job.start()
  statuses[type].running = true
  statuses[type].nextRun = job.nextDate().toISO()
  logSystem(`${label}已启动, cron: ${cron}, 下次执行: ${statuses[type].nextRun}${summary ? `, ${summary}` : ''}`)
}

function startJobs(config: DockerConfig): void {
  if (config.collectGift) {
    const collectGiftConfig = config.collectGift
    startScheduledTask(
      'collectGift',
      '领取任务',
      collectGiftConfig.cron,
      async () => {
        await executeCollectGiftJob(config.cookie, taskLoggers.collectGift)
      },
    )
  }

  if (config.keepalive) {
    const keepaliveConfig = config.keepalive
    startScheduledTask(
      'keepalive',
      '保活任务',
      keepaliveConfig.cron,
      async () => await executeKeepaliveJob(keepaliveConfig, config.cookie, taskLoggers.keepalive),
      `房间数: ${Object.keys(keepaliveConfig.send).length}`,
    )
  }

  if (config.doubleCard) {
    const doubleCardConfig = config.doubleCard
    startScheduledTask(
      'doubleCard',
      '双倍卡任务',
      doubleCardConfig.cron,
      async () => await executeDoubleCardJob(doubleCardConfig, config.cookie, taskLoggers.doubleCard),
      `房间数: ${Object.keys(doubleCardConfig.send).length}`,
    )
  }
}

function hasConfiguredJobs(config: DockerConfig): boolean {
  return Boolean(config.collectGift || config.keepalive || config.doubleCard)
}

function applyConfig(config: DockerConfig, reason: 'startup' | 'cookie_saved' | 'tasks_saved' | 'ui_saved' | 'medal_synced'): void {
  const nextConfig = normalizeDockerConfig(config)
  assertDockerConfigCrons(nextConfig)
  currentConfig = nextConfig
  stopJobs()

  if (!currentConfig.cookie) {
    if (reason === 'startup') {
      logSystem('配置已加载，但 cookie 为空，请通过 WebUI 填写 cookie')
    } else if (hasConfiguredJobs(currentConfig)) {
      logSystem('任务配置已保存，但 cookie 为空，任务未启动')
    } else if (reason === 'tasks_saved') {
      logSystem('任务配置已保存，可继续保存 Cookie')
    } else {
      logSystem('Cookie 为空，请先保存 Cookie')
    }
    return
  }

  if (!hasConfiguredJobs(currentConfig)) {
    if (reason === 'startup') {
      logSystem('配置已加载，但未启用任何任务')
    } else if (reason === 'cookie_saved') {
      logSystem('Cookie 已保存，可继续配置任务')
    } else {
      logSystem('任务配置已保存，但未启用任何任务')
    }
    return
  }

  startJobs(currentConfig)

  if (reason === 'cookie_saved') {
    logSystem('Cookie 已更新，现有任务已重新加载')
  } else if (reason === 'tasks_saved') {
    logSystem('任务配置已更新，任务已重启')
  } else if (reason === 'ui_saved') {
    logSystem('界面偏好已更新')
  } else if (reason === 'medal_synced') {
    logSystem('粉丝牌列表变化，相关任务配置已同步')
  }
}

async function syncConfigWithFans(reason: 'tasks_saved' | 'medal_synced'): Promise<{ config: DockerConfig, fans: Fans[] }> {
  if (!currentConfig?.cookie) {
    throw new Error('请先配置 cookie')
  }

  const fans = await getFansList(currentConfig.cookie)
  const nextConfig = reconcileDockerConfig(currentConfig, fans)

  if (!configsEqual(currentConfig, nextConfig)) {
    saveConfigToDisk(nextConfig)
    applyConfig(nextConfig, reason)
  }

  return {
    config: nextConfig,
    fans,
  }
}

function buildConfigWithPartialUpdate(current: DockerConfig | null, updates: {
  collectGift?: CollectGiftConfig | null
  keepalive?: JobConfig | null
  doubleCard?: DoubleCardConfig | null
  ui?: DockerConfig['ui']
}): DockerConfig {
  const nextConfig: DockerConfig = {
    cookie: current?.cookie || '',
    ui: updates.ui || current?.ui,
    ...(updates.collectGift !== undefined
      ? (updates.collectGift ? { collectGift: updates.collectGift } : {})
      : (current?.collectGift ? { collectGift: current.collectGift } : {})),
    ...(updates.keepalive !== undefined
      ? (updates.keepalive ? { keepalive: updates.keepalive } : {})
      : (current?.keepalive ? { keepalive: current.keepalive } : {})),
    ...(updates.doubleCard !== undefined
      ? (updates.doubleCard ? { doubleCard: updates.doubleCard } : {})
      : (current?.doubleCard ? { doubleCard: current.doubleCard } : {})),
  }
  return normalizeDockerConfig(nextConfig)
}

function main(): void {
  logSystem('斗鱼粉丝牌续牌 Docker 版启动')

  try {
    const config = loadConfigFromDisk()
    if (config) {
      logSystem('配置加载成功')
      saveConfigToDisk(config)
      applyConfig(config, 'startup')
    } else {
      const defaultConfig = createDefaultDockerConfig()
      saveConfigToDisk(defaultConfig)
      currentConfig = defaultConfig
      logSystem('已生成默认配置文件，请通过 WebUI 填写 cookie 和任务配置')
    }
  } catch (error: unknown) {
    logSystem(`配置加载失败: ${errorMessage(error)}`)
  }

  const ctx: AppContext = {
    getConfig: () => currentConfig,
    saveCookie: (cookie: string) => {
      const nextConfig = buildConfigWithPartialUpdate(currentConfig, {})
      nextConfig.cookie = cookie
      saveConfigToDisk(nextConfig)
      applyConfig(nextConfig, 'cookie_saved')
    },
    saveTaskConfig: async (config: {
      collectGift?: CollectGiftConfig | null
      keepalive?: JobConfig | null
      doubleCard?: DoubleCardConfig | null
      ui?: DockerConfig['ui']
    }) => {
      const nextConfig = buildConfigWithPartialUpdate(currentConfig, config)
      const hasTaskPayload = config.collectGift !== undefined || config.keepalive !== undefined || config.doubleCard !== undefined
      const needsFanSync = config.keepalive !== undefined || config.doubleCard !== undefined

      assertDockerConfigCrons(nextConfig)
      saveConfigToDisk(nextConfig)
      if (hasTaskPayload) {
        applyConfig(nextConfig, 'tasks_saved')
      } else {
        currentConfig = nextConfig
        logSystem('界面偏好已更新')
      }
      if (needsFanSync && nextConfig.cookie) {
        return await syncConfigWithFans('tasks_saved')
      }
      return {
        config: nextConfig,
        fans: [],
      }
    },
    syncWithFans: async () => await syncConfigWithFans('medal_synced'),
    getStatus: () => ({
      collectGift: { ...statuses.collectGift },
      keepalive: { ...statuses.keepalive },
      doubleCard: { ...statuses.doubleCard },
    }),
    getLogs: () => getLogs(),
    clearLogs: () => clearLogs(),
    triggerCollectGift: async () => {
      if (!currentConfig?.collectGift) {
        throw new Error('领取任务未配置')
      }
      if (!currentConfig.cookie) {
        throw new Error('请先配置 cookie')
      }
      const cookie = currentConfig.cookie
      await runTaskWithLock('collectGift', async () => {
        taskLoggers.collectGift('手动触发执行...')
        await executeCollectGiftJob(cookie, taskLoggers.collectGift)
      }, {
        onBusy: 'throw',
        busyMessage: '任务正在执行中，请稍后再试',
      })
    },
    triggerKeepalive: async () => {
      if (!currentConfig?.keepalive) {
        throw new Error('保活任务未配置')
      }
      if (!currentConfig.cookie) {
        throw new Error('请先配置 cookie')
      }
      const keepaliveConfig = currentConfig.keepalive
      const cookie = currentConfig.cookie
      await runTaskWithLock('keepalive', async () => {
        taskLoggers.keepalive('手动触发执行...')
        await executeKeepaliveJob(keepaliveConfig, cookie, taskLoggers.keepalive)
      }, {
        onBusy: 'throw',
        busyMessage: '任务正在执行中，请稍后再试',
      })
    },
    triggerDoubleCard: async () => {
      if (!currentConfig?.doubleCard) {
        throw new Error('双倍卡任务未配置')
      }
      if (!currentConfig.cookie) {
        throw new Error('请先配置 cookie')
      }
      const doubleCardConfig = currentConfig.doubleCard
      const cookie = currentConfig.cookie
      await runTaskWithLock('doubleCard', async () => {
        taskLoggers.doubleCard('手动触发执行...')
        await executeDoubleCardJob(doubleCardConfig, cookie, taskLoggers.doubleCard)
      }, {
        onBusy: 'throw',
        busyMessage: '任务正在执行中，请稍后再试',
      })
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
