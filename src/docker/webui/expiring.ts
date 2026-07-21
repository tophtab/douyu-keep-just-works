import type { ExpiringGiftConfig, Fans, GiftStatus } from '../../core/types'
import { computed, ref } from 'vue'
import { DEFAULT_EXPIRING_GIFT_ALLOCATION_MODE, DEFAULT_EXPIRING_GIFT_CRON, DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS } from '../../core/task-defaults'
import type { AllocationFanRow } from './allocation-task'
import { allocationModeToModel, buildAllocationConfig, buildAllocationFanRows } from './allocation-task'
import { buildBackpackDisplayRows, normalizeExpiringThresholdHours } from './backpack-display'
import { useCronPreview } from './composables/use-cron-preview'
import { createFansBackedTaskPageState } from './fans-backed-task-page'
import { fansStatusDetailsLoading as sharedFansStatusDetailsLoading, fansStatusLoaded as sharedFansStatusLoaded, giftStatus as sharedGiftStatus } from './resource-fans'
import { createOverviewTaskCard, disableEnabledTask, refreshTaskSurface, saveEnabledTask, toggleEnabledTask, triggerFansBackedTask } from './task-page-actions'
import { createDisabledAllocationTaskConfig, createFanListEmptyText, createTaskConfigAccessor, getAllocationValueLabel, hasCookieSourceConfigured, hasFanTaskTableRows, isTaskEnabled } from './task-shared'
import type { CookieSourceConfig, TaskRunStatus } from './task-shared'

interface ExpiringOverview {
  expiringGiftConfigured?: boolean
  expiringGiftRooms?: number
  status?: {
    expiringGift?: TaskRunStatus
  }
}

interface RawExpiringConfig extends CookieSourceConfig {
  expiringGift?: ExpiringGiftConfig
}

type ExpiringFanRow = AllocationFanRow

const taskPage = createFansBackedTaskPageState<ExpiringOverview, RawExpiringConfig, Fans>()
const { fans, fansListError, fansListLoaded, managedConfig, managedLoading, overview, rawConfig } = taskPage
const fansStatusLoaded = ref(false)
const fansStatusDetailsLoading = ref(false)
const giftStatus = ref<GiftStatus | null>(null)
const expiringEnabled = ref(false)
const expiringCron = ref(DEFAULT_EXPIRING_GIFT_CRON)
const expiringThresholdHours = ref(DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS)
const expiringModel = ref<1 | 2>(allocationModeToModel(DEFAULT_EXPIRING_GIFT_ALLOCATION_MODE, DEFAULT_EXPIRING_GIFT_ALLOCATION_MODE))
const fanRows = ref<ExpiringFanRow[]>([])
const { cronPreviewText: expiringCronPreviewText, ensureCronPreview, loadCronPreview: loadExpiringCronPreview } = useCronPreview(() => expiringCron.value)

const EXPIRING_CONFIG_FALLBACK: ExpiringGiftConfig = {
  enabled: false,
  cron: DEFAULT_EXPIRING_GIFT_CRON,
  thresholdHours: DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
  allocationMode: DEFAULT_EXPIRING_GIFT_ALLOCATION_MODE,
  roomAllocations: {},
}

function normalizeModel(mode: unknown): 1 | 2 {
  return allocationModeToModel(mode, DEFAULT_EXPIRING_GIFT_ALLOCATION_MODE)
}

function normalizeThresholdHours(value: unknown): number {
  return normalizeExpiringThresholdHours(value)
}

const getExpiringConfig = createTaskConfigAccessor<ExpiringGiftConfig, RawExpiringConfig>({
  configKey: 'expiringGift',
  fallback: EXPIRING_CONFIG_FALLBACK,
  getManagedConfig: () => managedConfig.value,
  getRawConfig: () => rawConfig.value,
})

function buildFanRows(nextFans: Fans[], config: ExpiringGiftConfig): ExpiringFanRow[] {
  const model = normalizeModel(config.allocationMode)
  return buildAllocationFanRows(nextFans, {
    model,
    roomAllocations: config.roomAllocations,
    defaultValue: (_fan, index, currentModel) => currentModel === 2 ? 1 : (index === 0 ? 1 : 0),
  })
}

function applyExpiringConfig(config: ExpiringGiftConfig): void {
  expiringEnabled.value = isTaskEnabled(config)
  expiringCron.value = config.cron || DEFAULT_EXPIRING_GIFT_CRON
  expiringThresholdHours.value = normalizeThresholdHours(config.thresholdHours)
  expiringModel.value = normalizeModel(config.allocationMode)
  fanRows.value = buildFanRows(fans.value, config)
  void ensureCronPreview()
}

function applyResourceState(): void {
  taskPage.syncResourceState()
  fansStatusLoaded.value = sharedFansStatusLoaded.value
  fansStatusDetailsLoading.value = sharedFansStatusDetailsLoading.value
  giftStatus.value = sharedGiftStatus.value
  applyExpiringConfig(getExpiringConfig())
}

function buildExpiringPayload(): ExpiringGiftConfig {
  return {
    enabled: true,
    cron: expiringCron.value.trim(),
    thresholdHours: normalizeThresholdHours(expiringThresholdHours.value),
    ...buildAllocationConfig(fanRows.value, expiringModel.value),
  }
}

async function refreshExpiringSurfaces(): Promise<void> {
  await refreshTaskSurface('expiring-gift')
}

async function saveExpiringGiftConfig(options?: { revertCheckboxOnError?: boolean }): Promise<void> {
  await saveEnabledTask({
    payload: { expiringGift: buildExpiringPayload() },
    successMessage: '临期任务已保存并启用',
    failurePrefix: '保存并启用临期任务失败：',
    enabled: expiringEnabled,
    revertCheckboxOnError: options?.revertCheckboxOnError,
    refresh: refreshExpiringSurfaces,
  })
}

async function disableExpiringGiftConfig(): Promise<void> {
  const currentConfig = getExpiringConfig()
  await disableEnabledTask({
    payload: {
      expiringGift: {
        ...createDisabledAllocationTaskConfig(currentConfig),
        thresholdHours: normalizeThresholdHours(currentConfig.thresholdHours),
      },
    },
    successMessage: '临期任务已停用',
    failurePrefix: '停用临期任务失败：',
    restoreEnabled: () => {
      expiringEnabled.value = true
    },
    refresh: refreshExpiringSurfaces,
  })
}

async function triggerExpiringTask(): Promise<void> {
  await triggerFansBackedTask('expiringGift', applyResourceState)
}

export function useExpiringGiftTaskPage() {
  const expiringTaskCard = computed(() => {
    const currentOverview = overview.value
    const configured = Boolean(currentOverview?.expiringGiftConfigured)
    const status = currentOverview?.status?.expiringGift || {}
    return createOverviewTaskCard({
      overviewReady: Boolean(currentOverview),
      pendingThirdLabel: '阈值',
      configured,
      status,
      thirdCell: { label: '阈值', value: `${normalizeThresholdHours(getExpiringConfig().thresholdHours)} 小时` },
    })
  })

  const expiringTableEmptyText = computed(() => {
    return createFanListEmptyText({
      rawConfig: rawConfig.value,
      managedLoading: managedLoading.value,
      rowCount: fanRows.value.length,
      fansListError: fansListError.value,
      fansListLoaded: fansStatusLoaded.value || fansListLoaded.value,
      emptyMissingCredentialText: '保存 Cookie 或启用 CookieCloud 后再同步粉丝牌，这里才会出现临期赠送房间列表。',
    })
  })

  const expiringBackpackEmptyText = computed(() => {
    if (!hasCookieSourceConfigured(rawConfig.value)) {
      return '保存 Cookie 或启用 CookieCloud 后，这里会展示背包临期明细。'
    }
    if (!giftStatus.value) {
      if (fansStatusDetailsLoading.value) {
        return '正在加载背包明细…'
      }
      return '尚未加载背包明细。点击顶部“刷新”后会展示可见礼物行。'
    }
    if (giftStatus.value.error) {
      return `背包明细暂不可用：${giftStatus.value.error}`
    }
    if (!(giftStatus.value.rows || []).length) {
      return '当前背包没有可展示的礼物行。'
    }
    return ''
  })

  const expiringBackpackRows = computed(() => {
    const rows = giftStatus.value?.rows || []
    return buildBackpackDisplayRows(rows, normalizeThresholdHours(expiringThresholdHours.value))
  })

  const showExpiringTable = computed(() => hasFanTaskTableRows(rawConfig.value, fanRows.value.length))
  const showExpiringBackpackTable = computed(() => Boolean(giftStatus.value && !giftStatus.value.error && expiringBackpackRows.value.length))
  const expiringValueLabel = computed(() => getAllocationValueLabel(expiringModel.value))

  function handleExpiringToggle(): void {
    toggleEnabledTask(expiringEnabled, saveExpiringGiftConfig, disableExpiringGiftConfig)
  }

  function handleExpiringModelChange(): void {
    fanRows.value = buildAllocationFanRows(fans.value, {
      model: expiringModel.value,
      defaultValue: (_fan, index, currentModel) => currentModel === 2 ? 1 : (index === 0 ? 1 : 0),
    })
  }

  taskPage.watchResourceState(applyResourceState, [
    sharedFansStatusLoaded,
    sharedFansStatusDetailsLoading,
    sharedGiftStatus,
  ])

  return {
    expiringBackpackEmptyText,
    expiringBackpackRows,
    expiringCron,
    expiringCronPreviewText,
    expiringEnabled,
    expiringFanRows: fanRows,
    expiringModel,
    expiringTableEmptyText,
    expiringTaskCard,
    expiringThresholdHours,
    expiringValueLabel,
    handleExpiringModelChange,
    handleExpiringToggle,
    loadExpiringCronPreview,
    saveExpiringGiftConfig,
    showExpiringBackpackTable,
    showExpiringTable,
    triggerExpiringTask,
  }
}
