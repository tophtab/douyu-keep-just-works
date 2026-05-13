import type { Fans, JobConfig } from '../../core/types'
import { computed, ref } from 'vue'
import { DEFAULT_KEEPALIVE_CRON, DEFAULT_KEEPALIVE_MODEL } from '../../core/task-defaults'
import type { AllocationFanRow } from './allocation-task'
import { buildAllocationFanRows, buildAllocationSendMap, normalizeAllocationModel } from './allocation-task'
import { WEBUI_BRIDGE_EVENTS } from './bridge-contract'
import { useCronPreview } from './composables/use-cron-preview'
import { applyFanTaskPageDetail, createFanListMessages, createFanTaskTriggerRefreshes, createPendingTaskCard, createScheduledTaskCard, disableTaskConfig, getAllocationValueLabel, hasFanTaskTableRows, isLegacyOrHttpUnauthorized, isTaskActive, resolveCurrentTaskConfig, saveTaskConfig, triggerTask, useLegacyPageEvents } from './task-shared'
import type { CookieSourceConfig, FanTaskPageDetail, LegacyFanTaskDeps, TaskRunStatus } from './task-shared'

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

type KeepalivePageDetail = FanTaskPageDetail<Fans, RawKeepaliveConfig, KeepaliveOverview>

type LegacyKeepaliveDeps = LegacyFanTaskDeps<RawKeepaliveConfig, Fans>

interface LegacyKeepaliveActions {
  disableKeepaliveConfig: () => Promise<void>
  saveKeepaliveConfig: (options?: { revertCheckboxOnError?: boolean }) => Promise<void>
}

type KeepaliveFanRow = AllocationFanRow

const KEEPALIVE_PAGE_EVENT_NAME = WEBUI_BRIDGE_EVENTS.keepalivePage

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

let legacyDeps: LegacyKeepaliveDeps | null = null

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_KEEPALIVE_TASK_ACTIONS?: {
      create: (deps: LegacyKeepaliveDeps) => LegacyKeepaliveActions
    }
  }
}

function isUnauthorizedError(error: unknown): boolean {
  return isLegacyOrHttpUnauthorized(error, legacyDeps?.isUnauthorizedError)
}

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

function applyRawConfig(config: RawKeepaliveConfig | null): void {
  rawConfig.value = config
  const keepaliveConfig = getKeepaliveConfig()
  keepaliveEnabled.value = isTaskActive(keepaliveConfig)
  keepaliveCron.value = keepaliveConfig.cron || DEFAULT_KEEPALIVE_CRON
  keepaliveModel.value = normalizeModel(keepaliveConfig.model)
  fanRows.value = buildFanRows(fans.value, keepaliveConfig)
  void ensureCronPreview()
}

function applyKeepalivePageDetail(detail: KeepalivePageDetail): void {
  applyFanTaskPageDetail(detail, { rawConfig, managedConfig, overview, fans, fansListError, fansListLoaded, managedLoading })
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
  await legacyDeps?.refreshOverviewSurface(false)
}

async function saveKeepaliveConfig(options?: { revertCheckboxOnError?: boolean }): Promise<void> {
  await saveTaskConfig({
    payload: { keepalive: buildSendPayload() },
    successMessage: '保活任务已保存并启用',
    failurePrefix: '保存并启用保活任务失败：',
    setEnabled: (enabled) => {
      keepaliveEnabled.value = enabled
    },
    revertCheckboxOnError: options?.revertCheckboxOnError,
    isUnauthorizedError,
    refresh: refreshKeepaliveSurfaces,
  })
}

async function disableKeepaliveConfig(): Promise<void> {
  const currentConfig = resolveCurrentTaskConfig({
    configKey: 'keepalive',
    managedConfig: managedConfig.value,
    rawConfig: rawConfig.value,
    getManagedConfig: legacyDeps?.getManagedConfig,
    getRawConfig: legacyDeps?.getRawConfig,
    fallback: {
      active: true,
      cron: DEFAULT_KEEPALIVE_CRON,
      model: DEFAULT_KEEPALIVE_MODEL,
      send: {},
    },
  })
  await disableTaskConfig({
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
    isUnauthorizedError,
    refresh: refreshKeepaliveSurfaces,
  })
}

async function triggerKeepaliveTask(): Promise<void> {
  await triggerTask({
    taskType: 'keepalive',
    isUnauthorizedError,
    refresh: createFanTaskTriggerRefreshes(legacyDeps),
  })
}

export function useKeepaliveTaskPage() {
  const keepaliveTaskCard = computed(() => {
    if (!overview.value) {
      return createPendingTaskCard('房间数')
    }

    const configured = Boolean(overview.value.keepaliveConfigured)
    const status = overview.value.status?.keepalive || {}
    return createScheduledTaskCard(configured, status, { label: '房间数', value: configured ? String(overview.value.keepaliveRooms ?? 0) : '0' })
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
    if (keepaliveEnabled.value) {
      void saveKeepaliveConfig({ revertCheckboxOnError: true })
      return
    }
    void disableKeepaliveConfig()
  }

  function handleKeepaliveModelChange(): void {
    fanRows.value = buildFanRows(fans.value, {
      ...getKeepaliveConfig(),
      model: keepaliveModel.value,
    })
  }

  useLegacyPageEvents<KeepalivePageDetail, RawKeepaliveConfig, KeepaliveOverview>({
    pageEventName: KEEPALIVE_PAGE_EVENT_NAME,
    onPageDetail: applyKeepalivePageDetail,
    onRawConfig: applyRawConfig,
    onOverview: (nextOverview) => {
      overview.value = nextOverview
    },
    ensureCronPreview,
  })

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

function createLegacyKeepaliveActions(deps: LegacyKeepaliveDeps): LegacyKeepaliveActions {
  legacyDeps = deps
  rawConfig.value = deps.getRawConfig()
  managedConfig.value = deps.getManagedConfig()
  fans.value = deps.getManagedFans()
  applyRawConfig(rawConfig.value)

  return {
    disableKeepaliveConfig,
    saveKeepaliveConfig,
  }
}

export function dispatchKeepalivePageState(detail: KeepalivePageDetail): void {
  document.dispatchEvent(new CustomEvent(KEEPALIVE_PAGE_EVENT_NAME, { detail }))
}

export function installLegacyKeepaliveTaskBridge(): void {
  window.DOUYU_KEEP_WEBUI_KEEPALIVE_TASK_ACTIONS = {
    create: createLegacyKeepaliveActions,
  }
}
