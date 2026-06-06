import type { Ref } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { formatDate } from './datetime'
import { clearLogs, loadLogs, logs, logsAutoRefresh, logsClearing, logsError, logsLoading, logsRefreshedAt } from './resource-state'

export function useLogsPage(activeTab: Readonly<Ref<string>>, authenticated: Readonly<Ref<boolean>>) {
  const logBoxRef = ref<HTMLElement | null>(null)
  let autoRefreshTimer: number | undefined

  const logsSummary = computed(() => {
    if (logsLoading.value && !logsRefreshedAt.value) {
      return '仅保留最近 500 条日志，正在加载…'
    }

    const refreshedAt = logsRefreshedAt.value ? formatDate(logsRefreshedAt.value) : '尚未刷新'
    if (logsError.value) {
      return logsRefreshedAt.value
        ? `加载日志失败：${logsError.value}。当前显示上次结果。最近刷新：${refreshedAt}`
        : `加载日志失败：${logsError.value}。请稍后重试。`
    }
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
    refreshLogs: () => loadLogs(true),
  }
}
