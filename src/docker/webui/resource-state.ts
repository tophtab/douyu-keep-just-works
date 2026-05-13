import type { DockerConfig, Fans, FansStatusResponse, FanStatus, GiftStatus, YubaGroupStatus, YubaStatusResponse } from '../../core/types'
import { ref } from 'vue'
import {
  DEFAULT_COLLECT_GIFT_CRON,
  DEFAULT_COOKIE_CLOUD_SYNC_CRON,
  DEFAULT_DOUBLE_CARD_CRON,
  DEFAULT_DOUBLE_CARD_GIFT_SCOPE,
  DEFAULT_DOUBLE_CARD_MODEL,
  DEFAULT_EXPIRING_GIFT_CRON,
  DEFAULT_EXPIRING_GIFT_MODEL,
  DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
  DEFAULT_KEEPALIVE_CRON,
  DEFAULT_KEEPALIVE_MODEL,
  DEFAULT_THEME_MODE,
  DEFAULT_YUBA_CHECK_IN_CRON,
  DEFAULT_YUBA_CHECK_IN_MODE,
} from '../../core/task-defaults'
import type { WebUiPageTab } from './navigation'
import { requestJson } from './request'
import { showToast } from './toast'

type ResourceKey = 'fansSync' | 'fansList' | 'fansStatus' | 'yubaStatus'

interface RawConfigResponse {
  exists?: unknown
  data?: unknown
}

export interface WebUiOverview {
  collectGiftConfigured?: boolean
  cookieSaved?: boolean
  doubleCardConfigured?: boolean
  doubleCardRooms?: number
  expiringGiftConfigured?: boolean
  expiringGiftRooms?: number
  keepaliveConfigured?: boolean
  keepaliveRooms?: number
  ready?: boolean
  status?: Record<string, { lastRun?: string | null, nextRun?: string | null, running?: boolean } | undefined>
  yubaCheckInConfigured?: boolean
}

export interface LogEntry {
  timestamp: string
  category: string
  message: string
}

interface RawLogEntry {
  timestamp?: unknown
  category?: unknown
  message?: unknown
}

interface ManagedFansResponse {
  config?: DockerConfig
  fans?: Fans[]
}

interface ResourceRequest {
  pending: Promise<unknown> | null
  fetchedAt: number
  requestSeq: number
}

export const DEFAULT_RAW_CONFIG: DockerConfig = {
  cookie: '',
  manualCookies: {
    main: '',
    yuba: '',
  },
  cookieCloud: {
    active: false,
    endpoint: '',
    uuid: '',
    password: '',
    cron: DEFAULT_COOKIE_CLOUD_SYNC_CRON,
    cryptoType: 'legacy',
  },
  ui: { themeMode: DEFAULT_THEME_MODE },
  collectGift: { active: true, cron: DEFAULT_COLLECT_GIFT_CRON },
  yubaCheckIn: { active: false, cron: DEFAULT_YUBA_CHECK_IN_CRON, mode: DEFAULT_YUBA_CHECK_IN_MODE },
  keepalive: { active: true, cron: DEFAULT_KEEPALIVE_CRON, model: DEFAULT_KEEPALIVE_MODEL, send: {} },
  doubleCard: {
    active: true,
    cron: DEFAULT_DOUBLE_CARD_CRON,
    model: DEFAULT_DOUBLE_CARD_MODEL,
    giftScope: DEFAULT_DOUBLE_CARD_GIFT_SCOPE,
    send: {},
    enabled: {},
  },
  expiringGift: {
    active: false,
    cron: DEFAULT_EXPIRING_GIFT_CRON,
    thresholdHours: DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
    model: DEFAULT_EXPIRING_GIFT_MODEL,
    send: {},
  },
}

export const rawConfig = ref<DockerConfig | null>(null)
export const overview = ref<WebUiOverview | null>(null)
export const logs = ref<LogEntry[]>([])
export const logsRefreshedAt = ref<string | null>(null)
export const logsLoading = ref(false)
export const logsClearing = ref(false)
export const logsAutoRefresh = ref(true)
export const managed = ref<ManagedFansResponse | null>(null)
export const managedLoading = ref(false)
export const fansListError = ref('')
export const fansListLoaded = ref(false)
export const fansStatus = ref<FanStatus[]>([])
export const fansStatusLoading = ref(false)
export const fansStatusLoaded = ref(false)
export const fansStatusDetailsLoading = ref(false)
export const fansStatusDetailsLoaded = ref(false)
export const giftStatus = ref<GiftStatus | null>(null)
export const yubaStatus = ref<YubaGroupStatus[]>([])
export const yubaStatusError = ref('')
export const yubaStatusLoaded = ref(false)
export const yubaStatusLoading = ref(false)

const resourceRequests: Record<ResourceKey, ResourceRequest> = {
  fansSync: createResourceRequest(),
  fansList: createResourceRequest(),
  fansStatus: createResourceRequest(),
  yubaStatus: createResourceRequest(),
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createResourceRequest(): ResourceRequest {
  return {
    pending: null,
    fetchedAt: 0,
    requestSeq: 0,
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function normalizeLogs(data: unknown): LogEntry[] {
  if (!Array.isArray(data)) {
    return []
  }

  return data.map(item => ({
    timestamp: item && typeof item === 'object' && 'timestamp' in item ? String(item.timestamp || '') : '',
    category: item && typeof item === 'object' && 'category' in item ? String(item.category || '') : '',
    message: item && typeof item === 'object' && 'message' in item ? String(item.message || '') : '',
  }))
}

function getResourceRequest(key: ResourceKey): ResourceRequest {
  return resourceRequests[key]
}

function clearResourceError(key: ResourceKey): void {
  if (key === 'fansList') {
    fansListError.value = ''
  }
  if (key === 'yubaStatus') {
    yubaStatusError.value = ''
  }
}

function markResourceLoaded(key: ResourceKey): void {
  clearResourceError(key)
  getResourceRequest(key).fetchedAt = Date.now()
}

function invalidateResourceRequest(key: ResourceKey): void {
  const resource = getResourceRequest(key)
  resource.pending = null
  resource.fetchedAt = 0
  resource.requestSeq += 1
  clearResourceError(key)
}

function invalidateResourceRequests(keys: ResourceKey[]): void {
  keys.forEach(invalidateResourceRequest)
}

function trackResourceRequest<T>(resource: ResourceRequest, requestSeq: number, pending: Promise<T>): Promise<T> {
  const tracked = pending.then(
    (value) => {
      if (resource.pending === tracked && resource.requestSeq === requestSeq) {
        resource.pending = null
      }
      return value
    },
    (error: unknown) => {
      if (resource.pending === tracked && resource.requestSeq === requestSeq) {
        resource.pending = null
      }
      throw error
    },
  )
  resource.pending = tracked
  return tracked
}

export function isUnauthorizedError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'status' in error && error.status === 401)
}

export function getRawConfig(): DockerConfig {
  return rawConfig.value || cloneValue(DEFAULT_RAW_CONFIG)
}

export function getManagedConfig(): DockerConfig {
  return managed.value?.config || getRawConfig()
}

export function getManagedFans(): Fans[] {
  if (managed.value?.fans?.length) {
    return managed.value.fans
  }
  if (fansStatus.value.length) {
    return fansStatus.value
  }
  return managed.value?.fans || []
}

export function hasCookieSourceConfigured(config: DockerConfig | null = getRawConfig()): boolean {
  const manualCookies = config?.manualCookies
  const cookieCloud = config?.cookieCloud
  return Boolean(
    String(manualCookies?.main || config?.cookie || '').trim()
    || String(manualCookies?.yuba || '').trim()
    || (
      cookieCloud?.active
      && String(cookieCloud.endpoint || '').trim()
      && String(cookieCloud.uuid || '').trim()
      && String(cookieCloud.password || '').trim()
    ),
  )
}

export function setRawConfig(config: DockerConfig | null): void {
  rawConfig.value = config
}

export function setManagedFans(nextFans: Fans[]): void {
  managed.value = {
    config: getManagedConfig(),
    fans: Array.isArray(nextFans) ? nextFans : [],
  }
}

function mergeFansWithExistingStatus(nextFans: Fans[]): FanStatus[] {
  const previousByRoom: Record<string, FanStatus> = {}
  fansStatus.value.forEach((fan) => {
    previousByRoom[String(fan.roomId)] = fan
  })

  return (Array.isArray(nextFans) ? nextFans : []).map((fan) => {
    const previous = previousByRoom[String(fan.roomId)]
    if (!previous || typeof (fan as FanStatus).doubleActive === 'boolean') {
      return fan as FanStatus
    }
    const merged: FanStatus = { ...fan }
    if (typeof previous.doubleActive === 'boolean') {
      merged.doubleActive = previous.doubleActive
    }
    if (previous.doubleExpireTime) {
      merged.doubleExpireTime = previous.doubleExpireTime
    }
    return merged
  })
}

function applyFansStatusBase(data: FansStatusResponse): void {
  const nextFans = data?.fans || []
  fansStatus.value = mergeFansWithExistingStatus(nextFans)
  if (data?.gift && data.complete) {
    giftStatus.value = data.gift
  }
  setManagedFans(fansStatus.value)
  fansStatusLoaded.value = true
  fansStatusDetailsLoaded.value = Boolean(data?.complete)
}

function applyFansStatusDetails(data: FansStatusResponse): void {
  fansStatus.value = data?.fans || []
  giftStatus.value = data?.gift || null
  setManagedFans(fansStatus.value)
  fansStatusLoaded.value = true
  fansStatusDetailsLoaded.value = true
}

export function clearCookieBackedData(): void {
  invalidateResourceRequests(['fansSync', 'fansList', 'fansStatus', 'yubaStatus'])
  managed.value = null
  fansStatus.value = []
  giftStatus.value = null
  yubaStatus.value = []
  fansStatusLoading.value = false
  fansStatusLoaded.value = false
  fansStatusDetailsLoading.value = false
  fansStatusDetailsLoaded.value = false
  yubaStatusLoading.value = false
  yubaStatusLoaded.value = false
  fansListError.value = ''
  yubaStatusError.value = ''
  managedLoading.value = false
  fansListLoaded.value = false
}

export function clearProtectedState(): void {
  clearCookieBackedData()
  rawConfig.value = null
  overview.value = null
  logs.value = []
  logsRefreshedAt.value = null
}

export function isActiveRefreshLoading(activeTab: WebUiPageTab): boolean {
  if (activeTab === 'overview' || activeTab === 'expiring-gift') {
    return fansStatusLoading.value || managedLoading.value
  }
  if (activeTab === 'keepalive' || activeTab === 'double-card') {
    return managedLoading.value
  }
  if (activeTab === 'yuba') {
    return yubaStatusLoading.value
  }
  if (activeTab === 'logs') {
    return logsLoading.value || logsClearing.value
  }
  return false
}

export async function loadRawConfig(): Promise<void> {
  const data = await requestJson<RawConfigResponse>('/api/config/raw')
  rawConfig.value = data.exists ? data.data as DockerConfig : cloneValue(DEFAULT_RAW_CONFIG)
}

export async function loadOverview(): Promise<void> {
  overview.value = await requestJson<WebUiOverview>('/api/overview')
}

export async function loadLogs(): Promise<void> {
  logsLoading.value = true

  try {
    logs.value = normalizeLogs(await requestJson<RawLogEntry[]>('/api/logs'))
    logsRefreshedAt.value = new Date().toISOString()
  } catch (error) {
    if (!isUnauthorizedError(error)) {
      showToast(`加载日志失败：${getErrorMessage(error)}`, false)
    }
  } finally {
    logsLoading.value = false
  }
}

export async function clearLogs(): Promise<void> {
  logsClearing.value = true

  try {
    await requestJson('/api/logs', { method: 'DELETE' })
    showToast('日志已清空', true)
    await loadLogs()
    await loadOverview()
  } catch (error) {
    if (!isUnauthorizedError(error)) {
      showToast(`清空日志失败：${getErrorMessage(error)}`, false)
    }
  } finally {
    logsClearing.value = false
  }
}

export function invalidateFansResources(): void {
  invalidateResourceRequests(['fansSync', 'fansList', 'fansStatus'])
}

export async function syncFans(showSuccessToast = false): Promise<unknown> {
  const config = getRawConfig()
  const resource = getResourceRequest('fansSync')
  if (!hasCookieSourceConfigured(config)) {
    invalidateFansResources()
    managedLoading.value = false
    fansStatusLoading.value = false
    fansStatusDetailsLoading.value = false
    showToast('请先保存 Cookie 或启用 CookieCloud', false)
    return undefined
  }

  if (resource.pending) {
    return resource.pending
  }

  const requestSeq = resource.requestSeq + 1
  resource.requestSeq = requestSeq
  managedLoading.value = true
  fansListError.value = ''

  const pending = requestJson<ManagedFansResponse>('/api/fans/reconcile', {
    method: 'POST',
  }).then((data) => {
    if (resource.requestSeq !== requestSeq) {
      return undefined
    }
    managed.value = data
    if (data.config) {
      rawConfig.value = data.config
    }
    managedLoading.value = false
    fansListLoaded.value = true
    markResourceLoaded('fansList')
    invalidateResourceRequest('fansStatus')
    if (showSuccessToast) {
      showToast('粉丝牌与任务配置已同步', true)
    }
    return data
  }).catch((error: unknown) => {
    if (resource.requestSeq !== requestSeq) {
      return undefined
    }
    if (isUnauthorizedError(error)) {
      return undefined
    }
    managedLoading.value = false
    fansListError.value = getErrorMessage(error)
    showToast(`同步粉丝牌失败：${getErrorMessage(error)}`, false)
    return undefined
  })

  return trackResourceRequest(resource, requestSeq, pending)
}

export async function loadFansList(showSuccessToast = false): Promise<unknown> {
  const config = getRawConfig()
  const resource = getResourceRequest('fansList')
  if (!hasCookieSourceConfigured(config)) {
    invalidateResourceRequest('fansList')
    managed.value = null
    managedLoading.value = false
    fansListLoaded.value = false
    if (showSuccessToast) {
      showToast('请先保存 Cookie 或启用 CookieCloud', false)
    }
    return undefined
  }

  if (resource.pending) {
    return resource.pending
  }

  const requestSeq = resource.requestSeq + 1
  resource.requestSeq = requestSeq
  managedLoading.value = true
  fansListError.value = ''

  const pending = requestJson<Fans[]>('/api/fans').then((data) => {
    if (resource.requestSeq !== requestSeq) {
      return undefined
    }
    setManagedFans(data)
    managedLoading.value = false
    fansListLoaded.value = true
    markResourceLoaded('fansList')
    if (showSuccessToast) {
      showToast('粉丝牌列表已加载', true)
    }
    return data
  }).catch((error: unknown) => {
    if (resource.requestSeq !== requestSeq) {
      return undefined
    }
    if (isUnauthorizedError(error)) {
      return undefined
    }
    managedLoading.value = false
    fansListError.value = getErrorMessage(error)
    showToast(`加载粉丝牌列表失败：${getErrorMessage(error)}`, false)
    return undefined
  })

  return trackResourceRequest(resource, requestSeq, pending)
}

export async function loadFansStatus(showSuccessToast = false): Promise<unknown> {
  const config = getRawConfig()
  const resource = getResourceRequest('fansStatus')
  if (!hasCookieSourceConfigured(config)) {
    invalidateResourceRequest('fansStatus')
    fansStatus.value = []
    giftStatus.value = null
    fansStatusLoading.value = false
    fansStatusLoaded.value = false
    fansStatusDetailsLoaded.value = false
    fansStatusDetailsLoading.value = false
    if (showSuccessToast) {
      showToast('请先保存 Cookie 或启用 CookieCloud', false)
    }
    return undefined
  }

  if (resource.pending) {
    return resource.pending
  }

  const requestSeq = resource.requestSeq + 1
  resource.requestSeq = requestSeq
  fansStatusLoading.value = true
  fansStatusDetailsLoading.value = true

  const pending = requestJson<FansStatusResponse>('/api/fans/status/base').then((data) => {
    if (resource.requestSeq !== requestSeq) {
      return null
    }
    applyFansStatusBase(data)
    if (data?.complete) {
      fansStatusLoading.value = false
      fansStatusDetailsLoading.value = false
      markResourceLoaded('fansStatus')
      if (fansStatus.value.length) {
        markResourceLoaded('fansList')
      }
      if (showSuccessToast) {
        showToast('粉丝牌状态已刷新', true)
      }
      return null
    }
    return requestJson<FansStatusResponse>('/api/fans/status/details')
  }).then((data) => {
    if (!data || resource.requestSeq !== requestSeq) {
      return undefined
    }
    applyFansStatusDetails(data)
    fansStatusLoading.value = false
    fansStatusDetailsLoading.value = false
    markResourceLoaded('fansStatus')
    if (fansStatus.value.length) {
      markResourceLoaded('fansList')
    }
    if (showSuccessToast) {
      showToast('粉丝牌状态已刷新', true)
    }
    return data
  }).catch((error: unknown) => {
    if (resource.requestSeq !== requestSeq) {
      return undefined
    }
    fansStatusLoading.value = false
    fansStatusDetailsLoading.value = false
    if (!fansStatusLoaded.value) {
      fansStatus.value = []
      giftStatus.value = null
      fansStatusDetailsLoaded.value = false
    }
    if (isUnauthorizedError(error)) {
      return undefined
    }
    showToast(`加载粉丝牌状态失败：${getErrorMessage(error)}`, false)
    return undefined
  })

  return trackResourceRequest(resource, requestSeq, pending)
}

export async function loadYubaStatus(showSuccessToast = false): Promise<unknown> {
  const config = getRawConfig()
  const resource = getResourceRequest('yubaStatus')
  if (!hasCookieSourceConfigured(config)) {
    invalidateResourceRequest('yubaStatus')
    yubaStatus.value = []
    yubaStatusError.value = ''
    yubaStatusLoaded.value = false
    yubaStatusLoading.value = false
    if (showSuccessToast) {
      showToast('请先保存 Cookie 或启用 CookieCloud', false)
    }
    return undefined
  }

  if (resource.pending) {
    return resource.pending
  }

  const requestSeq = resource.requestSeq + 1
  resource.requestSeq = requestSeq
  yubaStatusError.value = ''
  yubaStatusLoading.value = true

  const pending = requestJson<YubaStatusResponse>('/api/yuba/status').then((data) => {
    if (resource.requestSeq !== requestSeq) {
      return undefined
    }
    yubaStatus.value = data?.groups || []
    yubaStatusError.value = ''
    yubaStatusLoaded.value = true
    yubaStatusLoading.value = false
    markResourceLoaded('yubaStatus')
    if (showSuccessToast) {
      showToast('鱼吧状态已刷新', true)
    }
    return data
  }).catch((error: unknown) => {
    if (resource.requestSeq !== requestSeq) {
      return undefined
    }
    if (isUnauthorizedError(error)) {
      return undefined
    }
    yubaStatus.value = yubaStatusLoaded.value ? yubaStatus.value : []
    yubaStatusError.value = getErrorMessage(error)
    yubaStatusLoading.value = false
    showToast(`加载鱼吧状态失败：${getErrorMessage(error)}`, false)
    return undefined
  })

  return trackResourceRequest(resource, requestSeq, pending)
}

export async function loadActiveTabData(activeTab: WebUiPageTab): Promise<void> {
  const config = getRawConfig()
  if (!hasCookieSourceConfigured(config)) {
    return
  }

  if ((activeTab === 'overview' || activeTab === 'expiring-gift') && !fansStatusLoaded.value) {
    await loadFansStatus(false)
  }
  if ((activeTab === 'keepalive' || activeTab === 'double-card') && !getManagedFans().length && !fansListLoaded.value && !fansListError.value && !managedLoading.value) {
    await loadFansList(false)
  }
  if (activeTab === 'yuba' && config.yubaCheckIn?.mode === 'followed' && !yubaStatusLoaded.value && !yubaStatusLoading.value && !yubaStatusError.value) {
    await loadYubaStatus(false)
  }
  if (activeTab === 'logs' && !logsLoading.value && !logsRefreshedAt.value) {
    await loadLogs()
  }
}

export async function refreshOverviewSurface(activeTab: WebUiPageTab, showSuccessToast = false): Promise<void> {
  await loadRawConfig()
  const config = getRawConfig()
  if (!hasCookieSourceConfigured(config)) {
    clearCookieBackedData()
    await loadOverview()
    if (showSuccessToast) {
      showToast('状态已刷新', true)
    }
    return
  }

  const reloads: Array<Promise<unknown>> = [loadOverview()]
  if (activeTab === 'overview' || activeTab === 'expiring-gift') {
    reloads.push(loadFansStatus(false))
  } else if (activeTab === 'keepalive' || activeTab === 'double-card') {
    reloads.push(loadFansList(false))
  } else if (activeTab === 'yuba') {
    reloads.push(loadYubaStatus(false))
  } else if (activeTab === 'logs') {
    reloads.push(loadLogs())
  }

  await Promise.all(reloads)
  if (showSuccessToast) {
    showToast('状态已刷新', true)
  }
}

export async function loadProtectedData(activeTab: WebUiPageTab, syncCookieCloud: () => Promise<unknown>): Promise<void> {
  await Promise.all([
    loadRawConfig(),
    loadOverview(),
    loadLogs(),
  ])
  await syncCookieCloud()
  await loadActiveTabData(activeTab)
}
