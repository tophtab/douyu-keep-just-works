import type { Fans, JobConfig } from '../../core/types'
import { computed, ref } from 'vue'
import { DEFAULT_KEEPALIVE_CRON, DEFAULT_KEEPALIVE_MODEL } from '../../core/task-defaults'
import type { AllocationFanRow } from './allocation-task'
import { buildAllocationFanRows, buildAllocationSendMap, normalizeAllocationModel } from './allocation-task'
import { useCronPreview } from './composables/use-cron-preview'
import { createFansBackedTaskPageState } from './fans-backed-task-page'
import { createOverviewTaskCard, disableEnabledTask, refreshTaskSurface, saveEnabledTask, toggleEnabledTask, triggerFansBackedTask } from './task-page-actions'
import { createDisabledAllocationTaskConfig, createFanListEmptyText, createTaskConfigAccessor, getAllocationValueLabel, hasFanTaskTableRows, isTaskActive } from './task-shared'
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
const keepaliveModel = ref<1 | 2>(DEFAULT_KEEPALIVE_MODEL)
const fanRows = ref<KeepaliveFanRow[]>([])
const { cronPreviewText: keepaliveCronPreviewText, ensureCronPreview, loadCronPreview: loadKeepaliveCronPreview } = useCronPreview(() => keepaliveCron.value)

const KEEPALIVE_CONFIG_FALLBACK: JobConfig = {
  active: true,
  cron: DEFAULT_KEEPALIVE_CRON,
  model: DEFAULT_KEEPALIVE_MODEL,
  send: {},
}

function normalizeModel(model: unknown): 1 | 2 {
  return normalizeAllocationModel(model, DEFAULT_KEEPALIVE_MODEL)
}

const getKeepaliveConfig = createTaskConfigAccessor<JobConfig, RawKeepaliveConfig>({
  configKey: 'keepalive',
  fallback: KEEPALIVE_CONFIG_FALLBACK,
  getManagedConfig: () => managedConfig.value,
  getRawConfig: () => rawConfig.value,
})

function buildFanRows(nextFans: Fans[], config: JobConfig): KeepaliveFanRow[] {
  const model = normalizeModel(config.model)
  return buildAllocationFanRows(nextFans, {
    model,
    send: config.send,
    defaultValue: () => 1,
  })
}

function applyResourceState(): void {
  taskPage.syncResourceState()
  const keepaliveConfig = getKeepaliveConfig()
  keepaliveEnabled.value = isTaskActive(keepaliveConfig)
  keepaliveCron.value = keepaliveConfig.cron || DEFAULT_KEEPALIVE_CRON
  keepaliveModel.value = normalizeModel(keepaliveConfig.model)
  fanRows.value = buildFanRows(fans.value, keepaliveConfig)
  void ensureCronPreview()
}

function buildSendPayload(): JobConfig {
  return {
    active: true,
    cron: keepaliveCron.value.trim(),
    model: keepaliveModel.value,
    send: buildAllocationSendMap(fanRows.value, keepaliveModel.value),
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
      keepalive: createDisabledAllocationTaskConfig(currentConfig, {
        defaultCron: DEFAULT_KEEPALIVE_CRON,
        normalizeModel,
      }),
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
    fanRows.value = buildFanRows(fans.value, {
      ...getKeepaliveConfig(),
      model: keepaliveModel.value,
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
