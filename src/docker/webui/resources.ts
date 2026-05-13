import type { Fans, FanStatus, FansStatusResponse, GiftStatus, YubaGroupStatus } from '../../core/types'
import type { WebUiRequestError } from './request'
import type { Ref } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { WEBUI_BRIDGE_EVENTS } from './bridge-contract'
import { formatDate } from './datetime'
import { requestJson } from './request'
import { showToast } from './toast'

export { formatDate } from './datetime'

interface RawConfigResponse {
  exists?: unknown
  data?: unknown
}

type OverviewResponse = Record<string, unknown>

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

interface LegacySystemResourceState {
  rawConfig: unknown
  overview: unknown
  logs: LogEntry[]
  logsRefreshedAt: string | null
}

interface LegacySystemResourceDeps {
  state: LegacySystemResourceState
  toast?: (message: string, ok: boolean) => void
  isUnauthorizedError?: (error: unknown) => boolean
  defaultRawConfig: unknown
  renderAll: () => void
  renderOverview: () => void
  renderLogsPage: () => void
}

interface LegacySystemResourceActions {
  loadRawConfig: () => Promise<void>
  loadOverview: () => Promise<void>
  loadLogs: () => Promise<void>
  clearLogs: () => Promise<void>
}

interface LegacyResourceRequest {
  pending: Promise<unknown> | null
  requestSeq: number
}

interface LegacyFansManagedResponse {
  config?: unknown
  fans?: Fans[]
}

interface LegacyFansResourceState {
  fansListError: string
  fansStatus: FanStatus[]
  fansStatusDetailsLoaded: boolean
  fansStatusDetailsLoading: boolean
  fansStatusLoaded: boolean
  fansStatusLoading: boolean
  giftStatus: GiftStatus | null
  managed: LegacyFansManagedResponse | null
  managedLoading: boolean
  rawConfig: unknown
}

interface LegacyFansResourceDeps {
  applyFansStatusBase: (data: FansStatusResponse) => void
  applyFansStatusDetails: (data: FansStatusResponse) => void
  getRawConfig: () => unknown
  getResourceRequest: (key: 'fansSync' | 'fansList' | 'fansStatus') => LegacyResourceRequest
  hasCookieSourceConfigured: (config?: unknown) => boolean
  invalidateResourceRequest: (key: 'fansSync' | 'fansList' | 'fansStatus') => void
  invalidateResourceRequests: (keys: Array<'fansSync' | 'fansList' | 'fansStatus'>) => void
  isUnauthorizedError: (error: unknown) => boolean
  markResourceLoaded: (key: 'fansList' | 'fansStatus') => void
  renderAll: () => void
  renderExpiringGiftPage: () => void
  renderOverview: () => void
  setManagedFans: (fans: Fans[]) => void
  state: LegacyFansResourceState
  toast: (message: string, ok: boolean) => void
  trackResourceRequest: <T>(resource: LegacyResourceRequest, requestSeq: number, pending: Promise<T>) => Promise<T>
}

interface LegacyFansResourceActions {
  loadFansList: (showToast?: boolean) => Promise<unknown>
  loadFansStatus: (showToast?: boolean) => Promise<unknown>
  syncFans: (showToast?: boolean) => Promise<unknown>
}

interface LegacyYubaResourceActions {
  loadYubaStatus: (showToast?: boolean) => Promise<unknown>
}

interface LegacyResourceActionState extends LegacySystemResourceState, LegacyFansResourceState {
  activeTab: string
  auth: {
    authenticated: boolean
  }
  yubaStatus: YubaGroupStatus[]
  yubaStatusError: string
  yubaStatusLoaded: boolean
  yubaStatusLoading: boolean
}

interface LegacyResourceActionDeps {
  applyFansStatusBase: (data: FansStatusResponse) => void
  applyFansStatusDetails: (data: FansStatusResponse) => void
  defaultRawConfig: unknown
  getRawConfig: () => unknown
  getResourceRequest: (key: 'fansSync' | 'fansList' | 'fansStatus' | 'yubaStatus') => LegacyResourceRequest
  hasCookieSourceConfigured: (config?: unknown) => boolean
  invalidateResourceRequest: (key: 'fansSync' | 'fansList' | 'fansStatus' | 'yubaStatus') => void
  invalidateResourceRequests: (keys: Array<'fansSync' | 'fansList' | 'fansStatus' | 'yubaStatus'>) => void
  isUnauthorizedError: (error: unknown) => boolean
  markResourceLoaded: (key: 'fansList' | 'fansStatus' | 'yubaStatus') => void
  renderAll: () => void
  renderExpiringGiftPage: () => void
  renderLogsPage: () => void
  renderOverview: () => void
  renderYubaPage: () => void
  setManagedFans: (fans: Fans[]) => void
  state: LegacyResourceActionState
  toast: (message: string, ok: boolean) => void
  trackResourceRequest: <T>(resource: LegacyResourceRequest, requestSeq: number, pending: Promise<T>) => Promise<T>
}

interface LegacyResourceActions extends LegacySystemResourceActions, LegacyFansResourceActions, LegacyYubaResourceActions {
  refreshOverviewSurface: (showToast?: boolean) => Promise<unknown>
}

interface ReadOnlyResource<T> {
  data: T | null
  error: string
  loading: boolean
  load: () => Promise<void>
}

const logs = ref<LogEntry[]>([])
const logsRefreshedAt = ref<string | null>(null)
const logsLoading = ref(false)
const logsClearing = ref(false)
const logsAutoRefresh = ref(true)

let legacyDeps: LegacySystemResourceDeps | null = null
let legacyLoadOverview: (() => Promise<void>) | null = null

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_SYSTEM_RESOURCE_ACTIONS?: {
      create: (deps: LegacySystemResourceDeps) => LegacySystemResourceActions
    }
    DOUYU_KEEP_WEBUI_FANS_RESOURCE_ACTIONS?: {
      create: (deps: LegacyFansResourceDeps) => LegacyFansResourceActions
    }
    DOUYU_KEEP_WEBUI_RESOURCE_ACTIONS?: {
      create: (deps: LegacyResourceActionDeps) => LegacyResourceActions
    }
  }
}

function cloneDefaultRawConfig(defaultRawConfig: unknown): unknown {
  return JSON.parse(JSON.stringify(defaultRawConfig))
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isUnauthorizedRequest(error: unknown, deps: LegacySystemResourceDeps): boolean {
  if (deps.isUnauthorizedError?.(error)) {
    return true
  }

  return Boolean(error && typeof error === 'object' && (error as WebUiRequestError).status === 401)
}

function showResourceError(deps: LegacySystemResourceDeps, message: string): void {
  if (deps.toast) {
    deps.toast(message, false)
    return
  }

  showToast(message, false)
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

function syncLegacyLogs(): void {
  if (!legacyDeps) {
    return
  }

  legacyDeps.state.logs = logs.value
  legacyDeps.state.logsRefreshedAt = logsRefreshedAt.value
}

function showStandaloneResourceError(message: string): void {
  if (legacyDeps) {
    showResourceError(legacyDeps, message)
    return
  }

  showToast(message, false)
}

function getConfiguredThemeMode(rawConfig: unknown): string {
  if (!rawConfig || typeof rawConfig !== 'object' || !('ui' in rawConfig)) {
    return 'system'
  }

  const ui = rawConfig.ui
  if (!ui || typeof ui !== 'object' || !('themeMode' in ui)) {
    return 'system'
  }

  return String(ui.themeMode || 'system')
}

function dispatchConfigLoaded(rawConfig: unknown): void {
  document.dispatchEvent(new CustomEvent(WEBUI_BRIDGE_EVENTS.config, {
    detail: {
      rawConfig,
      themeMode: getConfiguredThemeMode(rawConfig),
    },
  }))
}

function dispatchOverviewLoaded(overview: unknown): void {
  document.dispatchEvent(new CustomEvent(WEBUI_BRIDGE_EVENTS.overview, {
    detail: {
      overview,
    },
  }))
}

function createReadOnlyResource<T>(options: {
  loadData: () => Promise<T>
  onError: (message: string, error: unknown) => void
  onSuccess: (data: T) => void
}): ReadOnlyResource<T> {
  const resource: ReadOnlyResource<T> = {
    data: null,
    error: '',
    loading: false,
    async load() {
      resource.loading = true
      resource.error = ''

      try {
        const data = await options.loadData()
        resource.data = data
        options.onSuccess(data)
      } catch (error) {
        resource.error = getErrorMessage(error)
        options.onError(resource.error, error)
      } finally {
        resource.loading = false
      }
    },
  }

  return resource
}

async function loadLogs(): Promise<void> {
  logsLoading.value = true

  try {
    logs.value = normalizeLogs(await requestJson<RawLogEntry[]>('/api/logs'))
    logsRefreshedAt.value = new Date().toISOString()
    syncLegacyLogs()
  } catch (error) {
    if (!legacyDeps || !isUnauthorizedRequest(error, legacyDeps)) {
      showStandaloneResourceError(`加载日志失败：${getErrorMessage(error)}`)
    }
  } finally {
    logsLoading.value = false
  }
}

async function clearLogs(): Promise<void> {
  logsClearing.value = true

  try {
    await requestJson('/api/logs', { method: 'DELETE' })
    showToast('日志已清空', true)
    await loadLogs()
    await legacyLoadOverview?.()
  } catch (error) {
    if (!legacyDeps || !isUnauthorizedRequest(error, legacyDeps)) {
      showStandaloneResourceError(`清空日志失败：${getErrorMessage(error)}`)
    }
  } finally {
    logsClearing.value = false
  }
}

export function useLogsPage(activeTab: Readonly<Ref<string>>, authenticated: Readonly<Ref<boolean>>) {
  const logBoxRef = ref<HTMLElement | null>(null)
  let autoRefreshTimer: number | undefined

  const logsSummary = computed(() => {
    if (logsLoading.value && !logsRefreshedAt.value) {
      return '仅保留最近 500 条日志，正在加载…'
    }

    const refreshedAt = logsRefreshedAt.value ? formatDate(logsRefreshedAt.value) : '尚未刷新'
    return `当前 ${logs.value.length} 条日志，仅保留最近 500 条。最近刷新：${refreshedAt}`
  })
  const formattedLogs = computed(() => logs.value.map(log => ({
    ...log,
    timestamp: formatDate(log.timestamp),
  })))

  function refreshLogs(): Promise<void> {
    return loadLogs()
  }

  function clearLogsFromPage(): Promise<void> {
    return clearLogs()
  }

  watch(logs, async () => {
    await nextTick()
    if (logBoxRef.value) {
      logBoxRef.value.scrollTop = logBoxRef.value.scrollHeight
    }
  })

  watch([activeTab, authenticated], ([nextTab, nextAuthenticated]) => {
    if (nextAuthenticated && nextTab === 'logs' && !logsLoading.value) {
      void loadLogs()
    }
  })

  onMounted(() => {
    autoRefreshTimer = window.setInterval(() => {
      if (authenticated.value && activeTab.value === 'logs' && logsAutoRefresh.value && !logsLoading.value) {
        void loadLogs()
      }
    }, 5000)
  })

  onBeforeUnmount(() => {
    if (autoRefreshTimer !== undefined) {
      window.clearInterval(autoRefreshTimer)
    }
  })

  return {
    clearLogs: clearLogsFromPage,
    clearingLogs: logsClearing,
    formattedLogs,
    logs,
    logsAutoRefresh,
    logsLoading,
    logsSummary,
    logBoxRef,
    refreshLogs,
  }
}

function createLegacySystemResourceActions(deps: LegacySystemResourceDeps): LegacySystemResourceActions {
  legacyDeps = deps

  const rawConfigResource = createReadOnlyResource<RawConfigResponse>({
    loadData: () => requestJson<RawConfigResponse>('/api/config/raw'),
    onError(message, error) {
      if (isUnauthorizedRequest(error, deps)) {
        return
      }
      showResourceError(deps, `加载配置失败：${message}`)
    },
    onSuccess(data) {
      deps.state.rawConfig = data.exists ? data.data : cloneDefaultRawConfig(deps.defaultRawConfig)
      dispatchConfigLoaded(deps.state.rawConfig)
      deps.renderAll()
    },
  })

  const overviewResource = createReadOnlyResource<OverviewResponse>({
    loadData: () => requestJson<OverviewResponse>('/api/overview'),
    onError(message, error) {
      if (isUnauthorizedRequest(error, deps)) {
        return
      }
      showResourceError(deps, `加载概览失败：${message}`)
    },
    onSuccess(data) {
      deps.state.overview = data
      dispatchOverviewLoaded(data)
      deps.renderOverview()
    },
  })
  legacyLoadOverview = overviewResource.load

  return {
    loadRawConfig: rawConfigResource.load,
    loadOverview: overviewResource.load,
    loadLogs,
    clearLogs,
  }
}

export function installLegacySystemResourceBridge(): void {
  window.DOUYU_KEEP_WEBUI_SYSTEM_RESOURCE_ACTIONS = {
    create: createLegacySystemResourceActions,
  }
}

function createLegacyFansResourceActions(deps: LegacyFansResourceDeps): LegacyFansResourceActions {
  const state = deps.state

  function syncFans(showToast?: boolean): Promise<unknown> {
    const rawConfig = deps.getRawConfig()
    const resource = deps.getResourceRequest('fansSync')
    if (!deps.hasCookieSourceConfigured(rawConfig)) {
      deps.invalidateResourceRequests(['fansSync', 'fansList', 'fansStatus'])
      state.managedLoading = false
      state.fansStatusLoading = false
      state.fansStatusDetailsLoading = false
      deps.toast('请先保存 Cookie 或启用 CookieCloud', false)
      deps.renderAll()
      return Promise.resolve()
    }

    if (resource.pending) {
      return resource.pending
    }

    const requestSeq = resource.requestSeq + 1
    resource.requestSeq = requestSeq
    state.managedLoading = true
    state.fansListError = ''
    deps.renderAll()

    const pending = requestJson<LegacyFansManagedResponse>('/api/fans/reconcile', {
      method: 'POST',
    }).then((data) => {
      if (resource.requestSeq !== requestSeq) {
        return
      }
      state.managed = data
      state.rawConfig = data.config
      state.managedLoading = false
      deps.markResourceLoaded('fansList')
      deps.invalidateResourceRequest('fansStatus')
      deps.renderAll()
      if (showToast) {
        deps.toast('粉丝牌与任务配置已同步', true)
      }
    }).catch((error: unknown) => {
      if (resource.requestSeq !== requestSeq) {
        return
      }
      if (deps.isUnauthorizedError(error)) {
        return
      }
      state.managedLoading = false
      state.fansListError = getErrorMessage(error)
      deps.renderAll()
      deps.toast(`同步粉丝牌失败：${getErrorMessage(error)}`, false)
    })

    return deps.trackResourceRequest(resource, requestSeq, pending)
  }

  function loadFansList(showToast?: boolean): Promise<unknown> {
    const rawConfig = deps.getRawConfig()
    const resource = deps.getResourceRequest('fansList')
    if (!deps.hasCookieSourceConfigured(rawConfig)) {
      deps.invalidateResourceRequest('fansList')
      state.managed = null
      state.managedLoading = false
      deps.renderAll()
      if (showToast) {
        deps.toast('请先保存 Cookie 或启用 CookieCloud', false)
      }
      return Promise.resolve()
    }

    if (resource.pending) {
      return resource.pending
    }

    const requestSeq = resource.requestSeq + 1
    resource.requestSeq = requestSeq
    state.managedLoading = true
    state.fansListError = ''
    deps.renderAll()

    const pending = requestJson<Fans[]>('/api/fans').then((data) => {
      if (resource.requestSeq !== requestSeq) {
        return
      }
      deps.setManagedFans(data)
      state.managedLoading = false
      deps.markResourceLoaded('fansList')
      deps.renderAll()
      if (showToast) {
        deps.toast('粉丝牌列表已加载', true)
      }
    }).catch((error: unknown) => {
      if (resource.requestSeq !== requestSeq) {
        return
      }
      if (deps.isUnauthorizedError(error)) {
        return
      }
      state.managedLoading = false
      state.fansListError = getErrorMessage(error)
      deps.renderAll()
      deps.toast(`加载粉丝牌列表失败：${getErrorMessage(error)}`, false)
    })

    return deps.trackResourceRequest(resource, requestSeq, pending)
  }

  function loadFansStatus(showToast?: boolean): Promise<unknown> {
    const rawConfig = deps.getRawConfig()
    const resource = deps.getResourceRequest('fansStatus')
    if (!deps.hasCookieSourceConfigured(rawConfig)) {
      deps.invalidateResourceRequest('fansStatus')
      state.fansStatus = []
      state.giftStatus = null
      state.fansStatusLoading = false
      state.fansStatusLoaded = false
      state.fansStatusDetailsLoaded = false
      state.fansStatusDetailsLoading = false
      deps.renderOverview()
      deps.renderExpiringGiftPage()
      if (showToast) {
        deps.toast('请先保存 Cookie 或启用 CookieCloud', false)
      }
      return Promise.resolve()
    }

    if (resource.pending) {
      return resource.pending
    }

    const requestSeq = resource.requestSeq + 1
    resource.requestSeq = requestSeq
    state.fansStatusLoading = true
    state.fansStatusDetailsLoading = true
    deps.renderOverview()
    deps.renderExpiringGiftPage()

    const pending = requestJson<FansStatusResponse>('/api/fans/status/base').then((data) => {
      if (resource.requestSeq !== requestSeq) {
        return null
      }
      deps.applyFansStatusBase(data)
      deps.renderOverview()
      deps.renderExpiringGiftPage()
      if (data && data.complete) {
        state.fansStatusLoading = false
        state.fansStatusDetailsLoading = false
        deps.markResourceLoaded('fansStatus')
        if (state.fansStatus.length) {
          deps.markResourceLoaded('fansList')
        }
        deps.renderOverview()
        deps.renderExpiringGiftPage()
        if (showToast) {
          deps.toast('粉丝牌状态已刷新', true)
        }
        return null
      }
      return requestJson<FansStatusResponse>('/api/fans/status/details')
    }).then((data) => {
      if (!data || resource.requestSeq !== requestSeq) {
        return
      }
      deps.applyFansStatusDetails(data)
      state.fansStatusLoading = false
      state.fansStatusDetailsLoading = false
      deps.markResourceLoaded('fansStatus')
      if (state.fansStatus.length) {
        deps.markResourceLoaded('fansList')
      }
      deps.renderOverview()
      deps.renderExpiringGiftPage()
      if (showToast) {
        deps.toast('粉丝牌状态已刷新', true)
      }
    }).catch((error: unknown) => {
      if (resource.requestSeq !== requestSeq) {
        return
      }
      state.fansStatusLoading = false
      state.fansStatusDetailsLoading = false
      if (!state.fansStatusLoaded) {
        state.fansStatus = []
        state.giftStatus = null
        state.fansStatusDetailsLoaded = false
      }
      deps.renderOverview()
      deps.renderExpiringGiftPage()
      if (deps.isUnauthorizedError(error)) {
        return
      }
      deps.toast(`加载粉丝牌状态失败：${getErrorMessage(error)}`, false)
    })

    return deps.trackResourceRequest(resource, requestSeq, pending)
  }

  return {
    loadFansList,
    loadFansStatus,
    syncFans,
  }
}

export function installLegacyFansResourceBridge(): void {
  window.DOUYU_KEEP_WEBUI_FANS_RESOURCE_ACTIONS = {
    create: createLegacyFansResourceActions,
  }
}

function createLegacyResourceActions(deps: LegacyResourceActionDeps): LegacyResourceActions {
  const systemActions = createLegacySystemResourceActions(deps)
  const fansActions = createLegacyFansResourceActions(deps)
  const yubaActions = window.DOUYU_KEEP_WEBUI_YUBA_RESOURCE_ACTIONS?.create(deps)

  const loadRawConfig = systemActions.loadRawConfig
  const loadOverview = systemActions.loadOverview
  const loadLogs = systemActions.loadLogs
  const syncFans = fansActions.syncFans
  const loadFansList = fansActions.loadFansList
  const loadFansStatus = fansActions.loadFansStatus
  const loadYubaStatus = yubaActions?.loadYubaStatus || (() => Promise.resolve())

  function refreshOverviewSurface(showSuccessToast?: boolean): Promise<unknown> {
    return loadRawConfig().then(() => {
      if (!deps.state.auth.authenticated) {
        return undefined
      }

      const rawConfig = deps.getRawConfig()
      if (!deps.hasCookieSourceConfigured(rawConfig)) {
        deps.invalidateResourceRequests(['fansSync', 'fansList', 'fansStatus', 'yubaStatus'])
        deps.state.managed = null
        deps.state.fansStatus = []
        deps.state.giftStatus = null
        deps.state.managedLoading = false
        deps.state.fansStatusLoading = false
        deps.state.fansStatusLoaded = false
        deps.state.fansStatusDetailsLoaded = false
        deps.state.fansStatusDetailsLoading = false
        deps.state.yubaStatus = []
        deps.state.yubaStatusLoaded = false
        deps.state.yubaStatusLoading = false
        deps.renderAll()
        return loadOverview().then(() => {
          if (showSuccessToast) {
            deps.toast('状态已刷新', true)
          }
        })
      }

      const reloads: Array<Promise<unknown>> = [loadOverview()]
      if (deps.state.activeTab === 'overview' || deps.state.activeTab === 'expiring-gift') {
        reloads.push(loadFansStatus(false))
      } else if (deps.state.activeTab === 'keepalive' || deps.state.activeTab === 'double-card') {
        reloads.push(loadFansList(false))
      } else if (deps.state.activeTab === 'yuba') {
        reloads.push(loadYubaStatus(false))
      } else if (deps.state.activeTab === 'logs') {
        reloads.push(loadLogs())
      }

      return Promise.all(reloads).then(() => {
        if (showSuccessToast) {
          deps.toast('状态已刷新', true)
        }
      })
    })
  }

  return {
    loadRawConfig,
    loadOverview,
    loadLogs,
    clearLogs: systemActions.clearLogs,
    syncFans,
    loadFansList,
    loadFansStatus,
    loadYubaStatus,
    refreshOverviewSurface,
  }
}

export function installLegacyResourceActionsBridge(): void {
  window.DOUYU_KEEP_WEBUI_RESOURCE_ACTIONS = {
    create: createLegacyResourceActions,
  }
}
