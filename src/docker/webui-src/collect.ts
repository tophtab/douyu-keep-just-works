import type { CollectGiftConfig } from '../../core/types'
import { computed, ref } from 'vue'
import { useCronPreview } from './composables/use-cron-preview'
import { createPendingTaskCard, createScheduledTaskCard, disableTaskConfig, isHttpUnauthorized, isTaskActive, saveTaskConfig, triggerTask, useLegacyPageEvents } from './task-shared'

import type { TaskRunStatus } from './task-shared'

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

const DEFAULT_COLLECT_CRON = '0 10 3,5 * * *'
const COLLECT_PAGE_EVENT_NAME = 'douyu-keep-webui:collect-page'

const overview = ref<CollectOverview | null>(null)
const rawConfig = ref<RawCollectConfig | null>(null)
const collectEnabled = ref(false)
const collectCron = ref(DEFAULT_COLLECT_CRON)
const { cronPreviewText: collectCronPreviewText, ensureCronPreview, loadCronPreview: loadCollectCronPreview } = useCronPreview(() => collectCron.value)

let legacyDeps: LegacyCollectDeps | null = null

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_COLLECT_TASK_ACTIONS?: {
      create: (deps: LegacyCollectDeps) => LegacyCollectActions
    }
  }
}

function isUnauthorizedError(error: unknown): boolean {
  if (legacyDeps?.isUnauthorizedError(error)) {
    return true
  }
  return isHttpUnauthorized(error)
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

async function refreshCollectSurfaces(): Promise<void> {
  await legacyDeps?.refreshOverviewSurface(false)
}

async function saveCollectConfig(options?: { revertCheckboxOnError?: boolean }): Promise<void> {
  await saveTaskConfig({
    payload: {
      collectGift: {
        active: true,
        cron: collectCron.value.trim(),
      },
    },
    successMessage: '领取任务已保存并启用',
    failurePrefix: '保存并启用领取任务失败：',
    setEnabled: (enabled) => {
      collectEnabled.value = enabled
    },
    revertCheckboxOnError: options?.revertCheckboxOnError,
    isUnauthorizedError,
    refresh: refreshCollectSurfaces,
  })
}

async function disableCollectConfig(): Promise<void> {
  const currentConfig = rawConfig.value?.collectGift || legacyDeps?.getRawConfig().collectGift || {
    active: true,
    cron: DEFAULT_COLLECT_CRON,
  }
  await disableTaskConfig({
    payload: {
      collectGift: {
        active: false,
        cron: currentConfig.cron || DEFAULT_COLLECT_CRON,
      },
    },
    successMessage: '领取任务已停用',
    failurePrefix: '停用领取任务失败：',
    restoreEnabled: () => {
      collectEnabled.value = true
    },
    isUnauthorizedError,
    refresh: refreshCollectSurfaces,
  })
}

async function triggerCollectTask(): Promise<void> {
  await triggerTask({
    endpoint: '/api/trigger/collectGift',
    isUnauthorizedError,
    refresh: [
      () => legacyDeps?.loadOverview?.(),
      () => legacyDeps?.loadLogs?.(),
      () => legacyDeps?.loadFansStatus?.(false),
    ],
  })
}

export function useCollectTaskPage() {
  const collectTaskCard = computed(() => {
    if (!overview.value) {
      return createPendingTaskCard('执行方式')
    }

    const configured = Boolean(overview.value.collectGiftConfigured)
    const status = overview.value.status?.collectGift || {}
    return createScheduledTaskCard(configured, status, { label: '执行方式', value: configured ? '独立任务' : '等待启用' })
  })

  function handleCollectToggle(): void {
    if (collectEnabled.value) {
      void saveCollectConfig({ revertCheckboxOnError: true })
      return
    }
    void disableCollectConfig()
  }

  useLegacyPageEvents<CollectPageDetail, RawCollectConfig, CollectOverview>({
    pageEventName: COLLECT_PAGE_EVENT_NAME,
    onPageDetail: applyCollectPageDetail,
    onRawConfig: applyRawConfig,
    onOverview: (nextOverview) => {
      overview.value = nextOverview
    },
    ensureCronPreview,
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
