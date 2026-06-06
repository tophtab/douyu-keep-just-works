import { ref } from 'vue'
import type { WebUiPageTab } from './navigation'
import {
  clearFansCookieBackedData,
  fansListError,
  fansListLoaded,
  fansStatusError,
  fansStatusLoaded,
  fansStatusLoading,
  getManagedFans,
  loadFansList,
  loadFansStatus,
  managedLoading,
} from './resource-fans'
import {
  getRawConfig,
  hasCookieSourceConfigured,
  loadRawConfig,
  rawConfig,
} from './resource-config'
import { createResourceRequest, resetResourceRequest, runResourceRequest } from './resource-request'
import {
  clearYubaCookieBackedData,
  loadYubaStatus,
  yubaStatusError,
  yubaStatusLoaded,
  yubaStatusLoading,
} from './resource-yuba'
import { requestJson } from './request'
import { getErrorMessage, isHttpUnauthorized } from './task-shared'
import { showToast } from './toast'

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

export const overview = ref<WebUiOverview | null>(null)
export const logs = ref<LogEntry[]>([])
export const logsError = ref('')
export const logsRefreshedAt = ref<string | null>(null)
export const logsLoading = ref(false)
export const logsClearing = ref(false)
export const logsAutoRefresh = ref(true)
export const surfaceRefreshLoading = ref(false)

const logsRequest = createResourceRequest()
let surfaceRefreshPending: Promise<void> | null = null

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

export function isUnauthorizedError(error: unknown): boolean {
  return isHttpUnauthorized(error)
}

export function clearCookieBackedData(): void {
  clearFansCookieBackedData()
  clearYubaCookieBackedData()
}

export function clearProtectedState(): void {
  clearCookieBackedData()
  resetResourceRequest(logsRequest)
  rawConfig.value = null
  overview.value = null
  logs.value = []
  logsError.value = ''
  logsRefreshedAt.value = null
}

export function isActiveRefreshLoading(activeTab: WebUiPageTab): boolean {
  if (surfaceRefreshLoading.value) {
    return true
  }
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

export async function loadOverview(): Promise<void> {
  overview.value = await requestJson<WebUiOverview>('/api/overview')
}

export async function loadLogs(showSuccessToast = false): Promise<boolean | undefined> {
  return runResourceRequest(logsRequest, async ({ isStale }) => {
    logsLoading.value = true
    logsError.value = ''

    try {
      const nextLogs = normalizeLogs(await requestJson<RawLogEntry[]>('/api/logs'))
      if (isStale()) {
        return undefined
      }
      logs.value = nextLogs
      logsRefreshedAt.value = new Date().toISOString()
      return true
    } catch (error) {
      if (isStale()) {
        return undefined
      }
      if (!isUnauthorizedError(error)) {
        logsError.value = getErrorMessage(error)
        if (showSuccessToast) {
          showToast('加载日志失败，请查看页面提示', false)
        }
        return false
      }
      return undefined
    } finally {
      if (!isStale()) {
        logsLoading.value = false
      }
    }
  })
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

export async function loadActiveTabData(activeTab: WebUiPageTab): Promise<void> {
  const config = getRawConfig()
  if (!hasCookieSourceConfigured(config)) {
    return
  }

  if ((activeTab === 'overview' || activeTab === 'expiring-gift') && !fansStatusLoaded.value && !fansStatusError.value) {
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

async function runRefreshOverviewSurface(activeTab: WebUiPageTab, showSuccessToast: boolean, forceRefresh: boolean): Promise<void> {
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
    reloads.push(loadFansStatus(false, forceRefresh))
  } else if (activeTab === 'keepalive' || activeTab === 'double-card') {
    reloads.push(loadFansList(false, forceRefresh))
  } else if (activeTab === 'yuba') {
    reloads.push(loadYubaStatus(false, forceRefresh))
  } else if (activeTab === 'logs') {
    reloads.push(loadLogs())
  }

  const results = await Promise.all(reloads)
  if (showSuccessToast) {
    const refreshFailed = results.includes(false)
    showToast(refreshFailed ? '刷新失败，请查看页面提示' : '状态已刷新', !refreshFailed)
  }
}

export async function refreshOverviewSurface(activeTab: WebUiPageTab, showSuccessToast = false, forceRefresh = false): Promise<void> {
  if (surfaceRefreshPending) {
    return await surfaceRefreshPending
  }

  surfaceRefreshLoading.value = true
  const pending = runRefreshOverviewSurface(activeTab, showSuccessToast, forceRefresh).finally(() => {
    if (surfaceRefreshPending === pending) {
      surfaceRefreshPending = null
      surfaceRefreshLoading.value = false
    }
  })
  surfaceRefreshPending = pending
  return await pending
}

export async function loadProtectedData(activeTab: WebUiPageTab): Promise<void> {
  await Promise.all([
    loadRawConfig(),
    loadOverview(),
    loadLogs(),
  ])
  await loadActiveTabData(activeTab)
}
