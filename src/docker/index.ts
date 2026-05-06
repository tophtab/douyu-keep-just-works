import * as fs from 'node:fs'
import * as path from 'node:path'
import process from 'node:process'
import { CronJob } from 'cron'
import { getFansList, getGiftStatus, parseCookieRecord } from '../core/api'
import { buildCookieHeaderForUrl, createCookieDiagnostics, fetchCookieCloudSnapshot, isCookieCloudReady } from '../core/cookie-cloud'
import { checkDoubleCard } from '../core/double-card'
import { executeCollectGiftJob, executeDoubleCardJob, executeExpiringGiftJob, executeKeepaliveJob, executeYubaCheckInJob } from '../core/job'
import { createDefaultDockerConfig, normalizeDockerConfig, reconcileDockerConfig } from '../core/medal-sync'
import type { CollectGiftConfig, CookieCloudConfig, CookieDiagnostics, DockerConfig, DoubleCardConfig, EffectiveCookiePreview, ExpiringGiftConfig, FanStatus, Fans, FansStatusResponse, GiftStatus, JobConfig, ManualCookieConfig, YubaCheckInConfig, YubaStatusResponse } from '../core/types'
import { getFollowedYubaStatusesWithDyToken } from '../core/yuba'
import { assertDockerConfigCrons } from './cron'
import { clearLogs, createLogger, getLogs } from './logger'
import { createServer } from './server'
import type { AppContext, JobStatus } from './server'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const CONFIG_PATH = process.env.CONFIG_PATH || '/app/config/config.json'
const WEB_PORT = Number.parseInt(process.env.WEB_PORT || '51417', 10)
const WEB_PASSWORD = process.env.WEB_PASSWORD || 'password'
const DOCKER_TIMEZONE = 'Asia/Shanghai'
const MAIN_DOUYU_URL = 'https://www.douyu.com/'
const YUBA_DOUYU_URL = 'https://yuba.douyu.com/'
const COOKIE_CLOUD_CACHE_TTL_MS = 60 * 1000
const DEFAULT_COOKIE_CLOUD_SYNC_CRON = '0 5 0 * * *'

type TaskType = 'collectGift' | 'keepalive' | 'doubleCard' | 'expiringGift' | 'yubaCheckIn'
type AppStatus = Record<TaskType, JobStatus>
const TASK_TYPES: TaskType[] = ['collectGift', 'keepalive', 'doubleCard', 'expiringGift', 'yubaCheckIn']

interface CookieCloudCacheEntry {
  key: string
  fetchedAt: number
  snapshot: Awaited<ReturnType<typeof fetchCookieCloudSnapshot>>
}

interface TaskReloadSummary {
  started: TaskType[]
  restarted: TaskType[]
  stopped: TaskType[]
}

let currentConfig: DockerConfig | null = null
let cookieCloudCache: CookieCloudCacheEntry | null = null
let cookieCloudSyncJob: CronJob | null = null
let cookieCloudSyncRunning = false
const jobs: Record<TaskType, CronJob | null> = {
  collectGift: null,
  keepalive: null,
  doubleCard: null,
  expiringGift: null,
  yubaCheckIn: null,
}
const statuses: AppStatus = {
  collectGift: { running: false, lastRun: null, nextRun: null },
  keepalive: { running: false, lastRun: null, nextRun: null },
  doubleCard: { running: false, lastRun: null, nextRun: null },
  expiringGift: { running: false, lastRun: null, nextRun: null },
  yubaCheckIn: { running: false, lastRun: null, nextRun: null },
}
const activeRuns: Record<TaskType, boolean> = {
  collectGift: false,
  keepalive: false,
  doubleCard: false,
  expiringGift: false,
  yubaCheckIn: false,
}

const logSystem = createLogger('系统')
const taskLoggers = {
  collectGift: createLogger('领取'),
  keepalive: createLogger('保活'),
  doubleCard: createLogger('双倍'),
  expiringGift: createLogger('临期'),
  yubaCheckIn: createLogger('鱼吧'),
} satisfies Record<TaskType, (message: string) => void>

function isTaskActive(config: { active?: boolean } | null | undefined): boolean {
  return Boolean(config && config.active !== false)
}

function hasManualCookie(config: DockerConfig | null | undefined): boolean {
  return Boolean(
    config?.manualCookies?.main?.trim()
    || config?.manualCookies?.yuba?.trim()
    || config?.cookie?.trim(),
  )
}

function hasCookieCloudSource(config: DockerConfig | null | undefined): boolean {
  return isCookieCloudReady(config?.cookieCloud)
}

function hasConfiguredCookieSource(config: DockerConfig | null | undefined): boolean {
  return hasManualCookie(config) || hasCookieCloudSource(config)
}

function clearCookieCloudCache(): void {
  cookieCloudCache = null
}

function getCookieCloudCacheKey(config: CookieCloudConfig): string {
  return [config.endpoint, config.uuid, config.password, config.cryptoType || 'legacy'].join('|')
}

async function loadCookieCloudSnapshot(forceRefresh = false): Promise<Awaited<ReturnType<typeof fetchCookieCloudSnapshot>>> {
  const config = currentConfig?.cookieCloud
  if (!config || !hasCookieCloudSource(currentConfig)) {
    throw new Error('CookieCloud 配置不完整')
  }

  const cacheKey = getCookieCloudCacheKey(config)
  if (
    !forceRefresh
    && cookieCloudCache
    && cookieCloudCache.key === cacheKey
    && (Date.now() - cookieCloudCache.fetchedAt) < COOKIE_CLOUD_CACHE_TTL_MS
  ) {
    return cookieCloudCache.snapshot
  }

  const snapshot = await fetchCookieCloudSnapshot(config)
  cookieCloudCache = {
    key: cacheKey,
    fetchedAt: Date.now(),
    snapshot,
  }
  return snapshot
}

function getManualCookieForUrl(targetUrl: string, config: DockerConfig | null | undefined): string {
  const hostname = new URL(targetUrl).hostname
  const mainCookie = config?.manualCookies?.main?.trim() || config?.cookie?.trim() || ''
  const yubaCookie = config?.manualCookies?.yuba?.trim() || ''

  if (hostname === 'yuba.douyu.com') {
    return yubaCookie || mainCookie
  }

  return mainCookie
}

function resolveCookieForUrlFromConfig(targetUrl: string, config: DockerConfig | null | undefined): string {
  const manualCookie = getManualCookieForUrl(targetUrl, config)

  if (manualCookie) {
    return manualCookie
  }

  if (hasCookieCloudSource(config)) {
    throw new Error(`CookieCloud 已启用，但 ${new URL(targetUrl).hostname} 的本地登录快照为空，请先同步 CookieCloud`)
  }

  throw new Error('请先配置 cookie')
}

function resolveCookieForUrl(targetUrl: string): string {
  return resolveCookieForUrlFromConfig(targetUrl, currentConfig)
}

async function getEffectiveCookies(forceRefresh = false): Promise<EffectiveCookiePreview> {
  let mainCookie = getManualCookieForUrl(MAIN_DOUYU_URL, currentConfig)
  let yubaCookie = getManualCookieForUrl(YUBA_DOUYU_URL, currentConfig)
  let source: EffectiveCookiePreview['source'] = hasManualCookie(currentConfig) ? 'manual' : 'none'

  if (hasCookieCloudSource(currentConfig)) {
    const snapshot = await loadCookieCloudSnapshot(forceRefresh)
    const cloudMainCookie = buildCookieHeaderForUrl(snapshot.cookies, MAIN_DOUYU_URL)
    const cloudYubaCookie = buildCookieHeaderForUrl(snapshot.cookies, YUBA_DOUYU_URL)

    if (cloudMainCookie || cloudYubaCookie) {
      mainCookie = cloudMainCookie || mainCookie
      yubaCookie = cloudYubaCookie || yubaCookie || mainCookie
      source = hasManualCookie(currentConfig) ? 'hybrid' : 'cookieCloud'
    }
  }

  if (!mainCookie && !yubaCookie) {
    throw new Error('请先配置 cookie')
  }

  const resolvedYubaCookie = yubaCookie || mainCookie
  const persistedLocally = currentConfig?.manualCookies?.main?.trim() === mainCookie
    && currentConfig?.manualCookies?.yuba?.trim() === resolvedYubaCookie

  return {
    source,
    mainCookie,
    yubaCookie: resolvedYubaCookie,
    cookieCloudActive: hasCookieCloudSource(currentConfig),
    persistedLocally,
  }
}

async function persistEffectiveCookies(forceRefresh = false, options: {
  reloadJobs?: boolean
} = {}): Promise<{
  config: DockerConfig
  effective: EffectiveCookiePreview
  updated: boolean
}> {
  const effective = await getEffectiveCookies(forceRefresh)
  const nextConfig = buildConfigWithPartialUpdate(currentConfig, {
    manualCookies: {
      main: effective.mainCookie.trim(),
      yuba: effective.yubaCookie.trim(),
    },
  })

  if (configsEqual(currentConfig, nextConfig)) {
    return {
      config: nextConfig,
      effective,
      updated: false,
    }
  }

  saveConfigToDisk(nextConfig)
  if (options.reloadJobs) {
    applyConfig(nextConfig, 'cookie_saved')
  } else {
    currentConfig = nextConfig
  }

  return {
    config: nextConfig,
    effective,
    updated: true,
  }
}

async function inspectCookieSource(forceRefresh = false): Promise<CookieDiagnostics> {
  if (hasCookieCloudSource(currentConfig)) {
    const snapshot = await loadCookieCloudSnapshot(forceRefresh)
    return createCookieDiagnostics(
      'cookieCloud',
      buildCookieHeaderForUrl(snapshot.cookies, MAIN_DOUYU_URL),
      buildCookieHeaderForUrl(snapshot.cookies, YUBA_DOUYU_URL),
      {
        cookieCount: snapshot.cookies.length,
        domains: snapshot.domains,
        updateTime: snapshot.updateTime,
      },
    )
  }

  if (hasManualCookie(currentConfig)) {
    const mainCookie = getManualCookieForUrl(MAIN_DOUYU_URL, currentConfig)
    const yubaCookie = getManualCookieForUrl(YUBA_DOUYU_URL, currentConfig)
    return createCookieDiagnostics('manual', mainCookie, yubaCookie, {
      cookieCount: Object.keys({
        ...parseCookieRecord(mainCookie),
        ...parseCookieRecord(yubaCookie),
      }).length,
      domains: ['manual'],
    })
  }

  throw new Error('请先配置 cookie')
}

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

function formatScheduleForLog(value: string | null): string {
  if (!value) {
    return '无'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return `${new Intl.DateTimeFormat('sv-SE', {
    timeZone: DOCKER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)}  (UTC+08:00)`
}

function stopJobs(): void {
  TASK_TYPES.forEach(stopTask)
}

function stopCookieCloudSyncJob(): void {
  if (cookieCloudSyncJob) {
    cookieCloudSyncJob.stop()
    cookieCloudSyncJob = null
  }
}

async function syncCookieCloudSnapshot(reason: 'startup' | 'scheduled'): Promise<void> {
  if (!hasCookieCloudSource(currentConfig)) {
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
    const result = await persistEffectiveCookies(true)
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

  if (!hasCookieCloudSource(config)) {
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

function stopTask(type: TaskType): void {
  const job = jobs[type]
  if (job) {
    job.stop()
    jobs[type] = null
  }
  statuses[type] = createIdleStatus()
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
  logSystem(`${label}已启动, cron: ${cron}, 下次执行: ${formatScheduleForLog(statuses[type].nextRun)}${summary ? `, ${summary}` : ''}`)
}

function getTaskConfig(config: DockerConfig | null | undefined, type: TaskType): DockerConfig[TaskType] {
  switch (type) {
    case 'collectGift':
      return config?.collectGift
    case 'keepalive':
      return config?.keepalive
    case 'doubleCard':
      return config?.doubleCard
    case 'expiringGift':
      return config?.expiringGift
    case 'yubaCheckIn':
      return config?.yubaCheckIn
  }
}

function getTaskLabel(type: TaskType): string {
  switch (type) {
    case 'collectGift':
      return '领取任务'
    case 'keepalive':
      return '保活任务'
    case 'doubleCard':
      return '双倍卡任务'
    case 'expiringGift':
      return '临期任务'
    case 'yubaCheckIn':
      return '鱼吧签到任务'
  }
}

function jsonEquals(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function formatTaskList(types: TaskType[]): string {
  return types.map(getTaskLabel).join('、')
}

function startTask(type: TaskType, config: DockerConfig): void {
  switch (type) {
    case 'collectGift': {
      const collectGiftConfig = config.collectGift
      if (!collectGiftConfig || collectGiftConfig.active === false) {
        return
      }
      startScheduledTask(
        'collectGift',
        '领取任务',
        collectGiftConfig.cron,
        async () => {
          const cookie = resolveCookieForUrl(MAIN_DOUYU_URL)
          await executeCollectGiftJob(cookie, taskLoggers.collectGift)
        },
      )
      return
    }
    case 'keepalive': {
      const keepaliveConfig = config.keepalive
      if (!keepaliveConfig || keepaliveConfig.active === false) {
        return
      }
      startScheduledTask(
        'keepalive',
        '保活任务',
        keepaliveConfig.cron,
        async () => {
          const cookie = resolveCookieForUrl(MAIN_DOUYU_URL)
          await executeKeepaliveJob(keepaliveConfig, cookie, taskLoggers.keepalive)
        },
        `房间数: ${Object.keys(keepaliveConfig.send).length}`,
      )
      return
    }
    case 'doubleCard': {
      const doubleCardConfig = config.doubleCard
      if (!doubleCardConfig || doubleCardConfig.active === false) {
        return
      }
      startScheduledTask(
        'doubleCard',
        '双倍卡任务',
        doubleCardConfig.cron,
        async () => {
          const cookie = resolveCookieForUrl(MAIN_DOUYU_URL)
          await executeDoubleCardJob(doubleCardConfig, cookie, taskLoggers.doubleCard)
        },
        `房间数: ${Object.keys(doubleCardConfig.send).length}`,
      )
      return
    }
    case 'expiringGift': {
      const expiringGiftConfig = config.expiringGift
      if (!expiringGiftConfig || expiringGiftConfig.active === false) {
        return
      }
      startScheduledTask(
        'expiringGift',
        '临期任务',
        expiringGiftConfig.cron,
        async () => {
          const cookie = resolveCookieForUrl(MAIN_DOUYU_URL)
          await executeExpiringGiftJob(expiringGiftConfig, cookie, taskLoggers.expiringGift)
        },
        `阈值: ${expiringGiftConfig.thresholdHours || 24}小时, 房间数: ${Object.keys(expiringGiftConfig.send).length}`,
      )
      return
    }
    case 'yubaCheckIn': {
      const yubaCheckInConfig = config.yubaCheckIn
      if (!yubaCheckInConfig || yubaCheckInConfig.active === false) {
        return
      }
      startScheduledTask(
        'yubaCheckIn',
        '鱼吧签到任务',
        yubaCheckInConfig.cron,
        async () => {
          const mainCookie = resolveCookieForUrl(MAIN_DOUYU_URL)
          const yubaCookie = resolveCookieForUrl(YUBA_DOUYU_URL)
          await executeYubaCheckInJob(yubaCheckInConfig, yubaCookie, mainCookie, taskLoggers.yubaCheckIn)
        },
        `模式: ${yubaCheckInConfig.mode || 'followed'}`,
      )
    }
  }
}

function reconcileTaskJobs(prevConfig: DockerConfig | null, nextConfig: DockerConfig): TaskReloadSummary {
  const summary: TaskReloadSummary = {
    started: [],
    restarted: [],
    stopped: [],
  }
  const hasCookieSource = hasConfiguredCookieSource(nextConfig)

  for (const type of TASK_TYPES) {
    const nextTaskConfig = getTaskConfig(nextConfig, type)
    const nextShouldRun = hasCookieSource && isTaskActive(nextTaskConfig)
    const wasRunning = Boolean(jobs[type])
    const configChanged = !jsonEquals(getTaskConfig(prevConfig, type) || null, nextTaskConfig || null)

    if (!nextShouldRun) {
      if (wasRunning) {
        stopTask(type)
        summary.stopped.push(type)
      }
      continue
    }

    if (!wasRunning) {
      startTask(type, nextConfig)
      summary.started.push(type)
      continue
    }

    if (configChanged) {
      stopTask(type)
      startTask(type, nextConfig)
      summary.restarted.push(type)
    }
  }

  return summary
}

function reconcileCookieCloudSyncJob(prevConfig: DockerConfig | null, nextConfig: DockerConfig): void {
  const nextShouldRun = hasCookieCloudSource(nextConfig)
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

function logTaskReloadSummary(reason: 'startup' | 'cookie_saved' | 'tasks_saved' | 'ui_saved' | 'medal_synced', summary: TaskReloadSummary): void {
  if (reason === 'startup' || reason === 'ui_saved') {
    return
  }

  const parts: string[] = []
  if (summary.started.length) {
    parts.push(`启动: ${formatTaskList(summary.started)}`)
  }
  if (summary.restarted.length) {
    parts.push(`重载: ${formatTaskList(summary.restarted)}`)
  }
  if (summary.stopped.length) {
    parts.push(`停用: ${formatTaskList(summary.stopped)}`)
  }

  if (reason === 'cookie_saved') {
    if (!parts.length) {
      logSystem('登录凭证已更新，现有任务继续运行，无需重启')
      return
    }
    logSystem(`登录凭证已更新，仅调整受影响任务：${parts.join('；')}`)
    return
  }

  if (reason === 'tasks_saved') {
    if (!parts.length) {
      logSystem('任务配置已更新，未重启无关任务')
      return
    }
    logSystem(`任务配置已更新，仅调整受影响任务：${parts.join('；')}`)
    return
  }

  if (!parts.length) {
    logSystem('粉丝牌列表变化，但相关任务配置无需重载')
    return
  }

  logSystem(`粉丝牌列表变化，仅调整受影响任务：${parts.join('；')}`)
}

function hasConfiguredJobs(config: DockerConfig): boolean {
  return isTaskActive(config.collectGift)
    || isTaskActive(config.keepalive)
    || isTaskActive(config.doubleCard)
    || isTaskActive(config.expiringGift)
    || isTaskActive(config.yubaCheckIn)
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
    !jsonEquals(prevConfig?.manualCookies || null, nextConfig.manualCookies || null)
    || !jsonEquals(prevConfig?.cookieCloud || null, nextConfig.cookieCloud || null)
  ) {
    clearCookieCloudCache()
  }
  reconcileCookieCloudSyncJob(prevConfig, nextConfig)

  if (!hasConfiguredCookieSource(currentConfig)) {
    if (reason === 'startup') {
      logSystem('配置已加载，但登录凭证为空，请通过 WebUI 填写 Cookie 或启用 CookieCloud')
    } else if (hasConfiguredJobs(currentConfig)) {
      stopJobs()
      logSystem('任务配置已保存，但登录凭证为空，任务未启动')
    } else if (reason === 'tasks_saved') {
      stopJobs()
      logSystem('任务配置已保存，可继续保存 Cookie 或启用 CookieCloud')
    } else {
      stopJobs()
      logSystem('登录凭证为空，请先保存 Cookie 或启用 CookieCloud')
    }
    return
  }

  if (!hasConfiguredJobs(currentConfig)) {
    stopJobs()
    if (reason === 'startup') {
      logSystem('配置已加载，但未启用任何任务')
    } else if (reason === 'cookie_saved') {
      logSystem('登录凭证已更新，可继续配置任务')
    } else {
      logSystem('任务配置已保存，但未启用任何任务')
    }
    return
  }

  const summary = reconcileTaskJobs(prevConfig, currentConfig)
  logTaskReloadSummary(reason, summary)
}

async function syncConfigWithFans(reason: 'tasks_saved' | 'medal_synced', baseConfig?: DockerConfig): Promise<{ config: DockerConfig; fans: Fans[] }> {
  const sourceConfig = normalizeDockerConfig(baseConfig || currentConfig || createDefaultDockerConfig())
  const cookie = resolveCookieForUrlFromConfig(MAIN_DOUYU_URL, sourceConfig)
  const fans = await getFansList(cookie)
  const nextConfig = reconcileDockerConfig(sourceConfig, fans)

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
  manualCookies?: ManualCookieConfig
  cookieCloud?: DockerConfig['cookieCloud']
  collectGift?: CollectGiftConfig | null
  keepalive?: JobConfig | null
  doubleCard?: DoubleCardConfig | null
  expiringGift?: ExpiringGiftConfig | null
  yubaCheckIn?: YubaCheckInConfig | null
  ui?: DockerConfig['ui']
}): DockerConfig {
  const nextConfig: DockerConfig = {
    cookie: current?.cookie || '',
    ...(updates.manualCookies !== undefined
      ? { manualCookies: updates.manualCookies }
      : (current?.manualCookies ? { manualCookies: current.manualCookies } : {})),
    ...(updates.cookieCloud !== undefined
      ? (updates.cookieCloud ? { cookieCloud: updates.cookieCloud } : {})
      : (current?.cookieCloud ? { cookieCloud: current.cookieCloud } : {})),
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
    ...(updates.expiringGift !== undefined
      ? (updates.expiringGift ? { expiringGift: updates.expiringGift } : {})
      : (current?.expiringGift ? { expiringGift: current.expiringGift } : {})),
    ...(updates.yubaCheckIn !== undefined
      ? (updates.yubaCheckIn ? { yubaCheckIn: updates.yubaCheckIn } : {})
      : (current?.yubaCheckIn ? { yubaCheckIn: current.yubaCheckIn } : {})),
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
      logSystem('已生成默认配置文件，请通过 WebUI 填写登录凭证和任务配置')
    }
  } catch (error: unknown) {
    logSystem(`配置加载失败: ${errorMessage(error)}`)
  }

  const ctx: AppContext = {
    webPassword: WEB_PASSWORD,
    getConfig: () => currentConfig,
    saveCookie: (cookies: ManualCookieConfig) => {
      const nextConfig = buildConfigWithPartialUpdate(currentConfig, {})
      nextConfig.manualCookies = {
        main: cookies.main.trim(),
        yuba: cookies.yuba.trim(),
      }
      nextConfig.cookie = nextConfig.manualCookies.main || nextConfig.manualCookies.yuba || ''
      saveConfigToDisk(nextConfig)
      applyConfig(nextConfig, 'cookie_saved')
    },
    saveTaskConfig: async (config: {
      manualCookies?: ManualCookieConfig
      cookieCloud?: DockerConfig['cookieCloud']
      collectGift?: CollectGiftConfig | null
      keepalive?: JobConfig | null
      doubleCard?: DoubleCardConfig | null
      expiringGift?: ExpiringGiftConfig | null
      yubaCheckIn?: YubaCheckInConfig | null
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
      if (needsFanSync && hasConfiguredCookieSource(nextConfig)) {
        return await syncConfigWithFans('tasks_saved', nextConfig)
      }

      saveConfigToDisk(nextConfig)
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
    getStatus: () => ({
      collectGift: { ...statuses.collectGift },
      keepalive: { ...statuses.keepalive },
      doubleCard: { ...statuses.doubleCard },
      expiringGift: { ...statuses.expiringGift },
      yubaCheckIn: { ...statuses.yubaCheckIn },
    }),
    getLogs: () => getLogs(),
    clearLogs: () => clearLogs(),
    inspectCookieSource: async (forceRefresh?: boolean) => await inspectCookieSource(forceRefresh),
    getEffectiveCookies: async (forceRefresh?: boolean) => await getEffectiveCookies(forceRefresh),
    persistEffectiveCookies: async (forceRefresh?: boolean) => await persistEffectiveCookies(forceRefresh),
    triggerCollectGift: async () => {
      if (!currentConfig?.collectGift) {
        throw new Error('领取任务未配置')
      }
      await runTaskWithLock('collectGift', async () => {
        taskLoggers.collectGift('手动触发执行...')
        const cookie = resolveCookieForUrl(MAIN_DOUYU_URL)
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
      const keepaliveConfig = currentConfig.keepalive
      await runTaskWithLock('keepalive', async () => {
        taskLoggers.keepalive('手动触发执行...')
        const cookie = resolveCookieForUrl(MAIN_DOUYU_URL)
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
      const doubleCardConfig = currentConfig.doubleCard
      await runTaskWithLock('doubleCard', async () => {
        taskLoggers.doubleCard('手动触发执行...')
        const cookie = resolveCookieForUrl(MAIN_DOUYU_URL)
        await executeDoubleCardJob(doubleCardConfig, cookie, taskLoggers.doubleCard)
      }, {
        onBusy: 'throw',
        busyMessage: '任务正在执行中，请稍后再试',
      })
    },
    triggerExpiringGift: async () => {
      if (!currentConfig?.expiringGift || !hasSendRooms(currentConfig.expiringGift)) {
        throw new Error('临期任务未配置')
      }
      const expiringGiftConfig = currentConfig.expiringGift
      await runTaskWithLock('expiringGift', async () => {
        taskLoggers.expiringGift('手动触发执行...')
        const cookie = resolveCookieForUrl(MAIN_DOUYU_URL)
        await executeExpiringGiftJob(expiringGiftConfig, cookie, taskLoggers.expiringGift)
      }, {
        onBusy: 'throw',
        busyMessage: '任务正在执行中，请稍后再试',
      })
    },
    triggerYubaCheckIn: async () => {
      if (!currentConfig?.yubaCheckIn) {
        throw new Error('鱼吧签到任务未配置')
      }
      const yubaCheckInConfig = currentConfig.yubaCheckIn
      await runTaskWithLock('yubaCheckIn', async () => {
        taskLoggers.yubaCheckIn('手动触发执行...')
        const mainCookie = resolveCookieForUrl(MAIN_DOUYU_URL)
        const yubaCookie = resolveCookieForUrl(YUBA_DOUYU_URL)
        await executeYubaCheckInJob(yubaCheckInConfig, yubaCookie, mainCookie, taskLoggers.yubaCheckIn)
      }, {
        onBusy: 'throw',
        busyMessage: '任务正在执行中，请稍后再试',
      })
    },
    fetchFans: async () => {
      const cookie = resolveCookieForUrl(MAIN_DOUYU_URL)
      return await getFansList(cookie)
    },
    fetchFansStatus: async (): Promise<FansStatusResponse> => {
      const cookie = resolveCookieForUrl(MAIN_DOUYU_URL)
      const fans = await getFansList(cookie)
      const fanRoomIds = fans.map(fan => fan.roomId)
      const gift = await getGiftStatus(cookie, fanRoomIds).catch((error: unknown): GiftStatus => {
        const message = errorMessage(error)
        logSystem(`加载粉丝牌状态时无法获取背包明细: ${message}`)
        return {
          error: message,
        }
      })
      const statuses = await Promise.all(fans.map(async (fan): Promise<FanStatus> => {
        try {
          const doubleInfo = await checkDoubleCard(fan.roomId, cookie)
          return {
            ...fan,
            doubleActive: doubleInfo.active,
            doubleExpireTime: doubleInfo.expireTime,
          }
        } catch (error: unknown) {
          logSystem(`加载房间${fan.roomId}双倍状态失败: ${errorMessage(error)}`)
          return {
            ...fan,
            doubleActive: false,
          }
        }
      }))
      return {
        fans: statuses,
        gift,
      }
    },
    fetchYubaStatus: async (): Promise<YubaStatusResponse> => {
      const mainCookie = resolveCookieForUrl(MAIN_DOUYU_URL)
      const yubaCookie = resolveCookieForUrl(YUBA_DOUYU_URL)
      const groups = await getFollowedYubaStatusesWithDyToken(yubaCookie, mainCookie)
      return { groups }
    },
  }

  const app = createServer(ctx)
  app.listen(WEB_PORT, '0.0.0.0', () => {
    logSystem(`WebUI 已启动: http://0.0.0.0:${WEB_PORT}`)
  })

  const shutdown = () => {
    logSystem('收到停止信号，正在关闭...')
    stopCookieCloudSyncJob()
    stopJobs()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

main()
