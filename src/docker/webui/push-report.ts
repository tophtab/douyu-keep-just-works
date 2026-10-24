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

export function usePushReportPage() {
  const enabled = ref(true)
  const cron = ref(DEFAULT_PUSH_REPORT_CRON)

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

  async function save(options?: { revertCheckboxOnError?: boolean }): Promise<void> {
    saving.value = true
    enabled.value = true
    try {
      await requestJson('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pushReport: {
            enabled: true,
            cron: cron.value.trim() || DEFAULT_PUSH_REPORT_CRON,
          },
        }),
        errorToast: '保存并启用推送汇总失败：',
      })
      showToast('推送汇总已保存并启用', true)
      await loadSnapshot()
    } catch {
      if (options?.revertCheckboxOnError) {
        enabled.value = false
      }
      // 错误提示已由 requestJson 处理
    } finally {
      saving.value = false
    }
  }

  async function disable(): Promise<void> {
    saving.value = true
    try {
      await requestJson('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pushReport: {
            enabled: false,
            cron: cron.value.trim() || DEFAULT_PUSH_REPORT_CRON,
          },
        }),
        errorToast: '停用推送汇总失败：',
      })
      showToast('推送汇总已停用', true)
      await loadSnapshot()
    } catch {
      enabled.value = true
      // 错误提示已由 requestJson 处理
    } finally {
      saving.value = false
    }
  }

  function handleToggle(): void {
    if (enabled.value) {
      void save({ revertCheckboxOnError: true })
      return
    }
    void disable()
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

  async function persistChannel(enabled: boolean, options?: { quietSuccess?: boolean, revertEnabled?: boolean }): Promise<void> {
    channelSaving.value = true
    try {
      await requestJson('/api/push-report/channel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled,
          baseUrl: channelBaseUrl.value.trim(),
          mode: channelMode.value,
          token: channelToken.value.trim(),
        }),
        errorToast: enabled ? '保存并启用推送渠道失败：' : '停用推送渠道失败：',
      })
      if (!options?.quietSuccess) {
        showToast(enabled ? '推送渠道已保存并启用' : '推送渠道已停用', true)
      }
      await loadSnapshot()
      syncChannelForm()
    } catch {
      if (options?.revertEnabled !== undefined) {
        channelEnabled.value = options.revertEnabled
      }
      // 错误提示已由 requestJson 处理
    } finally {
      channelSaving.value = false
    }
  }

  function saveChannel(): Promise<void> {
    return persistChannel(true)
  }

  function handleChannelToggle(): void {
    if (channelEnabled.value) {
      void persistChannel(true, { quietSuccess: true, revertEnabled: false })
      return
    }
    void persistChannel(false, { quietSuccess: true, revertEnabled: true })
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
    saveChannel,
    testChannel,
    cron,
    disable,
    enabled,
    formatRunTime,
    handleChannelToggle,
    handleToggle,
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
