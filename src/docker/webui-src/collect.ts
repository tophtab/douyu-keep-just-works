import type { CollectGiftConfig } from '../../core/types'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatDate } from './resources'
import { requestJson } from './request'
import { showToast } from './toast'

interface TaskRunStatus {
  lastRun?: string | null
  nextRun?: string | null
  running?: boolean
}

interface CollectOverview {
  collectGiftConfigured?: boolean
  status?: {
    collectGift?: TaskRunStatus
  }
}

interface RawCollectConfig {
  collectGift?: CollectGiftConfig
}

interface CollectPageDetail {
  overview?: CollectOverview | null
  rawConfig?: RawCollectConfig | null
}

interface LegacyCollectDeps {
  getRawConfig: () => RawCollectConfig
  isUnauthorizedError: (error: unknown) => boolean
  loadFansStatus?: (forceRefresh?: boolean) => Promise<unknown>
  loadLogs?: () => Promise<unknown>
  loadOverview?: () => Promise<unknown>
  refreshOverviewSurface: (showToast: boolean) => Promise<unknown>
}

interface LegacyCollectActions {
  disableCollectConfig: () => Promise<void>
  saveCollectConfig: (options?: { revertCheckboxOnError?: boolean }) => Promise<void>
  triggerCollectTask: () => Promise<void>
}

interface CronPreview {
  error: string
  loading: boolean
  runs: string[]
  value: string
}

const DEFAULT_COLLECT_CRON = '0 10 3,5 * * *'
const COLLECT_PAGE_EVENT_NAME = 'douyu-keep-webui:collect-page'

const overview = ref<CollectOverview | null>(null)
const rawConfig = ref<RawCollectConfig | null>(null)
const collectEnabled = ref(false)
const collectCron = ref(DEFAULT_COLLECT_CRON)
const cronPreview = ref<CronPreview>({
  value: '',
  runs: [],
  error: '',
  loading: false,
})

let cronPreviewSeq = 0
let legacyDeps: LegacyCollectDeps | null = null

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_COLLECT_TASK_ACTIONS?: {
      create: (deps: LegacyCollectDeps) => LegacyCollectActions
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isUnauthorizedError(error: unknown): boolean {
  if (legacyDeps?.isUnauthorizedError(error)) {
    return true
  }
  return Boolean(error && typeof error === 'object' && 'status' in error && error.status === 401)
}

function isTaskActive(config: CollectGiftConfig | undefined): boolean {
  return Boolean(config && config.active !== false)
}

function applyRawConfig(config: RawCollectConfig | null): void {
  rawConfig.value = config
  collectEnabled.value = isTaskActive(config?.collectGift)
  collectCron.value = config?.collectGift?.cron || DEFAULT_COLLECT_CRON
  void ensureCronPreview()
}

function applyCollectPageDetail(detail: CollectPageDetail): void {
  if ('rawConfig' in detail) {
    applyRawConfig(detail.rawConfig || null)
  }
  if ('overview' in detail) {
    overview.value = detail.overview || null
  }
}

async function loadCollectCronPreview(): Promise<void> {
  const value = collectCron.value.trim()
  cronPreviewSeq += 1
  const requestSeq = cronPreviewSeq

  if (!value) {
    cronPreview.value = { value: '', runs: [], error: '', loading: false }
    return
  }

  cronPreview.value = { value, runs: [], error: '', loading: true }
  try {
    const data = await requestJson<{ runs?: string[] }>(`/api/cron-preview?value=${encodeURIComponent(value)}`)
    if (cronPreviewSeq !== requestSeq) {
      return
    }
    cronPreview.value = { value, runs: data.runs || [], error: '', loading: false }
  } catch (error) {
    if (cronPreviewSeq !== requestSeq) {
      return
    }
    cronPreview.value = { value, runs: [], error: getErrorMessage(error), loading: false }
  }
}

function ensureCronPreview(): Promise<void> {
  const value = collectCron.value.trim()
  const preview = cronPreview.value
  if (preview.value !== value || (!preview.loading && !preview.error && !preview.runs.length)) {
    return loadCollectCronPreview()
  }
  return Promise.resolve()
}

async function refreshCollectSurfaces(): Promise<void> {
  await legacyDeps?.refreshOverviewSurface(false)
}

async function saveCollectConfig(options?: { revertCheckboxOnError?: boolean }): Promise<void> {
  collectEnabled.value = true
  try {
    await requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collectGift: {
          active: true,
          cron: collectCron.value.trim(),
        },
      }),
    })
    showToast('领取任务已保存并启用', true)
    await refreshCollectSurfaces()
  } catch (error) {
    if (options?.revertCheckboxOnError) {
      collectEnabled.value = false
    }
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`保存并启用领取任务失败：${getErrorMessage(error)}`, false)
  }
}

async function disableCollectConfig(): Promise<void> {
  const currentConfig = rawConfig.value?.collectGift || legacyDeps?.getRawConfig().collectGift || {
    active: true,
    cron: DEFAULT_COLLECT_CRON,
  }
  try {
    await requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        collectGift: {
          active: false,
          cron: currentConfig.cron || DEFAULT_COLLECT_CRON,
        },
      }),
    })
    showToast('领取任务已停用', true)
    await refreshCollectSurfaces()
  } catch (error) {
    collectEnabled.value = true
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`停用领取任务失败：${getErrorMessage(error)}`, false)
  }
}

async function triggerCollectTask(): Promise<void> {
  try {
    await requestJson('/api/trigger/collectGift', { method: 'POST' })
    showToast('执行完成', true)
    await Promise.all([
      legacyDeps?.loadOverview?.(),
      legacyDeps?.loadLogs?.(),
      legacyDeps?.loadFansStatus?.(false),
    ].filter(Boolean))
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`执行失败：${getErrorMessage(error)}`, false)
  }
}

export function useCollectTaskPage() {
  const collectCronPreviewText = computed(() => {
    const preview = cronPreview.value
    if (!preview.value) {
      return '填写 cron 后显示未来三次执行时间。'
    }
    if (preview.loading) {
      return '正在计算未来执行时间…'
    }
    if (preview.error) {
      return `cron 校验失败：${preview.error}`
    }
    if (!preview.runs.length) {
      return '暂未生成未来执行时间。'
    }
    return `未来三次：${preview.runs.map(item => formatDate(item)).join(' / ')}`
  })
  const collectTaskCard = computed(() => {
    if (!overview.value) {
      return {
        pills: [{ label: '等待加载', kind: 'off' }],
        cells: [
          { label: '上次执行', value: '-' },
          { label: '下次执行', value: '-' },
          { label: '执行方式', value: '-' },
        ],
      }
    }

    const configured = Boolean(overview.value.collectGiftConfigured)
    const status = overview.value.status?.collectGift || {}
    return {
      pills: [
        { label: configured ? '已启动' : '未启动', kind: configured ? 'ok' : 'off' },
        { label: configured ? (status.running ? '调度中' : '已停止') : '未启用', kind: configured ? (status.running ? 'warn' : 'off') : 'off' },
      ],
      cells: [
        { label: '上次执行', value: formatDate(status.lastRun || null) },
        { label: '下次执行', value: formatDate(status.nextRun || null) },
        { label: '执行方式', value: configured ? '独立任务' : '等待启用' },
      ],
    }
  })

  function handleCollectPageEvent(event: Event): void {
    applyCollectPageDetail((event as CustomEvent<CollectPageDetail>).detail || {})
  }

  function handleConfigEvent(event: Event): void {
    const detail = (event as CustomEvent<{ rawConfig?: RawCollectConfig | null }>).detail || {}
    if ('rawConfig' in detail) {
      applyRawConfig(detail.rawConfig || null)
    }
  }

  function handleOverviewEvent(event: Event): void {
    const detail = (event as CustomEvent<{ overview?: CollectOverview | null }>).detail || {}
    if ('overview' in detail) {
      overview.value = detail.overview || null
    }
  }

  function handleCollectToggle(): void {
    if (collectEnabled.value) {
      void saveCollectConfig({ revertCheckboxOnError: true })
      return
    }
    void disableCollectConfig()
  }

  onMounted(() => {
    document.addEventListener(COLLECT_PAGE_EVENT_NAME, handleCollectPageEvent)
    document.addEventListener('douyu-keep-webui:config', handleConfigEvent)
    document.addEventListener('douyu-keep-webui:overview', handleOverviewEvent)
    void ensureCronPreview()
  })

  onBeforeUnmount(() => {
    document.removeEventListener(COLLECT_PAGE_EVENT_NAME, handleCollectPageEvent)
    document.removeEventListener('douyu-keep-webui:config', handleConfigEvent)
    document.removeEventListener('douyu-keep-webui:overview', handleOverviewEvent)
  })

  return {
    collectCron,
    collectCronPreviewText,
    collectEnabled,
    collectTaskCard,
    handleCollectToggle,
    loadCollectCronPreview,
    saveCollectConfig,
    triggerCollectTask,
  }
}

function createLegacyCollectActions(deps: LegacyCollectDeps): LegacyCollectActions {
  legacyDeps = deps
  applyRawConfig(deps.getRawConfig())

  return {
    disableCollectConfig,
    saveCollectConfig,
    triggerCollectTask,
  }
}

export function dispatchCollectPageState(detail: CollectPageDetail): void {
  document.dispatchEvent(new CustomEvent(COLLECT_PAGE_EVENT_NAME, { detail }))
}

export function installLegacyCollectTaskBridge(): void {
  window.DOUYU_KEEP_WEBUI_COLLECT_TASK_ACTIONS = {
    create: createLegacyCollectActions,
  }
}
