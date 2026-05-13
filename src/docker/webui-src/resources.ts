import type { WebUiRequestError } from './request'
import { requestJson } from './request'
import { showToast } from './toast'

interface RawConfigResponse {
  exists?: unknown
  data?: unknown
}

type OverviewResponse = Record<string, unknown>

interface LogEntry {
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
}

interface ReadOnlyResource<T> {
  data: T | null
  error: string
  loading: boolean
  load: () => Promise<void>
}

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
      themeMode: getConfiguredThemeMode(rawConfig),
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

function createLegacySystemResourceActions(deps: LegacySystemResourceDeps): LegacySystemResourceActions {
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
      deps.renderOverview()
    },
  })

  const logsResource = createReadOnlyResource<LogEntry[]>({
    loadData: () => requestJson<LogEntry[]>('/api/logs'),
    onError(message, error) {
      if (isUnauthorizedRequest(error, deps)) {
        return
      }
      showResourceError(deps, `加载日志失败：${message}`)
    },
    onSuccess(data) {
      deps.state.logs = Array.isArray(data) ? data : []
      deps.state.logsRefreshedAt = new Date().toISOString()
      deps.renderLogsPage()
    },
  })

  return {
    loadRawConfig: rawConfigResource.load,
    loadOverview: overviewResource.load,
    loadLogs: logsResource.load,
  }
}

export function installLegacySystemResourceBridge(): void {
  window.DOUYU_KEEP_WEBUI_SYSTEM_RESOURCE_ACTIONS = {
    create: createLegacySystemResourceActions,
  }
}
