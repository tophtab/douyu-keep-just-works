import { getFollowedYubaStatusesWithDyToken } from '../core/yuba'
import type { CookieDiagnostics, DockerConfig, DoubleCardConfig, EffectiveCookiePreview, ExpiringGiftConfig, Fans, FansStatusResponse, JobConfig, LoginCookiesConfig, PassportQrLoginPublicStatus, YubaStatusResponse } from '../core/types'
import { assertDockerConfigCrons } from './cron'
import { buildConfigWithPartialUpdate } from './config-store'
import type { DockerConfigUpdate } from './config-store'
import { clearLogs, getLogs } from './logger'
import { MAIN_DOUYU_URL, YUBA_DOUYU_URL } from './runtime-constants'
import type { DockerRuntimeConfigApplyReason } from './runtime-config-service'
import type { DockerRuntimeFansSyncReason } from './runtime-fans-sync'
import type { JobStatus } from './server'
import type { AppContext, CacheRefreshOptions } from './server-types'
import { hasTaskUpdatePayload, needsFansSyncForTaskUpdate } from './task-metadata'
import type { TaskType } from './task-metadata'

type TaskStatusMap = Record<TaskType, JobStatus>

interface DockerRuntimeAppContextDeps {
  webPassword: string
  getCurrentConfig: () => DockerConfig | null
  getConfigPath: () => string
  setCurrentConfig: (config: DockerConfig) => void
  saveConfig: (configPath: string, config: DockerConfig) => void
  applyConfig: (config: DockerConfig, reason: DockerRuntimeConfigApplyReason) => void
  hasConfiguredCookieSource: (config: DockerConfig | null | undefined) => boolean
  resolveCookieForUrl: (targetUrl: string) => string
  inspectCookieSource: () => Promise<CookieDiagnostics>
  getEffectiveCookies: (forceRefresh?: boolean) => Promise<EffectiveCookiePreview>
  persistEffectiveCookies: (forceRefresh?: boolean) => Promise<{
    config: DockerConfig
    effective: EffectiveCookiePreview
    updated: boolean
  }>
  startPassportQrLogin: () => Promise<PassportQrLoginPublicStatus>
  getPassportQrLoginStatus: () => PassportQrLoginPublicStatus | null
  pollPassportQrLogin: () => Promise<PassportQrLoginPublicStatus>
  cancelPassportQrLogin: () => PassportQrLoginPublicStatus | null
  retryPassportQrLoginYuba: () => Promise<PassportQrLoginPublicStatus>
  syncConfigWithFans: (reason: DockerRuntimeFansSyncReason, baseConfig?: DockerConfig) => Promise<{ config: DockerConfig; fans: Fans[] }>
  getStatus: () => TaskStatusMap
  triggerTask: (
    type: TaskType,
    config: DockerConfig | null,
    hasSendRooms: (config: JobConfig | DoubleCardConfig | ExpiringGiftConfig | null | undefined) => boolean,
  ) => Promise<void>
  getFansList: (cookie: string, options?: CacheRefreshOptions) => Promise<Fans[]>
  getFansStatusBase: (cookie: string, options?: CacheRefreshOptions) => Promise<FansStatusResponse>
  getFansStatus: (cookie: string, logSystem: (message: string) => void, options?: CacheRefreshOptions) => Promise<FansStatusResponse>
  getYubaStatus: (fetchStatus: () => Promise<YubaStatusResponse>, options?: CacheRefreshOptions) => Promise<YubaStatusResponse>
  runWithCookieSourceRetry: <T>(context: string, run: () => Promise<T>) => Promise<T>
  logSystem: (message: string) => void
}

function hasSendRooms(config: JobConfig | DoubleCardConfig | ExpiringGiftConfig | null | undefined): boolean {
  return Object.keys(config?.roomAllocations || {}).length > 0
}

function hasCookieSourcePayload(config: DockerConfigUpdate): boolean {
  return config.cookieCloud !== undefined
    || config.loginCookies !== undefined
    || config.manualCookies !== undefined
    || config.manualPassport !== undefined
}

function hasTaskPayload(config: DockerConfigUpdate): boolean {
  return hasTaskUpdatePayload(config)
}

function needsFansSync(config: DockerConfigUpdate): boolean {
  return needsFansSyncForTaskUpdate(config)
}

export function createRuntimeAppContext(deps: DockerRuntimeAppContextDeps): AppContext {
  return {
    webPassword: deps.webPassword,
    getConfig: () => deps.getCurrentConfig(),
    saveCookie: (cookies: Pick<LoginCookiesConfig, 'main' | 'yuba'>) => {
      const currentLoginCookies = deps.getCurrentConfig()?.loginCookies
      const nextConfig = buildConfigWithPartialUpdate(deps.getCurrentConfig(), {
        loginCookies: {
          passport: currentLoginCookies?.passport || '',
          main: cookies.main.trim(),
          yuba: cookies.yuba.trim(),
        },
      })
      deps.saveConfig(deps.getConfigPath(), nextConfig)
      deps.applyConfig(nextConfig, 'cookie_saved')
    },
    saveTaskConfig: async (config: DockerConfigUpdate) => {
      const nextConfig = buildConfigWithPartialUpdate(deps.getCurrentConfig(), config)
      assertDockerConfigCrons(nextConfig)

      if (needsFansSync(config) && deps.hasConfiguredCookieSource(nextConfig)) {
        return await deps.syncConfigWithFans('tasks_saved', nextConfig)
      }

      deps.saveConfig(deps.getConfigPath(), nextConfig)
      if (hasTaskPayload(config)) {
        deps.applyConfig(nextConfig, 'tasks_saved')
      } else if (hasCookieSourcePayload(config)) {
        deps.applyConfig(nextConfig, 'cookie_saved')
      } else {
        deps.setCurrentConfig(nextConfig)
        deps.logSystem('界面偏好已更新')
      }
      return {
        config: nextConfig,
        fans: [],
      }
    },
    syncWithFans: async () => await deps.syncConfigWithFans('medal_synced'),
    getStatus: () => deps.getStatus(),
    getLogs: () => getLogs(),
    clearLogs: () => clearLogs(),
    inspectCookieSource: async () => await deps.inspectCookieSource(),
    getEffectiveCookies: async (forceRefresh?: boolean) => await deps.getEffectiveCookies(forceRefresh),
    persistEffectiveCookies: async (forceRefresh?: boolean) => await deps.persistEffectiveCookies(forceRefresh),
    startPassportQrLogin: async () => await deps.startPassportQrLogin(),
    getPassportQrLoginStatus: () => deps.getPassportQrLoginStatus(),
    pollPassportQrLogin: async () => await deps.pollPassportQrLogin(),
    cancelPassportQrLogin: () => deps.cancelPassportQrLogin(),
    retryPassportQrLoginYuba: async () => await deps.retryPassportQrLoginYuba(),
    triggerTask: async (type: TaskType) => await deps.triggerTask(type, deps.getCurrentConfig(), hasSendRooms),
    fetchFans: async (options: CacheRefreshOptions = {}) => await deps.runWithCookieSourceRetry('加载粉丝牌列表', async () => {
      const cookie = deps.resolveCookieForUrl(MAIN_DOUYU_URL)
      return await deps.getFansList(cookie, options)
    }),
    fetchFansStatusBase: async (options: CacheRefreshOptions = {}) => await deps.runWithCookieSourceRetry('加载粉丝牌基础状态', async () => {
      const cookie = deps.resolveCookieForUrl(MAIN_DOUYU_URL)
      return await deps.getFansStatusBase(cookie, options)
    }),
    fetchFansStatusDetails: async (options: CacheRefreshOptions = {}) => await deps.runWithCookieSourceRetry('加载粉丝牌详细状态', async () => {
      const cookie = deps.resolveCookieForUrl(MAIN_DOUYU_URL)
      return await deps.getFansStatus(cookie, deps.logSystem, options)
    }),
    fetchFansStatus: async (options: CacheRefreshOptions = {}) => await deps.runWithCookieSourceRetry('加载粉丝牌状态', async () => {
      const cookie = deps.resolveCookieForUrl(MAIN_DOUYU_URL)
      return await deps.getFansStatus(cookie, deps.logSystem, options)
    }),
    fetchYubaStatus: async (options: CacheRefreshOptions = {}) => await deps.runWithCookieSourceRetry('加载鱼吧状态', async () => {
      return await deps.getYubaStatus(async () => {
        const mainCookie = deps.resolveCookieForUrl(MAIN_DOUYU_URL)
        const yubaCookie = deps.resolveCookieForUrl(YUBA_DOUYU_URL)
        const groups = await getFollowedYubaStatusesWithDyToken(yubaCookie, mainCookie)
        return { groups }
      }, options)
    }),
  }
}
