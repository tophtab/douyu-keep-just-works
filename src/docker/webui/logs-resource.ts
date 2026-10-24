import type { Ref } from 'vue'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { formatDate } from './datetime'
import { clearLogs, loadLogDays, loadLogs, logs, logsAutoRefresh, logsClearing, logsDays, logsError, logsLoading, logsRefreshedAt, logsSelectedDay } from './resource-state'

export function useLogsPage(activeTab: Readonly<Ref<string>>, authenticated: Readonly<Ref<boolean>>) {
  const logBoxRef = ref<HTMLElement | null>(null)
  let autoRefreshTimer: number | undefined

  const isToday = computed(() => !logsSelectedDay.value)
  const activeDayLabel = computed(() => (logsSelectedDay.value ? logsSelectedDay.value : '今天（实时）'))

  const logsSummary = computed(() => {
    if (logsLoading.value && !logsRefreshedAt.value) {
      return '正在加载…'
    }

    const refreshedAt = logsRefreshedAt.value ? formatDate(logsRefreshedAt.value) : '尚未刷新'
    if (logsError.value) {
      return logsRefreshedAt.value
        ? `加载日志失败：${logsError.value}。当前显示上次结果。最近刷新：${refreshedAt}`
        : `加载日志失败：${logsError.value}。请稍后重试。`
    }
    if (!isToday.value) {
      return `${activeDayLabel.value} 共 ${logs.value.length} 条日志（历史只读，保留 30 天）`
    }
    return `当前 ${logs.value.length} 条日志，实时视图最多 500 条；磁盘保留 30 天。最近刷新：${refreshedAt}`
  })

  function selectDay(day: string): void {
    logsSelectedDay.value = day
    void loadLogs()
  }
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
      void loadLogDays()
      void loadLogs()
    }
  })

  onMounted(() => {
    autoRefreshTimer = window.setInterval(() => {
      // 历史日期是静态文件，不需要轮询
      if (!isToday.value) {
        return
      }
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
    isToday,
    logs,
    logsAutoRefresh,
    logsDays,
    logsLoading,
    logsSelectedDay,
    logsSummary,
    logBoxRef,
    refreshLogs: () => loadLogs(true),
    refreshLogDays: () => loadLogDays(),
    selectDay,
  }
}
