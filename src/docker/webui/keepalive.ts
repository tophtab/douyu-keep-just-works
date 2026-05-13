import type { Fans, JobConfig } from '../../core/types'
import { computed, ref, watch } from 'vue'
import { DEFAULT_KEEPALIVE_CRON, DEFAULT_KEEPALIVE_MODEL } from '../../core/task-defaults'
import type { AllocationFanRow } from './allocation-task'
import { buildAllocationFanRows, buildAllocationSendMap, normalizeAllocationModel } from './allocation-task'
import { useCronPreview } from './composables/use-cron-preview'
import { rawConfig as sharedRawConfig } from './resource-config'
import { fansListError as sharedFansListError, fansListLoaded as sharedFansListLoaded, fansStatus as sharedFansStatus, getManagedConfig, getManagedFans, managed, managedLoading as sharedManagedLoading } from './resource-fans'
import { overview as sharedOverview } from './resource-state'
import { createOverviewTaskCard, disableEnabledTask, refreshTaskSurface, saveEnabledTask, toggleEnabledTask, triggerFansBackedTask } from './task-page-actions'
import { createFanListMessages, getAllocationValueLabel, hasFanTaskTableRows, isTaskActive, resolveCurrentTaskConfig } from './task-shared'
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

const overview = ref<KeepaliveOverview | null>(null)
const rawConfig = ref<RawKeepaliveConfig | null>(null)
const managedConfig = ref<RawKeepaliveConfig | null>(null)
const fans = ref<Fans[]>([])
const fansListError = ref('')
const fansListLoaded = ref(false)
const managedLoading = ref(false)
const keepaliveEnabled = ref(false)
const keepaliveCron = ref(DEFAULT_KEEPALIVE_CRON)
const keepaliveModel = ref<1 | 2>(DEFAULT_KEEPALIVE_MODEL)
const fanRows = ref<KeepaliveFanRow[]>([])
const { cronPreviewText: keepaliveCronPreviewText, ensureCronPreview, loadCronPreview: loadKeepaliveCronPreview } = useCronPreview(() => keepaliveCron.value)

function normalizeModel(model: unknown): 1 | 2 {
  return normalizeAllocationModel(model, DEFAULT_KEEPALIVE_MODEL)
}

function getKeepaliveConfig(): JobConfig {
  return resolveCurrentTaskConfig({
    configKey: 'keepalive',
    managedConfig: managedConfig.value,
    rawConfig: rawConfig.value,
    fallback: {
      active: true,
      cron: DEFAULT_KEEPALIVE_CRON,
      model: DEFAULT_KEEPALIVE_MODEL,
      send: {},
    },
  })
}

function buildFanRows(nextFans: Fans[], config: JobConfig): KeepaliveFanRow[] {
  const model = normalizeModel(config.model)
  return buildAllocationFanRows(nextFans, {
    model,
    send: config.send,
    defaultValue: () => 1,
  })
}

function applyResourceState(): void {
  rawConfig.value = sharedRawConfig.value
  managedConfig.value = getManagedConfig()
  overview.value = sharedOverview.value
  fans.value = getManagedFans()
  fansListError.value = sharedFansListError.value
  fansListLoaded.value = sharedFansListLoaded.value
  managedLoading.value = sharedManagedLoading.value
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
  const currentConfig = resolveCurrentTaskConfig({
    configKey: 'keepalive',
    managedConfig: managedConfig.value,
    rawConfig: rawConfig.value,
    fallback: {
      active: true,
      cron: DEFAULT_KEEPALIVE_CRON,
      model: DEFAULT_KEEPALIVE_MODEL,
      send: {},
    },
  })
  await saveDisabledKeepaliveConfig(currentConfig)
}

async function saveDisabledKeepaliveConfig(currentConfig: JobConfig): Promise<void> {
  await disableEnabledTask({
    payload: {
      keepalive: {
        active: false,
        cron: currentConfig.cron || DEFAULT_KEEPALIVE_CRON,
        model: normalizeModel(currentConfig.model),
        send: currentConfig.send || {},
      },
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

  const keepaliveMessages = computed(() => {
    return createFanListMessages({
      rawConfig: rawConfig.value,
      managedLoading: managedLoading.value,
      rowCount: fanRows.value.length,
      fansListError: fansListError.value,
      fansListLoaded: fansListLoaded.value,
      missingCredentialText: '请先保存 Cookie 或启用 CookieCloud。没有登录凭证时无法同步粉丝牌，也不会生成保活房间列表。',
      emptyMissingCredentialText: '保存 Cookie 或启用 CookieCloud 后再同步粉丝牌，这里才会出现房间列表。',
      loadingText: '正在同步粉丝牌与保活配置…',
      readyText: `${managedLoading.value ? '正在后台同步，当前显示上次结果。' : ''}当前已同步 ${fanRows.value.length} 个粉丝牌房间。`,
    })
  })

  const keepaliveNote = computed(() => keepaliveMessages.value.note)
  const keepaliveEmptyText = computed(() => keepaliveMessages.value.emptyText)

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

  watch([sharedRawConfig, managed, sharedFansStatus, sharedOverview, sharedManagedLoading, sharedFansListError, sharedFansListLoaded], applyResourceState, { immediate: true })

  return {
    fanRows,
    handleKeepaliveModelChange,
    handleKeepaliveToggle,
    keepaliveCron,
    keepaliveCronPreviewText,
    keepaliveEmptyText,
    keepaliveEnabled,
    keepaliveModel,
    keepaliveNote,
    keepaliveTaskCard,
    keepaliveValueLabel,
    loadKeepaliveCronPreview,
    saveKeepaliveConfig,
    showKeepaliveTable,
    triggerKeepaliveTask,
  }
}
