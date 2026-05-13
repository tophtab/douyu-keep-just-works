import type { Fans, JobConfig, SendGift } from '../../core/types'
import { computed, ref } from 'vue'
import { useCronPreview } from './composables/use-cron-preview'
import { createPendingTaskCard, createScheduledTaskCard, disableTaskConfig, formatOptionalNumber, hasCookieSourceConfigured, isHttpUnauthorized, isTaskActive, saveTaskConfig, triggerTask, useLegacyPageEvents } from './task-shared'
import type { TaskRunStatus } from './task-shared'

interface KeepaliveOverview {
  keepaliveConfigured?: boolean
  keepaliveRooms?: number
  status?: {
    keepalive?: TaskRunStatus
  }
}

interface RawKeepaliveConfig {
  cookie?: string
  manualCookies?: {
    main?: string
    yuba?: string
  }
  cookieCloud?: {
    active?: boolean
    endpoint?: string
    uuid?: string
    password?: string
  }
  keepalive?: JobConfig
}

interface KeepalivePageDetail {
  fans?: Fans[]
  fansListError?: string
  fansListLoaded?: boolean
  managedConfig?: RawKeepaliveConfig | null
  managedLoading?: boolean
  overview?: KeepaliveOverview | null
  rawConfig?: RawKeepaliveConfig | null
}

interface LegacyKeepaliveDeps {
  getManagedConfig: () => RawKeepaliveConfig
  getManagedFans: () => Fans[]
  getRawConfig: () => RawKeepaliveConfig
  isUnauthorizedError: (error: unknown) => boolean
  loadFansStatus?: (forceRefresh?: boolean) => Promise<unknown>
  loadLogs?: () => Promise<unknown>
  loadOverview?: () => Promise<unknown>
  refreshOverviewSurface: (showToast: boolean) => Promise<unknown>
}

interface LegacyKeepaliveActions {
  disableKeepaliveConfig: () => Promise<void>
  saveKeepaliveConfig: (options?: { revertCheckboxOnError?: boolean }) => Promise<void>
}

interface KeepaliveFanRow {
  index: number
  intimacy: string
  level: number | string
  name: string
  rank: number | string
  roomId: number
  today: number | string
  value: number
}

const DEFAULT_KEEPALIVE_CRON = '0 0 8 */6 * *'
const DEFAULT_KEEPALIVE_MODEL: 1 | 2 = 2
const KEEPALIVE_PAGE_EVENT_NAME = 'douyu-keep-webui:keepalive-page'

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
  if (legacyDeps?.isUnauthorizedError(error)) {
    return true
  }
  return isHttpUnauthorized(error)
}

function normalizeModel(model: unknown): 1 | 2 {
  return Number(model) === 1 ? 1 : DEFAULT_KEEPALIVE_MODEL
}

function getKeepaliveConfig(): JobConfig {
  return managedConfig.value?.keepalive || rawConfig.value?.keepalive || {
    active: true,
    cron: DEFAULT_KEEPALIVE_CRON,
    model: DEFAULT_KEEPALIVE_MODEL,
    send: {},
  }
}

function buildFanRows(nextFans: Fans[], config: JobConfig): KeepaliveFanRow[] {
  const model = normalizeModel(config.model)
  return nextFans.map((fan, index) => {
    const key = String(fan.roomId)
    const sendItem = config.send && config.send[key]
      ? config.send[key]
      : {
          roomId: fan.roomId,
          giftId: 268,
          number: model === 2 ? 1 : 0,
          weight: model === 1 ? 1 : 0,
        }
    return {
      index: index + 1,
      intimacy: fan.intimacy || '-',
      level: formatOptionalNumber(fan.level),
      name: fan.name || '未知主播',
      rank: formatOptionalNumber(fan.rank),
      roomId: fan.roomId,
      today: formatOptionalNumber(fan.today),
      value: model === 2 ? Number(sendItem.number || 0) : Number(sendItem.weight || 0),
    }
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
  if ('rawConfig' in detail) {
    rawConfig.value = detail.rawConfig || null
  }
  if ('managedConfig' in detail) {
    managedConfig.value = detail.managedConfig || null
  }
  if ('overview' in detail) {
    overview.value = detail.overview || null
  }
  if ('fans' in detail) {
    fans.value = detail.fans || []
  }
  if ('fansListError' in detail) {
    fansListError.value = detail.fansListError || ''
  }
  if ('fansListLoaded' in detail) {
    fansListLoaded.value = Boolean(detail.fansListLoaded)
  }
  if ('managedLoading' in detail) {
    managedLoading.value = Boolean(detail.managedLoading)
  }

  const keepaliveConfig = getKeepaliveConfig()
  keepaliveEnabled.value = isTaskActive(keepaliveConfig)
  keepaliveCron.value = keepaliveConfig.cron || DEFAULT_KEEPALIVE_CRON
  keepaliveModel.value = normalizeModel(keepaliveConfig.model)
  fanRows.value = buildFanRows(fans.value, keepaliveConfig)
  void ensureCronPreview()
}

function buildSendPayload(): JobConfig {
  const send: Record<string, SendGift> = {}
  for (const row of fanRows.value) {
    const value = Number(row.value || 0)
    send[String(row.roomId)] = {
      roomId: row.roomId,
      giftId: 268,
      number: keepaliveModel.value === 2 ? value : 0,
      weight: keepaliveModel.value === 1 ? value : 0,
      count: 0,
    }
  }

  return {
    active: true,
    cron: keepaliveCron.value.trim(),
    model: keepaliveModel.value,
    send,
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
  const currentConfig = managedConfig.value?.keepalive || rawConfig.value?.keepalive || legacyDeps?.getManagedConfig().keepalive || legacyDeps?.getRawConfig().keepalive || {
    active: true,
    cron: DEFAULT_KEEPALIVE_CRON,
    model: DEFAULT_KEEPALIVE_MODEL,
    send: {},
  }
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
    endpoint: '/api/trigger/keepalive',
    isUnauthorizedError,
    refresh: [
      () => legacyDeps?.loadOverview?.(),
      () => legacyDeps?.loadLogs?.(),
      () => legacyDeps?.loadFansStatus?.(false),
    ],
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

  const keepaliveNote = computed(() => {
    if (!hasCookieSourceConfigured(rawConfig.value)) {
      return '请先保存 Cookie 或启用 CookieCloud。没有登录凭证时无法同步粉丝牌，也不会生成保活房间列表。'
    }
    if (managedLoading.value && !fanRows.value.length) {
      return '正在同步粉丝牌与保活配置…'
    }
    if (!fanRows.value.length) {
      if (fansListError.value) {
        return '粉丝牌列表加载失败。'
      }
      return fansListLoaded.value ? '当前没有可用粉丝牌。' : '粉丝牌列表尚未加载。'
    }
    return `${managedLoading.value ? '正在后台同步，当前显示上次结果。' : ''}当前已同步 ${fanRows.value.length} 个粉丝牌房间。`
  })

  const keepaliveEmptyText = computed(() => {
    if (!hasCookieSourceConfigured(rawConfig.value)) {
      return '保存 Cookie 或启用 CookieCloud 后再同步粉丝牌，这里才会出现房间列表。'
    }
    if (managedLoading.value && !fanRows.value.length) {
      return '请稍候…'
    }
    if (!fanRows.value.length && fansListError.value) {
      return `加载粉丝牌列表失败：${fansListError.value}。请点击顶部“刷新”重试。`
    }
    if (!fanRows.value.length && fansListLoaded.value) {
      return '已同步，但当前账号没有可用粉丝牌数据。'
    }
    return '正在准备加载粉丝牌列表，也可以点击刷新手动加载。'
  })

  const showKeepaliveTable = computed(() => hasCookieSourceConfigured(rawConfig.value) && fanRows.value.length > 0)
  const keepaliveValueLabel = computed(() => keepaliveModel.value === 2 ? '数量' : '权重值')

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
