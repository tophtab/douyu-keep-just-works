import type { WebUiRequestError } from './request'
import type { Ref } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { requestJson } from './request'
import { showToast } from './toast'

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

function padDatePart(value: number): string {
  return String(value).padStart(2, '0')
}

function formatShanghaiMinuteFallback(date: Date): string {
  const shanghaiDate = new Date(date.getTime() + 8 * 60 * 60 * 1000)
  return `${shanghaiDate.getUTCFullYear()}-${padDatePart(shanghaiDate.getUTCMonth() + 1)}-${padDatePart(shanghaiDate.getUTCDate())} ${padDatePart(shanghaiDate.getUTCHours())}:${padDatePart(shanghaiDate.getUTCMinutes())}`
}

export function formatDate(value: string | null): string {
  if (!value) {
    return '无'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return String(value)
  }

  try {
    return new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    }).format(date)
  } catch {
    return formatShanghaiMinuteFallback(date)
  }
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
  document.dispatchEvent(new CustomEvent('douyu-keep-webui:config', {
    detail: {
      rawConfig,
      themeMode: getConfiguredThemeMode(rawConfig),
    },
  }))
}

function dispatchOverviewLoaded(overview: unknown): void {
  document.dispatchEvent(new CustomEvent('douyu-keep-webui:overview', {
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
