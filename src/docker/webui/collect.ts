import type { CollectGiftConfig } from '../../core/types'
import { computed, ref, watch } from 'vue'
import { DEFAULT_COLLECT_GIFT_CRON } from '../../core/task-defaults'
import { useCronPreview } from './composables/use-cron-preview'
import { overview, rawConfig } from './resource-state'
import { createOverviewTaskCard, disableEnabledTask, refreshTaskSurface, saveEnabledTask, toggleEnabledTask, triggerFansBackedTask } from './task-page-actions'
import { isTaskActive } from './task-shared'

interface RawCollectConfig {
  collectGift?: CollectGiftConfig
}

const collectEnabled = ref(false)
const collectCron = ref(DEFAULT_COLLECT_GIFT_CRON)
const { cronPreviewText: collectCronPreviewText, ensureCronPreview, loadCronPreview: loadCollectCronPreview } = useCronPreview(() => collectCron.value)

function applyRawConfig(config: RawCollectConfig | null): void {
  collectEnabled.value = isTaskActive(config?.collectGift)
  collectCron.value = config?.collectGift?.cron || DEFAULT_COLLECT_GIFT_CRON
  void ensureCronPreview()
}

async function refreshCollectSurfaces(): Promise<void> {
  await refreshTaskSurface('collect')
}

async function saveCollectConfig(options?: { revertCheckboxOnError?: boolean }): Promise<void> {
  await saveEnabledTask({
    payload: {
      collectGift: {
        active: true,
        cron: collectCron.value.trim(),
      },
    },
    successMessage: '领取任务已保存并启用',
    failurePrefix: '保存并启用领取任务失败：',
    enabled: collectEnabled,
    revertCheckboxOnError: options?.revertCheckboxOnError,
    refresh: refreshCollectSurfaces,
  })
}

async function disableCollectConfig(): Promise<void> {
  const currentConfig = rawConfig.value?.collectGift || {
    active: true,
    cron: DEFAULT_COLLECT_GIFT_CRON,
  }
  await disableEnabledTask({
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
    refresh: refreshCollectSurfaces,
  })
}

async function triggerCollectTask(): Promise<void> {
  await triggerFansBackedTask('collectGift')
}

export function useCollectTaskPage() {
  const collectTaskCard = computed(() => {
    const currentOverview = overview.value
    const configured = Boolean(currentOverview?.collectGiftConfigured)
    const status = currentOverview?.status?.collectGift || {}
    return createOverviewTaskCard({
      overviewReady: Boolean(currentOverview),
      pendingThirdLabel: '执行方式',
      configured,
      status,
      thirdCell: { label: '执行方式', value: configured ? '独立任务' : '等待启用' },
    })
  })

  function handleCollectToggle(): void {
    toggleEnabledTask(collectEnabled, saveCollectConfig, disableCollectConfig)
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
