import * as path from 'node:path'
import process from 'node:process'
import { errorMessage } from '../core/errors'
import { createDefaultDockerConfig } from '../core/config-normalization'
import type { DockerConfig } from '../core/types'
import { WebPasswordStore } from './auth-password'
import { loadConfigFromDisk, saveConfigToDisk } from './config-store'
import { createLogger, initLogStore } from './logger'
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
import { createTaskRecord, getTaskConfig, hasEnabledTaskConfig, isTaskEnabled, TASK_LABELS, TASK_LOG_CATEGORIES, TASK_TYPES } from './task-metadata'
import { buildCookieStatus } from './runtime-cookie-status'
import { currentDayKey, getPushChannelSettings, getTodayLastRun, initRunHistory, notifyLoginRequired, sendDailyReport, sendTestCard, setPushChannelConfig, setPushChannelResolver } from './runtime-notify'
import { DockerReportScheduler } from './runtime-report'
import type { TaskType } from './task-metadata'

let currentConfig: DockerConfig | null = null
let activeConfigPath = ''

const logSystem = createLogger('系统')
const taskLoggers: Record<TaskType, (message: string) => void> = createTaskRecord(type => createLogger(TASK_LOG_CATEGORIES[type]))

const runtimeCache = new DockerRuntimeCache()
const cookieSource = new DockerCookieSourceManager({
  getConfig: () => currentConfig,
  setConfig: updateCurrentConfig,
  getConfigPath: () => activeConfigPath,
  applyConfig,
  clearFansListCache: () => runtimeCache.clearFansList(),
  invalidateStatusCaches: scope => runtimeCache.invalidateStatus(scope),
})

const cookieRecovery = new DockerRuntimeCookieRecoveryService({
  hasPassportRecoveryMaterial: () => cookieSource.hasPassportRecoveryMaterial(),
  recoverCredentialSnapshot: async options => await cookieSource.recoverCredentialSnapshot(options),
  validateMainCookie: async (mainCookie) => {
    await runtimeCache.getFansList(mainCookie)
  },
  logSystem,
})

const scheduler = new DockerTaskScheduler({
  logSystem,
  taskLoggers,
  resolveCookieForUrl: targetUrl => cookieSource.resolveCookieForUrl(targetUrl),
  refreshCookieSourceAfterFailure: async (error, context) => await cookieRecovery.refreshCookieSourceAfterFailure(error, context),
  runAndInvalidateStatusCache: (scope, runTask) => runtimeCache.runAndInvalidateStatus(scope, runTask),
})

const reportScheduler = new DockerReportScheduler({
  getConfig: () => currentConfig,
  getConfigPath: () => activeConfigPath,
  logSystem,
})

/**
 * 所有配置变更都从这里落地。
 * 界面偏好（例如 pushReport）不会走 applyConfig，如果只在 runtimeConfigService 里
 * reconcile 推送调度器，修改推送时间后要重启才生效。
 */
function updateCurrentConfig(config: DockerConfig): void {
  currentConfig = config
  setPushChannelConfig(config.pushChannel)
  reportScheduler.reconcile(config)
}

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
  setCurrentConfig: updateCurrentConfig,
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

  // 密码存储：config/auth.json 优先（界面改过），否则回退 WEB_PASSWORD
  const configDir = path.dirname(path.resolve(configPath))
  const passwordStore = new WebPasswordStore({
    filePath: path.join(configDir, 'auth.json'),
    initialPassword: webPassword,
  })

  // 日志与任务历史落盘：必须在第一条日志之前初始化，否则重启后首屏是空的
  initLogStore(path.join(configDir, 'logs'))
  initRunHistory(configDir)

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
    passwordStore,
    getCurrentConfig: () => currentConfig,
    getConfigPath: () => activeConfigPath,
    setCurrentConfig: updateCurrentConfig,
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
    getPushReportSnapshot: () => {
      const config = currentConfig
      const pushReport = config?.pushReport
      return {
        enabled: Boolean(pushReport?.enabled),
        cron: pushReport?.cron || '',
        configured: Boolean(pushReport?.enabled && pushReport?.cron),
        nextRun: reportScheduler.getNextRun(),
        cookie: buildCookieStatus(config, activeConfigPath),
        channel: getPushChannelSettings(),
        tasks: TASK_TYPES.map((type) => {
          const taskConfig = getTaskConfig(config, type)
          const lastRun = getTodayLastRun(type)
          return {
            type,
            label: TASK_LABELS[type],
            enabled: isTaskEnabled(taskConfig),
            cron: taskConfig?.cron || '',
            lastRun,
          }
        }),
      }
    },
    // 手动「立即推送」看当天已跑的部分；定时日报（默认 09:00）统计前一天，口径不同
    sendPushReportNow: async () => await sendDailyReport(currentConfig, buildCookieStatus(currentConfig, activeConfigPath), { dayKey: currentDayKey() }),
    sendPushTest: async () => await sendTestCard(),
    logSystem,
  })

  const app = createServer(ctx)
  app.listen(webPort, '0.0.0.0', () => {
    logSystem(`WebUI 已启动: http://0.0.0.0:${webPort}`)
  })

  // 有启用中的任务却没有任何登录态时，任务会被静默跳过；启动后主动推一条提醒
  // 渠道配置来自 config.json（界面里可改），没配则回退环境变量。
  // 用 resolver 而非快照，保证 WebUI 改完立刻生效（不走 applyConfig 的路径也能读到）。
  setPushChannelResolver(() => currentConfig?.pushChannel)
  setPushChannelConfig(currentConfig?.pushChannel)
  reportScheduler.reconcile(currentConfig)

  if (currentConfig && hasEnabledTaskConfig(currentConfig) && !cookieSource.hasConfiguredCookieSource(currentConfig)) {
    logSystem('未检测到登录凭证，已启用任务不会执行，等待扫码登录')
    void notifyLoginRequired(process.env.WEB_PORT || webPort)
  }

  const shutdown = () => {
    logSystem('收到停止信号，正在关闭...')
    cookieCloudSync.stop()
    scheduler.stopJobs()
    reportScheduler.stop()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}
