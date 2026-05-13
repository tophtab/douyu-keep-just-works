import type { CollectGiftConfig } from '../../core/types'
import { computed, ref, watch } from 'vue'
import { DEFAULT_COLLECT_GIFT_CRON } from '../../core/task-defaults'
import { useCronPreview } from './composables/use-cron-preview'
import { loadFansStatus, loadLogs, loadOverview, overview, rawConfig, refreshOverviewSurface } from './resource-state'
import { createPendingTaskCard, createScheduledTaskCard, disableTaskConfig, isHttpUnauthorized, isTaskActive, saveTaskConfig, triggerTask } from './task-shared'

interface RawCollectConfig {
  collectGift?: CollectGiftConfig
}

const collectEnabled = ref(false)
const collectCron = ref(DEFAULT_COLLECT_GIFT_CRON)
const { cronPreviewText: collectCronPreviewText, ensureCronPreview, loadCronPreview: loadCollectCronPreview } = useCronPreview(() => collectCron.value)

function isUnauthorizedError(error: unknown): boolean {
  return isHttpUnauthorized(error)
}

function applyRawConfig(config: RawCollectConfig | null): void {
  collectEnabled.value = isTaskActive(config?.collectGift)
  collectCron.value = config?.collectGift?.cron || DEFAULT_COLLECT_GIFT_CRON
  void ensureCronPreview()
}

async function refreshCollectSurfaces(): Promise<void> {
  await refreshOverviewSurface('collect', false)
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
  const currentConfig = rawConfig.value?.collectGift || {
    active: true,
    cron: DEFAULT_COLLECT_GIFT_CRON,
  }
  await disableTaskConfig({
    payload: {
      collectGift: {
        active: false,
        cron: currentConfig.cron || DEFAULT_COLLECT_GIFT_CRON,
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
    taskType: 'collectGift',
    isUnauthorizedError,
    refresh: [
      () => loadOverview(),
      () => loadLogs(),
      () => loadFansStatus(false),
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

  watch(rawConfig, config => applyRawConfig(config), { immediate: true })

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
