import type { CookieDiagnostics, FanStatus, Fans, FansStatusResponse, GiftStatus } from '../../core/types'
import type { WebUiPageTab } from './navigation'
import { DEFAULT_COOKIE_CLOUD_SYNC_CRON } from '../../core/task-defaults'
import { formatDate } from './datetime'

type LegacyResourceKey = 'fansSync' | 'fansList' | 'fansStatus' | 'yubaStatus'

interface LegacyResourceRequest {
  pending: Promise<unknown> | null
  fetchedAt: number
  requestSeq: number
}

interface LegacyAuthState {
  authenticated: boolean
  checked: boolean
  error: string
  submitting: boolean
}

interface LegacyManagedData {
  config?: unknown
  fans?: Fans[]
}

interface LegacyState {
  activeTab: WebUiPageTab
  auth: LegacyAuthState
  cookieCheck: CookieDiagnostics | null
  fansListError: string
  fansStatus: FanStatus[]
  fansStatusDetailsLoaded: boolean
  fansStatusDetailsLoading: boolean
  fansStatusLoaded: boolean
  fansStatusLoading: boolean
  giftStatus: GiftStatus | null
  logs: unknown[]
  logsRefreshedAt: string | null
  managed: LegacyManagedData | null
  managedLoading: boolean
  overview: unknown
  rawConfig: unknown
  resourceRequests: Record<LegacyResourceKey, LegacyResourceRequest>
  yubaStatus: unknown[]
  yubaStatusError: string
  yubaStatusLoaded: boolean
  yubaStatusLoading: boolean
}

interface LegacyStateDeps {
  defaultRawConfig: unknown
  initialTab: WebUiPageTab
}

interface LegacyCookieCloudConfig {
  active?: boolean
  cron?: string
  cryptoType?: string
  endpoint?: string
  password?: string
  uuid?: string
}

interface LegacyManualCookiesConfig {
  main?: string
  yuba?: string
}

interface LegacyStateHelpers {
  buildCookieCheckText: (result: CookieDiagnostics | null) => string
  getCookieCloudConfig: (config?: unknown) => LegacyCookieCloudConfig
  getCookieSourceLabel: (overview?: unknown, config?: unknown) => string
  getManualCookiesConfig: (config?: unknown) => LegacyManualCookiesConfig
  getRawConfig: () => unknown
  getResourceRequest: (key: LegacyResourceKey) => LegacyResourceRequest
  hasCookieSourceConfigured: (config?: unknown) => boolean
  hasLoadedFansList: () => boolean
  invalidateResourceRequest: (key: LegacyResourceKey) => void
  invalidateResourceRequests: (keys: LegacyResourceKey[]) => void
  isActiveRefreshLoading: () => boolean
  isUnauthorizedError: (error: unknown) => boolean
  markResourceLoaded: (key: LegacyResourceKey) => void
  state: LegacyState
  trackResourceRequest: <T>(resource: LegacyResourceRequest, requestSeq: number, pending: Promise<T>) => Promise<T>
}

interface LegacyManagedDataDeps {
  getRawConfig: () => unknown
  state: LegacyState
}

interface LegacyManagedDataHelpers {
  applyFansStatusBase: (data: FansStatusResponse) => void
  applyFansStatusDetails: (data: FansStatusResponse) => void
  getManagedConfig: () => unknown
  getManagedFans: () => Fans[]
  setManagedFans: (fans: Fans[]) => void
}

interface LegacyProtectedStateDeps {
  invalidateResourceRequests: (keys: LegacyResourceKey[]) => void
  renderRefreshButton: () => void
  state: LegacyState
}

interface LegacyProtectedStateHelpers {
  clearCookieBackedData: () => void
  clearProtectedState: () => void
}

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_MANAGED_DATA?: {
      create: (deps: LegacyManagedDataDeps) => LegacyManagedDataHelpers
    }
    DOUYU_KEEP_WEBUI_PROTECTED_STATE?: {
      create: (deps: LegacyProtectedStateDeps) => LegacyProtectedStateHelpers
    }
    DOUYU_KEEP_WEBUI_STATE?: {
      create: (deps: LegacyStateDeps) => LegacyStateHelpers
    }
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object')
}

function cloneValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function createResourceRequest(): LegacyResourceRequest {
  return {
    pending: null,
    fetchedAt: 0,
    requestSeq: 0,
  }
}

function createStateModule(deps: LegacyStateDeps): LegacyStateHelpers {
  const state: LegacyState = {
    activeTab: deps.initialTab,
    auth: {
      checked: false,
      authenticated: false,
      submitting: false,
      error: '',
    },
    rawConfig: null,
    overview: null,
    managed: null,
    cookieCheck: null,
    logs: [],
    logsRefreshedAt: null,
    fansStatus: [],
    giftStatus: null,
    yubaStatus: [],
    fansStatusLoading: false,
    fansStatusLoaded: false,
    fansStatusDetailsLoading: false,
    fansStatusDetailsLoaded: false,
    yubaStatusLoading: false,
    yubaStatusLoaded: false,
    fansListError: '',
    yubaStatusError: '',
    managedLoading: false,
    resourceRequests: {
      fansSync: createResourceRequest(),
      fansList: createResourceRequest(),
      fansStatus: createResourceRequest(),
      yubaStatus: createResourceRequest(),
    },
  }

  function getRawConfig(): unknown {
    if (state.rawConfig) {
      return state.rawConfig
    }
    return cloneValue(deps.defaultRawConfig)
  }

  function getCookieCloudConfig(config?: unknown): LegacyCookieCloudConfig {
    const source = config ?? getRawConfig()
    if (isRecord(source) && isRecord(source.cookieCloud)) {
      return source.cookieCloud
    }
    return {
      active: false,
      endpoint: '',
      uuid: '',
      password: '',
      cron: DEFAULT_COOKIE_CLOUD_SYNC_CRON,
      cryptoType: 'legacy',
    }
  }

  function getManualCookiesConfig(config?: unknown): LegacyManualCookiesConfig {
    const source = config ?? getRawConfig()
    if (isRecord(source) && isRecord(source.manualCookies)) {
      return source.manualCookies
    }
    return {
      main: isRecord(source) ? String(source.cookie || '') : '',
      yuba: '',
    }
  }

  function hasCookieSourceConfigured(config?: unknown): boolean {
    const source = config ?? getRawConfig()
    const cookieCloud = getCookieCloudConfig(source)
    const manualCookies = getManualCookiesConfig(source)
    return Boolean(
      String(manualCookies.main || '').trim()
      || String(manualCookies.yuba || '').trim()
      || (
        cookieCloud.active
        && String(cookieCloud.endpoint || '').trim()
        && String(cookieCloud.uuid || '').trim()
        && String(cookieCloud.password || '').trim()
      ),
    )
  }

  function getCookieSourceLabel(_overview?: unknown, config?: unknown): string {
    const cookieCloud = getCookieCloudConfig(config)
    if (cookieCloud.active) {
      return 'CookieCloud'
    }
    return '手填'
  }

  function buildCookieCheckText(result: CookieDiagnostics | null): string {
    if (!result) {
      const config = getRawConfig()
      const cookieCloud = getCookieCloudConfig(config)
      if (!cookieCloud.active) {
        return '启用后会先从 CookieCloud 提取斗鱼主站和鱼吧相关 Cookie，并同步到上方两个本地登录 Cookie 输入框。运行时不会临时再拉 CookieCloud，而是直接使用这里保存的本地快照。'
      }
      if (!String(cookieCloud.endpoint || '').trim() || !String(cookieCloud.uuid || '').trim() || !String(cookieCloud.password || '').trim()) {
        return 'CookieCloud 已启用，但 endpoint / UUID / 密码 还没填完整。'
      }
      return 'CookieCloud 已启用。系统会在启动时同步一次，并按这里配置的同步 Cron 自动刷新本地登录 Cookie。点击“同步并校验”会先同步 CookieCloud，再检查当前结果是否齐全。'
    }

    const sourceLabel = result.source === 'cookieCloud' ? 'CookieCloud' : '手填 Cookie'
    const mainText = result.mainCookieReady
      ? '主站请求就绪'
      : `主站缺少 ${(result.missingMainKeys || []).join(', ')}`
    const yubaText = result.yubaCookieReady
      ? '完整鱼吧 Cookie 就绪'
      : `完整鱼吧 Cookie 缺少 ${(result.missingYubaCookieKeys || result.missingYubaKeys || []).join(', ')}`
    const yubaDyTokenText = result.yubaDyTokenReady
      ? '鱼吧 dy-token 就绪'
      : `鱼吧 dy-token 缺少 ${(result.missingYubaDyTokenKeys || []).join(', ')}`
    let meta = `来源: ${sourceLabel}，Cookie 数: ${result.cookieCount || 0}`
    if (result.updateTime) {
      meta += `，更新时间: ${formatDate(result.updateTime)}`
    }
    return `${meta}。${mainText}；${yubaDyTokenText}；${yubaText}。`
  }

  function isUnauthorizedError(error: unknown): boolean {
    return Boolean(error && typeof error === 'object' && 'status' in error && error.status === 401)
  }

  function getResourceRequest(key: LegacyResourceKey): LegacyResourceRequest {
    return state.resourceRequests[key]
  }

  function hasLoadedFansList(): boolean {
    return Boolean(getResourceRequest('fansList').fetchedAt)
  }

  function clearResourceError(key: LegacyResourceKey): void {
    if (key === 'fansList') {
      state.fansListError = ''
    }
    if (key === 'yubaStatus') {
      state.yubaStatusError = ''
    }
  }

  function markResourceLoaded(key: LegacyResourceKey): void {
    clearResourceError(key)
    getResourceRequest(key).fetchedAt = Date.now()
  }

  function invalidateResourceRequest(key: LegacyResourceKey): void {
    const resource = getResourceRequest(key)
    resource.pending = null
    resource.fetchedAt = 0
    resource.requestSeq += 1
    clearResourceError(key)
  }

  function invalidateResourceRequests(keys: LegacyResourceKey[]): void {
    keys.forEach(invalidateResourceRequest)
  }

  function trackResourceRequest<T>(resource: LegacyResourceRequest, requestSeq: number, pending: Promise<T>): Promise<T> {
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

  function isActiveRefreshLoading(): boolean {
    if (state.activeTab === 'overview' || state.activeTab === 'expiring-gift') {
      return state.fansStatusLoading || state.managedLoading
    }
    if (state.activeTab === 'keepalive' || state.activeTab === 'double-card') {
      return state.managedLoading
    }
    if (state.activeTab === 'yuba') {
      return state.yubaStatusLoading
    }
    return false
  }

  return {
    state,
    getRawConfig,
    getCookieCloudConfig,
    getManualCookiesConfig,
    hasCookieSourceConfigured,
    getCookieSourceLabel,
    buildCookieCheckText,
    isUnauthorizedError,
    getResourceRequest,
    hasLoadedFansList,
    markResourceLoaded,
    invalidateResourceRequest,
    invalidateResourceRequests,
    trackResourceRequest,
    isActiveRefreshLoading,
  }
}

function createManagedData(deps: LegacyManagedDataDeps): LegacyManagedDataHelpers {
  const { state, getRawConfig } = deps

  function getManagedConfig(): unknown {
    if (state.managed && state.managed.config) {
      return state.managed.config
    }
    return getRawConfig()
  }

  function getManagedFans(): Fans[] {
    if (state.managed && state.managed.fans && state.managed.fans.length) {
      return state.managed.fans
    }
    if (state.fansStatus.length) {
      return state.fansStatus
    }
    if (state.managed && state.managed.fans) {
      return state.managed.fans
    }
    return []
  }

  function setManagedFans(fans: Fans[]): void {
    state.managed = {
      config: getManagedConfig(),
      fans: Array.isArray(fans) ? fans : [],
    }
  }

  function mergeFansWithExistingStatus(fans: Fans[]): Fans[] {
    const previousByRoom: Record<string, FanStatus> = {}
    state.fansStatus.forEach((fan) => {
      previousByRoom[String(fan.roomId)] = fan
    })

    return (Array.isArray(fans) ? fans : []).map((fan) => {
      const previous = previousByRoom[String(fan.roomId)]
      if (!previous || typeof (fan as FanStatus).doubleActive === 'boolean') {
        return fan
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
    const fans = data && data.fans ? data.fans : []
    state.fansStatus = mergeFansWithExistingStatus(fans)
    if (data && data.gift && data.complete) {
      state.giftStatus = data.gift
    }
    setManagedFans(state.fansStatus)
    state.fansStatusLoaded = true
    state.fansStatusDetailsLoaded = Boolean(data && data.complete)
  }

  function applyFansStatusDetails(data: FansStatusResponse): void {
    state.fansStatus = data && data.fans ? data.fans : []
    state.giftStatus = data && data.gift ? data.gift : null
    setManagedFans(state.fansStatus)
    state.fansStatusLoaded = true
    state.fansStatusDetailsLoaded = true
  }

  return {
    getManagedConfig,
    getManagedFans,
    setManagedFans,
    applyFansStatusBase,
    applyFansStatusDetails,
  }
}

function createProtectedState(deps: LegacyProtectedStateDeps): LegacyProtectedStateHelpers {
  const { state, invalidateResourceRequests, renderRefreshButton } = deps

  function resetCookieBackedState(): void {
    invalidateResourceRequests(['fansSync', 'fansList', 'fansStatus', 'yubaStatus'])
    state.managed = null
    state.fansStatus = []
    state.giftStatus = null
    state.yubaStatus = []
    state.fansStatusLoading = false
    state.fansStatusLoaded = false
    state.fansStatusDetailsLoading = false
    state.fansStatusDetailsLoaded = false
    state.yubaStatusLoading = false
    state.yubaStatusLoaded = false
    state.fansListError = ''
    state.yubaStatusError = ''
    state.managedLoading = false
  }

  function clearProtectedState(): void {
    resetCookieBackedState()
    state.rawConfig = null
    state.overview = null
    state.cookieCheck = null
    state.logs = []
    state.logsRefreshedAt = null
    renderRefreshButton()
  }

  function clearCookieBackedData(): void {
    resetCookieBackedState()
  }

  return {
    clearProtectedState,
    clearCookieBackedData,
  }
}

export function installLegacyStateBridge(): void {
  window.DOUYU_KEEP_WEBUI_STATE = {
    create: createStateModule,
  }
}

export function installLegacyManagedDataBridge(): void {
  window.DOUYU_KEEP_WEBUI_MANAGED_DATA = {
    create: createManagedData,
  }
}

export function installLegacyProtectedStateBridge(): void {
  window.DOUYU_KEEP_WEBUI_PROTECTED_STATE = {
    create: createProtectedState,
  }
}
