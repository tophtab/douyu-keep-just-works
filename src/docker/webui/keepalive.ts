import type { Fans, JobConfig } from '../../core/types'
import { computed, ref } from 'vue'
import { DEFAULT_KEEPALIVE_ALLOCATION_MODE, DEFAULT_KEEPALIVE_CRON } from '../../core/task-defaults'
import type { AllocationFanRow } from './allocation-task'
import { allocationModeToModel, buildAllocationConfig, buildAllocationFanRows } from './allocation-task'
import { useCronPreview } from './composables/use-cron-preview'
import { createFansBackedTaskPageState } from './fans-backed-task-page'
import { createOverviewTaskCard, disableEnabledTask, refreshTaskSurface, saveEnabledTask, toggleEnabledTask, triggerFansBackedTask } from './task-page-actions'
import { createDisabledAllocationTaskConfig, createFanListEmptyText, createTaskConfigAccessor, getAllocationValueLabel, hasFanTaskTableRows, isTaskEnabled } from './task-shared'
import type { CookieSourceConfig, TaskRunStatus } from './task-shared'

interface KeepaliveOverview {
  keepaliveConfigured?: boolean
  keepaliveRooms?: number
  status?: {
    keepalive?: TaskRunStatus
  }
}

interface RawKeepaliveConfig extends CookieSourceConfig {
  keepalive?: JobConfig
}

type KeepaliveFanRow = AllocationFanRow

const taskPage = createFansBackedTaskPageState<KeepaliveOverview, RawKeepaliveConfig, Fans>()
const { fans, fansListError, fansListLoaded, managedConfig, managedLoading, overview, rawConfig } = taskPage
const keepaliveEnabled = ref(false)
const keepaliveCron = ref(DEFAULT_KEEPALIVE_CRON)
const keepaliveModel = ref<1 | 2>(allocationModeToModel(DEFAULT_KEEPALIVE_ALLOCATION_MODE, DEFAULT_KEEPALIVE_ALLOCATION_MODE))
const fanRows = ref<KeepaliveFanRow[]>([])
const { cronPreviewText: keepaliveCronPreviewText, ensureCronPreview, loadCronPreview: loadKeepaliveCronPreview } = useCronPreview(() => keepaliveCron.value)

const KEEPALIVE_CONFIG_FALLBACK: JobConfig = {
  enabled: true,
  cron: DEFAULT_KEEPALIVE_CRON,
  allocationMode: DEFAULT_KEEPALIVE_ALLOCATION_MODE,
  roomAllocations: {},
}

function normalizeModel(mode: unknown): 1 | 2 {
  return allocationModeToModel(mode, DEFAULT_KEEPALIVE_ALLOCATION_MODE)
}

const getKeepaliveConfig = createTaskConfigAccessor<JobConfig, RawKeepaliveConfig>({
  configKey: 'keepalive',
  fallback: KEEPALIVE_CONFIG_FALLBACK,
  getManagedConfig: () => managedConfig.value,
  getRawConfig: () => rawConfig.value,
})

function buildFanRows(nextFans: Fans[], config: JobConfig): KeepaliveFanRow[] {
  const model = normalizeModel(config.allocationMode)
  return buildAllocationFanRows(nextFans, {
    model,
    roomAllocations: config.roomAllocations,
    defaultValue: () => 1,
  })
}

function applyResourceState(): void {
  taskPage.syncResourceState()
  const keepaliveConfig = getKeepaliveConfig()
  keepaliveEnabled.value = isTaskEnabled(keepaliveConfig)
  keepaliveCron.value = keepaliveConfig.cron || DEFAULT_KEEPALIVE_CRON
  keepaliveModel.value = normalizeModel(keepaliveConfig.allocationMode)
  fanRows.value = buildFanRows(fans.value, keepaliveConfig)
  void ensureCronPreview()
}

function buildSendPayload(): JobConfig {
  return {
    enabled: true,
    cron: keepaliveCron.value.trim(),
    ...buildAllocationConfig(fanRows.value, keepaliveModel.value),
  }
}

async function refreshKeepaliveSurfaces(): Promise<void> {
  await refreshTaskSurface('keepalive')
}

async function saveKeepaliveConfig(options?: { revertCheckboxOnError?: boolean }): Promise<void> {
  await saveEnabledTask({
    payload: { keepalive: buildSendPayload() },
    successMessage: '保活任务已保存并启用',
    failurePrefix: '保存并启用保活任务失败：',
    enabled: keepaliveEnabled,
    revertCheckboxOnError: options?.revertCheckboxOnError,
    refresh: refreshKeepaliveSurfaces,
  })
}

async function disableKeepaliveConfig(): Promise<void> {
  const currentConfig = getKeepaliveConfig()
  await disableEnabledTask({
    payload: {
      keepalive: createDisabledAllocationTaskConfig(currentConfig),
    },
    successMessage: '保活任务已停用',
    failurePrefix: '停用保活任务失败：',
    restoreEnabled: () => {
      keepaliveEnabled.value = true
    },
    refresh: refreshKeepaliveSurfaces,
  })
}

async function triggerKeepaliveTask(): Promise<void> {
  await triggerFansBackedTask('keepalive')
}

export function useKeepaliveTaskPage() {
  const keepaliveTaskCard = computed(() => {
    const currentOverview = overview.value
    const configured = Boolean(currentOverview?.keepaliveConfigured)
    const status = currentOverview?.status?.keepalive || {}
    return createOverviewTaskCard({
      overviewReady: Boolean(currentOverview),
      pendingThirdLabel: '房间数',
      configured,
      status,
      thirdCell: { label: '房间数', value: configured ? String(currentOverview?.keepaliveRooms ?? 0) : '0' },
    })
  })

  const keepaliveEmptyText = computed(() => {
    return createFanListEmptyText({
      rawConfig: rawConfig.value,
      managedLoading: managedLoading.value,
      rowCount: fanRows.value.length,
      fansListError: fansListError.value,
      fansListLoaded: fansListLoaded.value,
      emptyMissingCredentialText: '保存 Cookie 或启用 CookieCloud 后再同步粉丝牌，这里才会出现房间列表。',
    })
  })

  const showKeepaliveTable = computed(() => hasFanTaskTableRows(rawConfig.value, fanRows.value.length))
  const keepaliveValueLabel = computed(() => getAllocationValueLabel(keepaliveModel.value))

  function handleKeepaliveToggle(): void {
    toggleEnabledTask(keepaliveEnabled, saveKeepaliveConfig, disableKeepaliveConfig)
  }

  function handleKeepaliveModelChange(): void {
    fanRows.value = buildAllocationFanRows(fans.value, {
      model: keepaliveModel.value,
      defaultValue: () => 1,
    })
  }

  taskPage.watchResourceState(applyResourceState)

  return {
    fanRows,
    handleKeepaliveModelChange,
    handleKeepaliveToggle,
    keepaliveCron,
    keepaliveCronPreviewText,
    keepaliveEmptyText,
    keepaliveEnabled,
    keepaliveModel,
    keepaliveTaskCard,
    keepaliveValueLabel,
    loadKeepaliveCronPreview,
    saveKeepaliveConfig,
    showKeepaliveTable,
    triggerKeepaliveTask,
  }
}
