import type { PushReportConfig, PushReportSnapshot, TaskRunRecord } from '../../core/types'
import { computed, onMounted, ref } from 'vue'
import { DEFAULT_PUSH_REPORT_CRON } from '../../core/task-defaults'
import { rawConfig } from './resource-config'
import { requestJson } from './request'
import { showToast } from './toast'

const snapshot = ref<PushReportSnapshot | null>(null)
const loading = ref(false)
const saving = ref(false)
const sending = ref(false)

function isPushReportConfig(value: unknown): value is PushReportConfig {
  return Boolean(value) && typeof value === 'object'
}

function currentConfig(): PushReportConfig {
  const fromRaw = isPushReportConfig(rawConfig.value?.pushReport) ? rawConfig.value.pushReport : undefined
  return {
    enabled: fromRaw?.enabled ?? true,
    cron: fromRaw?.cron || DEFAULT_PUSH_REPORT_CRON,
  }
}

export function formatRunTime(record?: TaskRunRecord): string {
  if (!record) {
    return '—'
  }
  const date = new Date(record.finishedAt)
  if (Number.isNaN(date.getTime())) {
    return record.finishedAt
  }
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Shanghai',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

export function formatDuration(record?: TaskRunRecord): string {
  if (!record) {
    return '—'
  }
  const ms = new Date(record.finishedAt).getTime() - new Date(record.startedAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) {
    return '—'
  }
  return ms < 1000 ? `${ms}ms` : `${Math.round(ms / 1000)}s`
}

export function lastLog(record?: TaskRunRecord): string {
  if (!record?.logs?.length) {
    return '—'
  }
  return record.logs[record.logs.length - 1]
}

function cronToTime(cron: string): string {
  const match = /^0\s+(\d{1,2})\s+(\d{1,2})\s+\*\s+\*\s+\*$/.exec(cron.trim())
  if (!match) {
    return ''
  }
  const minute = Number(match[1])
  const hour = Number(match[2])
  if (minute > 59 || hour > 23) {
    return ''
  }
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function timeToCron(time: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(time)
  if (!match) {
    return DEFAULT_PUSH_REPORT_CRON
  }
  return `0 ${Number(match[2])} ${Number(match[1])} * * *`
}

export function usePushReportPage() {
  const enabled = ref(true)
  const cron = ref(DEFAULT_PUSH_REPORT_CRON)
  // 时间选择器与 cron 双向映射：只处理「每天 HH:MM」这种简单表达式
  const time = computed({
    get: () => cronToTime(cron.value),
    set: (value: string) => {
      if (value) {
        cron.value = timeToCron(value)
      }
    },
  })

  function syncFromConfig(): void {
    const config = currentConfig()
    enabled.value = config.enabled
    cron.value = config.cron
  }

  async function loadSnapshot(): Promise<void> {
    loading.value = true
    try {
      snapshot.value = await requestJson<PushReportSnapshot>('/api/push-report', {
        errorToast: '加载推送设置失败：',
      })
      if (snapshot.value) {
        enabled.value = snapshot.value.enabled
        cron.value = snapshot.value.cron || DEFAULT_PUSH_REPORT_CRON
        syncChannelForm()
      }
    } catch {
      // 错误提示已由 requestJson 处理
    } finally {
      loading.value = false
    }
  }

  async function save(): Promise<void> {
    saving.value = true
    try {
      await requestJson('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pushReport: {
            enabled: enabled.value,
            cron: cron.value.trim() || DEFAULT_PUSH_REPORT_CRON,
          },
        }),
        errorToast: '保存推送设置失败：',
      })
      showToast(enabled.value ? '推送设置已保存' : '推送汇总已停用', true)
      await loadSnapshot()
    } catch {
      // 错误提示已由 requestJson 处理
    } finally {
      saving.value = false
    }
  }

  // ---- 渠道配置表单（令牌只显示掩码，留空表示不修改）
  const channelEnabled = ref(true)
  const channelBaseUrl = ref('')
  const channelToken = ref('')
  const channelMode = ref<'card' | 'text'>('card')
  const channelSaving = ref(false)
  const channelTesting = ref(false)

  function syncChannelForm(): void {
    const current = snapshot.value?.channel
    channelEnabled.value = current?.enabled ?? true
    channelBaseUrl.value = current?.baseUrl || ''
    channelMode.value = current?.mode || 'card'
    channelToken.value = ''
  }

  async function saveChannel(): Promise<void> {
    channelSaving.value = true
    try {
      await requestJson('/api/push-report/channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: channelEnabled.value,
          baseUrl: channelBaseUrl.value.trim(),
          mode: channelMode.value,
          token: channelToken.value.trim(),
        }),
        errorToast: '保存推送渠道失败：',
      })
      showToast('推送渠道已保存', true)
      await loadSnapshot()
      syncChannelForm()
    } catch {
      // 错误提示已由 requestJson 处理
    } finally {
      channelSaving.value = false
    }
  }

  async function testChannel(): Promise<void> {
    channelTesting.value = true
    try {
      await requestJson('/api/push-report/test', {
        method: 'POST',
        errorToast: '测试推送失败：',
      })
      showToast('测试消息已发送', true)
    } catch {
      // 错误提示已由 requestJson 处理
    } finally {
      channelTesting.value = false
    }
  }

  async function sendNow(): Promise<void> {
    sending.value = true
    try {
      await requestJson('/api/push-report/send', {
        method: 'POST',
        errorToast: '推送失败：',
      })
      showToast('已推送今日汇总到飞书', true)
      await loadSnapshot()
    } catch {
      // 错误提示已由 requestJson 处理
    } finally {
      sending.value = false
    }
  }

  const channel = computed(() => snapshot.value?.channel)
  const cookie = computed(() => snapshot.value?.cookie)
  const cookieHealthy = computed(() => Boolean(cookie.value && !cookie.value.error && cookie.value.ltp0Present && cookie.value.mainReady))
  const tasks = computed(() => snapshot.value?.tasks ?? [])
  const enabledTasks = computed(() => tasks.value.filter(task => task.enabled))
  const summary = computed(() => {
    const list = enabledTasks.value
    const ok = list.filter(task => task.lastRun?.ok).length
    const fail = list.filter(task => task.lastRun && !task.lastRun.ok).length
    return {
      total: list.length,
      ok,
      fail,
      idle: list.length - ok - fail,
    }
  })

  onMounted(() => {
    syncFromConfig()
    void loadSnapshot()
  })

  return {
    channel,
    channelBaseUrl,
    channelEnabled,
    channelMode,
    channelSaving,
    channelTesting,
    channelToken,
    cookie,
    cookieHealthy,
    saveChannel,
    testChannel,
    cron,
    enabled,
    time,
    enabledTasks,
    formatDuration,
    formatRunTime,
    lastLog,
    loadSnapshot,
    loading,
    save,
    saving,
    sendNow,
    sending,
    snapshot,
    summary,
  }
}
