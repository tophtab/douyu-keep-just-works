import process from 'node:process'
import { CronJob } from 'cron'
import { getFollowedYubaStatusesWithDyToken } from '../core/yuba'
import { createDefaultDockerConfig, normalizeDockerConfig, reconcileDockerConfig } from '../core/medal-sync'
import { DEFAULT_COOKIE_CLOUD_SYNC_CRON } from '../core/task-defaults'
import type { CollectGiftConfig, DockerConfig, DoubleCardConfig, ExpiringGiftConfig, Fans, JobConfig, ManualCookieConfig } from '../core/types'
import { buildConfigWithPartialUpdate, configsEqual, loadConfigFromDisk, saveConfigToDisk } from './config-store'
import { assertDockerConfigCrons } from './cron'
import { clearLogs, createLogger, getLogs } from './logger'
import { createServer } from './server'
import type { AppContext } from './server'
import { DockerRuntimeCache } from './runtime-cache'
import { DockerCookieSourceManager } from './runtime-cookie-source'
import { DOCKER_TIMEZONE, MAIN_DOUYU_URL, YUBA_DOUYU_URL } from './runtime-constants'
import { DockerTaskScheduler } from './runtime-scheduler'
import { formatScheduleForLog } from './runtime-time'
import { createTaskRecord, hasActiveTaskConfig, TASK_LOG_CATEGORIES } from './task-metadata'
import type { TaskType } from './task-metadata'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

let currentConfig: DockerConfig | null = null
let activeConfigPath = ''
let cookieCloudSyncJob: CronJob | null = null
let cookieCloudSyncRunning = false

const logSystem = createLogger('系统')
const taskLoggers: Record<TaskType, (message: string) => void> = createTaskRecord(type => createLogger(TASK_LOG_CATEGORIES[type]))

const runtimeCache = new DockerRuntimeCache()
const cookieSource = new DockerCookieSourceManager(
  () => currentConfig,
  (config) => {
    currentConfig = config
  },
  () => activeConfigPath,
  applyConfig,
  () => runtimeCache.clearFansList(),
  scope => runtimeCache.invalidateStatus(scope),
)
const scheduler = new DockerTaskScheduler(
  logSystem,
  taskLoggers,
  targetUrl => cookieSource.resolveCookieForUrl(targetUrl),
  (scope, runTask) => runtimeCache.runAndInvalidateStatus(scope, runTask),
)

function jsonEquals(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function stopCookieCloudSyncJob(): void {
  if (cookieCloudSyncJob) {
    cookieCloudSyncJob.stop()
    cookieCloudSyncJob = null
  }
}

async function syncCookieCloudSnapshot(reason: 'startup' | 'scheduled'): Promise<void> {
  if (!cookieSource.hasCookieCloudSource()) {
    return
  }
  if (cookieCloudSyncRunning) {
    if (reason === 'scheduled') {
      logSystem('CookieCloud 每日同步仍在执行中，跳过本次触发')
    }
    return
  }

  cookieCloudSyncRunning = true
  try {
    const result = await cookieSource.persistEffectiveCookies(true)
    if (result.updated) {
      logSystem(reason === 'startup'
        ? 'CookieCloud 启动同步完成，本地登录快照已更新'
        : 'CookieCloud 每日同步完成，本地登录快照已更新')
    } else if (reason === 'scheduled') {
      logSystem('CookieCloud 每日同步完成，本地登录快照无需更新')
    }
  } catch (error) {
    logSystem(`${reason === 'startup' ? 'CookieCloud 启动同步' : 'CookieCloud 每日同步'}失败: ${errorMessage(error)}`)
  } finally {
    cookieCloudSyncRunning = false
  }
}

function startCookieCloudSyncJob(config: DockerConfig): void {
  stopCookieCloudSyncJob()

  if (!cookieSource.hasCookieCloudSource(config)) {
    return
  }

  const cron = config.cookieCloud?.cron || DEFAULT_COOKIE_CLOUD_SYNC_CRON
  const job = new CronJob(cron, () => {
    void syncCookieCloudSnapshot('scheduled')
  }, null, false, DOCKER_TIMEZONE)
  cookieCloudSyncJob = job
  job.start()

  logSystem(`CookieCloud 每日同步已启动, cron: ${cron}, 下次执行: ${formatScheduleForLog(job.nextDate().toISO())}`)
  void syncCookieCloudSnapshot('startup')
}

function reconcileCookieCloudSyncJob(prevConfig: DockerConfig | null, nextConfig: DockerConfig): void {
  const nextShouldRun = cookieSource.hasCookieCloudSource(nextConfig)
  const wasRunning = Boolean(cookieCloudSyncJob)
  const configChanged = !jsonEquals(prevConfig?.cookieCloud || null, nextConfig.cookieCloud || null)

  if (!nextShouldRun) {
    if (wasRunning) {
      stopCookieCloudSyncJob()
    }
    return
  }

  if (!wasRunning || configChanged) {
    startCookieCloudSyncJob(nextConfig)
  }
}

function hasConfiguredJobs(config: DockerConfig): boolean {
  return hasActiveTaskConfig(config)
}

function hasSendRooms(config: JobConfig | DoubleCardConfig | ExpiringGiftConfig | null | undefined): boolean {
  return Object.keys(config?.send || {}).length > 0
}

function applyConfig(config: DockerConfig, reason: 'startup' | 'cookie_saved' | 'tasks_saved' | 'ui_saved' | 'medal_synced'): void {
  const nextConfig = normalizeDockerConfig(config)
  const prevConfig = currentConfig
  assertDockerConfigCrons(nextConfig)
  currentConfig = nextConfig

  if (
    prevConfig?.cookie !== nextConfig.cookie
    || !jsonEquals(prevConfig?.manualCookies || null, nextConfig.manualCookies || null)
    || !jsonEquals(prevConfig?.cookieCloud || null, nextConfig.cookieCloud || null)
  ) {
    cookieSource.clearCookieCloudCache()
    runtimeCache.clearFansList()
    runtimeCache.invalidateStatus('all')
  } else {
    if (
      !jsonEquals(prevConfig?.keepalive || null, nextConfig.keepalive || null)
      || !jsonEquals(prevConfig?.doubleCard || null, nextConfig.doubleCard || null)
      || !jsonEquals(prevConfig?.expiringGift || null, nextConfig.expiringGift || null)
    ) {
      runtimeCache.invalidateStatus('fans')
    }
    if (!jsonEquals(prevConfig?.yubaCheckIn || null, nextConfig.yubaCheckIn || null)) {
      runtimeCache.invalidateStatus('yuba')
    }
  }
  reconcileCookieCloudSyncJob(prevConfig, nextConfig)

  if (!cookieSource.hasConfiguredCookieSource(currentConfig)) {
    if (reason === 'startup') {
      logSystem('配置已加载，但登录凭证为空，请通过 WebUI 填写 Cookie 或启用 CookieCloud')
    } else if (hasConfiguredJobs(currentConfig)) {
      scheduler.stopJobs()
      logSystem('任务配置已保存，但登录凭证为空，任务未启动')
    } else if (reason === 'tasks_saved') {
      scheduler.stopJobs()
      logSystem('任务配置已保存，可继续保存 Cookie 或启用 CookieCloud')
    } else {
      scheduler.stopJobs()
      logSystem('登录凭证为空，请先保存 Cookie 或启用 CookieCloud')
    }
    return
  }

  if (!hasConfiguredJobs(currentConfig)) {
    scheduler.stopJobs()
    if (reason === 'startup') {
      logSystem('配置已加载，但未启用任何任务')
    } else if (reason === 'cookie_saved') {
      logSystem('登录凭证已更新，可继续配置任务')
    } else {
      logSystem('任务配置已保存，但未启用任何任务')
    }
    return
  }

  const summary = scheduler.reconcileTaskJobs(prevConfig, currentConfig, cookieSource.hasConfiguredCookieSource(currentConfig))
  scheduler.logTaskReloadSummary(reason, summary)
}

async function syncConfigWithFans(reason: 'tasks_saved' | 'medal_synced', baseConfig?: DockerConfig): Promise<{ config: DockerConfig; fans: Fans[] }> {
  const sourceConfig = normalizeDockerConfig(baseConfig || currentConfig || createDefaultDockerConfig())
  const cookie = cookieSource.resolveCookieForUrlFromConfig(MAIN_DOUYU_URL, sourceConfig)
  const fans = await runtimeCache.getFansList(cookie)
  const nextConfig = reconcileDockerConfig(sourceConfig, fans)
  runtimeCache.invalidateStatus('fans')

  if (!configsEqual(currentConfig, nextConfig)) {
    saveConfigToDisk(activeConfigPath, nextConfig)
    applyConfig(nextConfig, reason)
  }

  return {
    config: nextConfig,
    fans,
  }
}

export interface DockerRuntimeOptions {
  configPath: string
  webPassword: string
  webPort: number
}

export function startDockerRuntime(options: DockerRuntimeOptions): void {
  const { configPath, webPassword, webPort } = options
  activeConfigPath = configPath
  logSystem('斗鱼粉丝牌续牌 Docker 版启动')

  try {
    const config = loadConfigFromDisk(configPath)
    if (config) {
      logSystem('配置加载成功')
      saveConfigToDisk(configPath, config)
      applyConfig(config, 'startup')
    } else {
      const defaultConfig = createDefaultDockerConfig()
      saveConfigToDisk(configPath, defaultConfig)
      currentConfig = defaultConfig
      logSystem('已生成默认配置文件，请通过 WebUI 填写登录凭证和任务配置')
    }
  } catch (error: unknown) {
    logSystem(`配置加载失败: ${errorMessage(error)}`)
  }

  const ctx: AppContext = {
    webPassword,
    getConfig: () => currentConfig,
    saveCookie: (cookies: ManualCookieConfig) => {
      const nextConfig = buildConfigWithPartialUpdate(currentConfig, {})
      nextConfig.manualCookies = {
        main: cookies.main.trim(),
        yuba: cookies.yuba.trim(),
      }
      nextConfig.cookie = nextConfig.manualCookies.main || nextConfig.manualCookies.yuba || ''
      saveConfigToDisk(configPath, nextConfig)
      applyConfig(nextConfig, 'cookie_saved')
    },
    saveTaskConfig: async (config: {
      manualCookies?: ManualCookieConfig
      cookieCloud?: DockerConfig['cookieCloud']
      collectGift?: CollectGiftConfig | null
      keepalive?: JobConfig | null
      doubleCard?: DoubleCardConfig | null
      expiringGift?: ExpiringGiftConfig | null
      yubaCheckIn?: DockerConfig['yubaCheckIn'] | null
      ui?: DockerConfig['ui']
    }) => {
      const nextConfig = buildConfigWithPartialUpdate(currentConfig, config)
      const hasCookieSourcePayload = config.cookieCloud !== undefined || config.manualCookies !== undefined
      const hasTaskPayload = config.collectGift !== undefined
        || config.keepalive !== undefined
        || config.doubleCard !== undefined
        || config.expiringGift !== undefined
        || config.yubaCheckIn !== undefined
      const needsFanSync = config.keepalive !== undefined || config.doubleCard !== undefined || config.expiringGift !== undefined

      assertDockerConfigCrons(nextConfig)
      if (needsFanSync && cookieSource.hasConfiguredCookieSource(nextConfig)) {
        return await syncConfigWithFans('tasks_saved', nextConfig)
      }

      saveConfigToDisk(configPath, nextConfig)
      if (hasTaskPayload) {
        applyConfig(nextConfig, 'tasks_saved')
      } else if (hasCookieSourcePayload) {
        applyConfig(nextConfig, 'cookie_saved')
      } else {
        currentConfig = nextConfig
        logSystem('界面偏好已更新')
      }
      return {
        config: nextConfig,
        fans: [],
      }
    },
    syncWithFans: async () => await syncConfigWithFans('medal_synced'),
    getStatus: () => scheduler.getStatus(),
    getLogs: () => getLogs(),
    clearLogs: () => clearLogs(),
    inspectCookieSource: async () => await cookieSource.inspectCookieSource(),
    getEffectiveCookies: async (forceRefresh?: boolean) => await cookieSource.getEffectiveCookies(forceRefresh),
    persistEffectiveCookies: async (forceRefresh?: boolean) => await cookieSource.persistEffectiveCookies(forceRefresh),
    triggerTask: async (type: TaskType) => await scheduler.triggerTask(type, currentConfig, hasSendRooms),
    fetchFans: async () => {
      const cookie = cookieSource.resolveCookieForUrl(MAIN_DOUYU_URL)
      return await runtimeCache.getFansList(cookie)
    },
    fetchFansStatusBase: async () => {
      const cookie = cookieSource.resolveCookieForUrl(MAIN_DOUYU_URL)
      return await runtimeCache.getFansStatusBase(cookie)
    },
    fetchFansStatusDetails: async () => {
      const cookie = cookieSource.resolveCookieForUrl(MAIN_DOUYU_URL)
      return await runtimeCache.getFansStatus(cookie, logSystem)
    },
    fetchFansStatus: async () => {
      const cookie = cookieSource.resolveCookieForUrl(MAIN_DOUYU_URL)
      return await runtimeCache.getFansStatus(cookie, logSystem)
    },
    fetchYubaStatus: async () => {
      return await runtimeCache.getYubaStatus(async () => {
        const mainCookie = cookieSource.resolveCookieForUrl(MAIN_DOUYU_URL)
        const yubaCookie = cookieSource.resolveCookieForUrl(YUBA_DOUYU_URL)
        const groups = await getFollowedYubaStatusesWithDyToken(yubaCookie, mainCookie)
        return { groups }
      })
    },
  }

  const app = createServer(ctx)
  app.listen(webPort, '0.0.0.0', () => {
    logSystem(`WebUI 已启动: http://0.0.0.0:${webPort}`)
  })

  const shutdown = () => {
    logSystem('收到停止信号，正在关闭...')
    stopCookieCloudSyncJob()
    scheduler.stopJobs()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
