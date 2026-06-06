import process from 'node:process'
import { errorMessage } from '../core/errors'
import { createDefaultDockerConfig } from '../core/medal-sync'
import type { DockerConfig } from '../core/types'
import { loadConfigFromDisk, saveConfigToDisk } from './config-store'
import { createLogger } from './logger'
import { createServer } from './server'
import { createRuntimeAppContext } from './runtime-app-context'
import { DockerRuntimeCache } from './runtime-cache'
import { DockerRuntimeConfigService } from './runtime-config-service'
import type { DockerRuntimeConfigApplyReason } from './runtime-config-service'
import { DockerCookieCloudSyncService } from './runtime-cookie-cloud-sync'
import { DockerRuntimeCookieRecoveryService } from './runtime-cookie-recovery'
import { DockerCookieSourceManager } from './runtime-cookie-source'
import { DockerRuntimeFansSyncService } from './runtime-fans-sync'
import { DockerTaskScheduler } from './runtime-scheduler'
import { createTaskRecord, TASK_LOG_CATEGORIES } from './task-metadata'
import type { TaskType } from './task-metadata'

let currentConfig: DockerConfig | null = null
let activeConfigPath = ''

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

const cookieRecovery = new DockerRuntimeCookieRecoveryService({
  hasPassportRecoveryMaterial: () => cookieSource.hasPassportRecoveryMaterial(),
  recoverCredentialSnapshot: async options => await cookieSource.recoverCredentialSnapshot(options),
  validateMainCookie: async (mainCookie) => {
    await runtimeCache.getFansList(mainCookie)
  },
  logSystem,
})

const scheduler = new DockerTaskScheduler(
  logSystem,
  taskLoggers,
  targetUrl => cookieSource.resolveCookieForUrl(targetUrl),
  async (error, context) => await cookieRecovery.refreshCookieSourceAfterFailure(error, context),
  (scope, runTask) => runtimeCache.runAndInvalidateStatus(scope, runTask),
)

const cookieCloudSync = new DockerCookieCloudSyncService({
  hasCookieCloudSource: config => cookieSource.hasCookieCloudSource(config),
  logSystem,
  persistEffectiveCookies: async forceRefresh => await cookieSource.persistEffectiveCookies(forceRefresh),
})

const runtimeConfigService = new DockerRuntimeConfigService({
  clearCookieCloudCache: () => cookieSource.clearCookieCloudCache(),
  clearFansListCache: () => runtimeCache.clearFansList(),
  getCurrentConfig: () => currentConfig,
  hasConfiguredCookieSource: config => cookieSource.hasConfiguredCookieSource(config),
  invalidateStatusCaches: scope => runtimeCache.invalidateStatus(scope),
  logSystem,
  logTaskReloadSummary: (reason, summary) => scheduler.logTaskReloadSummary(reason, summary),
  reconcileCookieCloudSync: (prevConfig, nextConfig) => cookieCloudSync.reconcile(prevConfig, nextConfig),
  reconcileTaskJobs: (prevConfig, nextConfig, hasCookieSource) => scheduler.reconcileTaskJobs(prevConfig, nextConfig, hasCookieSource),
  setCurrentConfig: (config) => {
    currentConfig = config
  },
  stopTaskJobs: () => scheduler.stopJobs(),
})

const fansSync = new DockerRuntimeFansSyncService({
  getCurrentConfig: () => currentConfig,
  getConfigPath: () => activeConfigPath,
  hasCookieCloudSource: config => cookieSource.hasCookieCloudSource(config),
  resolveCookieForUrlFromConfig: (targetUrl, config) => cookieSource.resolveCookieForUrlFromConfig(targetUrl, config),
  getFansList: async cookie => await runtimeCache.getFansList(cookie),
  invalidateStatusCaches: scope => runtimeCache.invalidateStatus(scope),
  saveConfig: saveConfigToDisk,
  applyConfig: (config, reason) => applyConfig(config, reason),
  runWithCookieSourceRetry: async (context, run) => await cookieRecovery.runWithCookieSourceRetry(context, run),
})

function applyConfig(config: DockerConfig, reason: DockerRuntimeConfigApplyReason): void {
  runtimeConfigService.applyConfig(config, reason)
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

  const ctx = createRuntimeAppContext({
    webPassword,
    getCurrentConfig: () => currentConfig,
    getConfigPath: () => activeConfigPath,
    setCurrentConfig: (config) => {
      currentConfig = config
    },
    saveConfig: saveConfigToDisk,
    applyConfig,
    hasConfiguredCookieSource: config => cookieSource.hasConfiguredCookieSource(config),
    resolveCookieForUrl: targetUrl => cookieSource.resolveCookieForUrl(targetUrl),
    inspectCookieSource: async () => await cookieSource.inspectCookieSource(),
    getEffectiveCookies: async forceRefresh => await cookieSource.getEffectiveCookies(forceRefresh),
    persistEffectiveCookies: async forceRefresh => await cookieSource.persistEffectiveCookies(forceRefresh),
    startPassportQrLogin: async () => await cookieSource.startPassportQrLogin(),
    getPassportQrLoginStatus: () => cookieSource.getPassportQrLoginStatus(),
    pollPassportQrLogin: async () => await cookieSource.pollPassportQrLogin(),
    cancelPassportQrLogin: () => cookieSource.cancelPassportQrLogin(),
    retryPassportQrLoginYuba: async () => await cookieSource.retryPassportQrLoginYuba(),
    syncConfigWithFans: async (reason, baseConfig) => await fansSync.syncConfigWithFans(reason, baseConfig),
    getStatus: () => scheduler.getStatus(),
    triggerTask: async (type, config, hasSendRooms) => await scheduler.triggerTask(type, config, hasSendRooms),
    getFansList: async (cookie, options) => await runtimeCache.getFansList(cookie, options?.forceRefresh),
    getFansStatusBase: async (cookie, options) => await runtimeCache.getFansStatusBase(cookie, options?.forceRefresh),
    getFansStatus: async (cookie, logger, options) => await runtimeCache.getFansStatus(cookie, logger, options?.forceRefresh),
    getYubaStatus: async (fetchStatus, options) => await runtimeCache.getYubaStatus(fetchStatus, options?.forceRefresh),
    runWithCookieSourceRetry: async (context, run) => await cookieRecovery.runWithCookieSourceRetry(context, run),
    logSystem,
  })

  const app = createServer(ctx)
  app.listen(webPort, '0.0.0.0', () => {
    logSystem(`WebUI 已启动: http://0.0.0.0:${webPort}`)
  })

  const shutdown = () => {
    logSystem('收到停止信号，正在关闭...')
    cookieCloudSync.stop()
    scheduler.stopJobs()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
