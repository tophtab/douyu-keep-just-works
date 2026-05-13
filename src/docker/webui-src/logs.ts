import type { Ref } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { formatDate } from './datetime'
import { requestJson } from './request'
import { getErrorMessage } from './task-shared'
import { showToast } from './toast'

export interface LogEntry {
  timestamp: string
  category: string
  message: string
}

interface LegacyLogsBridge {
  isUnauthorized: (error: unknown) => boolean
  loadOverview?: () => Promise<unknown> | undefined
  sync: (logs: LogEntry[], refreshedAt: string | null) => void
}

const logs = ref<LogEntry[]>([])
const logsRefreshedAt = ref<string | null>(null)
const logsLoading = ref(false)
const logsClearing = ref(false)
const logsAutoRefresh = ref(true)

let legacyLogsBridge: LegacyLogsBridge | null = null

export function bindLegacyLogsBridge(bridge: LegacyLogsBridge): void {
  legacyLogsBridge = bridge
  syncLegacyLogs()
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
  legacyLogsBridge?.sync(logs.value, logsRefreshedAt.value)
}

function showStandaloneResourceError(message: string): void {
  showToast(message, false)
}

export async function loadLogs(): Promise<void> {
  logsLoading.value = true

  try {
    logs.value = normalizeLogs(await requestJson<unknown[]>('/api/logs'))
    logsRefreshedAt.value = new Date().toISOString()
    syncLegacyLogs()
  } catch (error) {
    if (!legacyLogsBridge?.isUnauthorized(error)) {
      showStandaloneResourceError(`加载日志失败：${getErrorMessage(error)}`)
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
    await legacyLogsBridge?.loadOverview?.()
  } catch (error) {
    if (!legacyLogsBridge?.isUnauthorized(error)) {
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
    clearLogs,
    clearingLogs: logsClearing,
    formattedLogs,
    logs,
    logsAutoRefresh,
    logsLoading,
    logsSummary,
    logBoxRef,
    refreshLogs: loadLogs,
  }
}
