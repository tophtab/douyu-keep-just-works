import type { BackpackGiftRow, ExpiringGiftConfig, Fans, GiftStatus } from '../../core/types'
import { computed, ref } from 'vue'
import type { AllocationFanRow } from './allocation-task'
import { buildAllocationFanRows, buildAllocationSendMap, normalizeAllocationModel } from './allocation-task'
import { useCronPreview } from './composables/use-cron-preview'
import { formatDate } from './datetime'
import { createPendingTaskCard, createScheduledTaskCard, disableTaskConfig, hasCookieSourceConfigured, isHttpUnauthorized, isTaskActive, saveTaskConfig, triggerTask, useLegacyPageEvents } from './task-shared'
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

interface ExpiringPageDetail {
  fans?: Fans[]
  fansListError?: string
  fansListLoaded?: boolean
  fansStatusDetailsLoading?: boolean
  fansStatusLoaded?: boolean
  fansStatusLoading?: boolean
  giftStatus?: GiftStatus | null
  managedConfig?: RawExpiringConfig | null
  managedLoading?: boolean
  overview?: ExpiringOverview | null
  rawConfig?: RawExpiringConfig | null
}

interface LegacyExpiringDeps {
  getManagedConfig: () => RawExpiringConfig
  getManagedFans: () => Fans[]
  getRawConfig: () => RawExpiringConfig
  isUnauthorizedError: (error: unknown) => boolean
  loadFansStatus?: (forceRefresh?: boolean) => Promise<unknown>
  loadLogs?: () => Promise<unknown>
  loadOverview?: () => Promise<unknown>
  refreshOverviewSurface: (showToast: boolean) => Promise<unknown>
}

interface LegacyExpiringActions {
  disableExpiringGiftConfig: () => Promise<void>
  saveExpiringGiftConfig: (options?: { revertCheckboxOnError?: boolean }) => Promise<void>
}

type ExpiringFanRow = AllocationFanRow

interface ExpiringBackpackRow {
  autoRelease: boolean
  count: number
  expireText: string
  giftId: number
  inThreshold: boolean
  index: number
  name: string
  remainingText: string
}

const DEFAULT_EXPIRING_CRON = '0 45 23 * * *'
const DEFAULT_EXPIRING_MODEL: 1 | 2 = 1
const DEFAULT_EXPIRING_THRESHOLD_HOURS = 24
const EXPIRING_PAGE_EVENT_NAME = 'douyu-keep-webui:expiring-page'

const overview = ref<ExpiringOverview | null>(null)
const rawConfig = ref<RawExpiringConfig | null>(null)
const managedConfig = ref<RawExpiringConfig | null>(null)
const fans = ref<Fans[]>([])
const fansListError = ref('')
const fansListLoaded = ref(false)
const fansStatusLoaded = ref(false)
const fansStatusLoading = ref(false)
const fansStatusDetailsLoading = ref(false)
const managedLoading = ref(false)
const giftStatus = ref<GiftStatus | null>(null)
const expiringEnabled = ref(false)
const expiringCron = ref(DEFAULT_EXPIRING_CRON)
const expiringThresholdHours = ref(DEFAULT_EXPIRING_THRESHOLD_HOURS)
const expiringModel = ref<1 | 2>(DEFAULT_EXPIRING_MODEL)
const fanRows = ref<ExpiringFanRow[]>([])
const { cronPreviewText: expiringCronPreviewText, ensureCronPreview, loadCronPreview: loadExpiringCronPreview } = useCronPreview(() => expiringCron.value)

let legacyDeps: LegacyExpiringDeps | null = null

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_EXPIRING_TASK_ACTIONS?: {
      create: (deps: LegacyExpiringDeps) => LegacyExpiringActions
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
  return normalizeAllocationModel(model, DEFAULT_EXPIRING_MODEL)
}

function normalizeThresholdHours(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EXPIRING_THRESHOLD_HOURS
}

function getExpiringConfig(): ExpiringGiftConfig {
  return managedConfig.value?.expiringGift || rawConfig.value?.expiringGift || {
    active: false,
    cron: DEFAULT_EXPIRING_CRON,
    thresholdHours: DEFAULT_EXPIRING_THRESHOLD_HOURS,
    model: DEFAULT_EXPIRING_MODEL,
    send: {},
  }
}

function buildFanRows(nextFans: Fans[], config: ExpiringGiftConfig): ExpiringFanRow[] {
  const model = normalizeModel(config.model)
  return buildAllocationFanRows(nextFans, {
    model,
    send: config.send,
    defaultValue: (_fan, index, currentModel) => currentModel === 2 ? 1 : (index === 0 ? 1 : 0),
  })
}

function applyExpiringConfig(config: ExpiringGiftConfig): void {
  expiringEnabled.value = isTaskActive(config)
  expiringCron.value = config.cron || DEFAULT_EXPIRING_CRON
  expiringThresholdHours.value = normalizeThresholdHours(config.thresholdHours)
  expiringModel.value = normalizeModel(config.model)
  fanRows.value = buildFanRows(fans.value, config)
  void ensureCronPreview()
}

function applyRawConfig(config: RawExpiringConfig | null): void {
  rawConfig.value = config
  applyExpiringConfig(getExpiringConfig())
}

function applyExpiringPageDetail(detail: ExpiringPageDetail): void {
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
  if ('fansStatusLoaded' in detail) {
    fansStatusLoaded.value = Boolean(detail.fansStatusLoaded)
  }
  if ('fansStatusLoading' in detail) {
    fansStatusLoading.value = Boolean(detail.fansStatusLoading)
  }
  if ('fansStatusDetailsLoading' in detail) {
    fansStatusDetailsLoading.value = Boolean(detail.fansStatusDetailsLoading)
  }
  if ('managedLoading' in detail) {
    managedLoading.value = Boolean(detail.managedLoading)
  }
  if ('giftStatus' in detail) {
    giftStatus.value = detail.giftStatus || null
  }

  applyExpiringConfig(getExpiringConfig())
}

function buildExpiringPayload(): ExpiringGiftConfig {
  return {
    active: true,
    cron: expiringCron.value.trim(),
    thresholdHours: normalizeThresholdHours(expiringThresholdHours.value),
    model: expiringModel.value,
    send: buildAllocationSendMap(fanRows.value, expiringModel.value),
  }
}

async function refreshExpiringSurfaces(): Promise<void> {
  await legacyDeps?.refreshOverviewSurface(false)
}

async function saveExpiringGiftConfig(options?: { revertCheckboxOnError?: boolean }): Promise<void> {
  await saveTaskConfig({
    payload: { expiringGift: buildExpiringPayload() },
    successMessage: '临期任务已保存并启用',
    failurePrefix: '保存并启用临期任务失败：',
    setEnabled: (enabled) => {
      expiringEnabled.value = enabled
    },
    revertCheckboxOnError: options?.revertCheckboxOnError,
    isUnauthorizedError,
    refresh: refreshExpiringSurfaces,
  })
}

async function disableExpiringGiftConfig(): Promise<void> {
  const currentConfig = managedConfig.value?.expiringGift || rawConfig.value?.expiringGift || legacyDeps?.getManagedConfig().expiringGift || legacyDeps?.getRawConfig().expiringGift || {
    active: false,
    cron: DEFAULT_EXPIRING_CRON,
    thresholdHours: DEFAULT_EXPIRING_THRESHOLD_HOURS,
    model: DEFAULT_EXPIRING_MODEL,
    send: {},
  }
  await disableTaskConfig({
    payload: {
      expiringGift: {
        active: false,
        cron: currentConfig.cron || DEFAULT_EXPIRING_CRON,
        thresholdHours: normalizeThresholdHours(currentConfig.thresholdHours),
        model: normalizeModel(currentConfig.model),
        send: currentConfig.send || {},
      },
    },
    successMessage: '临期任务已停用',
    failurePrefix: '停用临期任务失败：',
    restoreEnabled: () => {
      expiringEnabled.value = true
    },
    isUnauthorizedError,
    refresh: refreshExpiringSurfaces,
  })
}

async function triggerExpiringTask(): Promise<void> {
  await triggerTask({
    endpoint: '/api/trigger/expiringGift',
    isUnauthorizedError,
    refresh: [
      () => legacyDeps?.loadOverview?.(),
      () => legacyDeps?.loadLogs?.(),
      () => legacyDeps?.loadFansStatus?.(false),
    ],
    onSuccess: () => {
      if (legacyDeps) {
        fans.value = legacyDeps.getManagedFans()
        managedConfig.value = legacyDeps.getManagedConfig()
        applyExpiringConfig(getExpiringConfig())
      }
    },
  })
}

function formatTimestamp(value: number | undefined): string {
  if (!value) {
    return '-'
  }
  return formatDate(new Date(value).toISOString())
}

function formatRemainingTime(expireTime: number | undefined): string {
  if (!expireTime) {
    return '-'
  }
  const remainingMs = expireTime - Date.now()
  const remainingHours = Math.max(0, remainingMs / (60 * 60 * 1000))
  if (remainingHours >= 48) {
    return `${(remainingHours / 24).toFixed(1).replace(/\.0$/, '')} 天`
  }
  return `${remainingHours.toFixed(1).replace(/\.0$/, '')} 小时`
}

function describeBackpackRow(row: BackpackGiftRow, thresholdHours: number): { autoRelease: boolean; inThreshold: boolean } {
  const count = Number(row.count || 0)
  const expireTime = Number(row.expireTime || 0)
  if (count <= 0 || !expireTime) {
    return { inThreshold: false, autoRelease: false }
  }
  const inThreshold = expireTime - Date.now() <= thresholdHours * 60 * 60 * 1000
  return { inThreshold, autoRelease: inThreshold }
}

export function useExpiringGiftTaskPage() {
  const expiringTaskCard = computed(() => {
    if (!overview.value) {
      return createPendingTaskCard('阈值')
    }

    const configured = Boolean(overview.value.expiringGiftConfigured)
    const status = overview.value.status?.expiringGift || {}
    return createScheduledTaskCard(configured, status, { label: '阈值', value: `${normalizeThresholdHours(getExpiringConfig().thresholdHours)} 小时` })
  })

  const expiringNote = computed(() => {
    if (!hasCookieSourceConfigured(rawConfig.value)) {
      return '请先保存 Cookie 或启用 CookieCloud。没有登录凭证时无法同步粉丝牌，也无法读取背包礼物和过期时间。'
    }
    if (managedLoading.value && !fanRows.value.length) {
      return '正在同步粉丝牌与临期配置…'
    }
    if (!fanRows.value.length) {
      if (fansListError.value) {
        return '粉丝牌列表加载失败。'
      }
      return fansStatusLoaded.value || fansListLoaded.value ? '当前没有可用粉丝牌。' : '粉丝牌列表尚未加载。'
    }
    return `${managedLoading.value || fansStatusLoading.value ? '正在后台更新，当前显示上次结果。' : ''}当前已同步 ${fanRows.value.length} 个粉丝牌房间。临期任务会按背包行筛选进入阈值且有明确过期时间的礼物，并按房间配置释放。`
  })

  const expiringTableEmptyText = computed(() => {
    if (!hasCookieSourceConfigured(rawConfig.value)) {
      return '保存 Cookie 或启用 CookieCloud 后再同步粉丝牌，这里才会出现临期赠送房间列表。'
    }
    if (managedLoading.value && !fanRows.value.length) {
      return '请稍候…'
    }
    if (!fanRows.value.length && fansListError.value) {
      return `加载粉丝牌列表失败：${fansListError.value}。请点击顶部“刷新”重试。`
    }
    if (!fanRows.value.length && (fansStatusLoaded.value || fansListLoaded.value)) {
      return '已同步，但当前账号没有可用粉丝牌数据。'
    }
    return '正在准备加载粉丝牌列表，也可以点击刷新手动加载。'
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

  const expiringBackpackRows = computed<ExpiringBackpackRow[]>(() => {
    const rows = giftStatus.value?.rows || []
    return rows.map((row, index) => {
      const rowState = describeBackpackRow(row, normalizeThresholdHours(expiringThresholdHours.value))
      return {
        autoRelease: rowState.autoRelease,
        count: Number(row.count || 0),
        expireText: formatTimestamp(row.expireTime),
        giftId: row.giftId,
        inThreshold: rowState.inThreshold,
        index: index + 1,
        name: row.name || '未知礼物',
        remainingText: formatRemainingTime(row.expireTime),
      }
    })
  })

  const showExpiringTable = computed(() => hasCookieSourceConfigured(rawConfig.value) && fanRows.value.length > 0)
  const showExpiringBackpackTable = computed(() => Boolean(giftStatus.value && !giftStatus.value.error && expiringBackpackRows.value.length))
  const expiringValueLabel = computed(() => expiringModel.value === 2 ? '数量' : '权重值')

  function handleExpiringToggle(): void {
    if (expiringEnabled.value) {
      void saveExpiringGiftConfig({ revertCheckboxOnError: true })
      return
    }
    void disableExpiringGiftConfig()
  }

  function handleExpiringModelChange(): void {
    fanRows.value = buildFanRows(fans.value, {
      ...getExpiringConfig(),
      model: expiringModel.value,
    })
  }

  useLegacyPageEvents<ExpiringPageDetail, RawExpiringConfig, ExpiringOverview>({
    pageEventName: EXPIRING_PAGE_EVENT_NAME,
    onPageDetail: applyExpiringPageDetail,
    onRawConfig: applyRawConfig,
    onOverview: (nextOverview) => {
      overview.value = nextOverview
    },
    ensureCronPreview,
  })

  return {
    expiringBackpackEmptyText,
    expiringBackpackRows,
    expiringCron,
    expiringCronPreviewText,
    expiringEnabled,
    expiringFanRows: fanRows,
    expiringModel,
    expiringNote,
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

function createLegacyExpiringActions(deps: LegacyExpiringDeps): LegacyExpiringActions {
  legacyDeps = deps
  rawConfig.value = deps.getRawConfig()
  managedConfig.value = deps.getManagedConfig()
  fans.value = deps.getManagedFans()
  applyRawConfig(rawConfig.value)

  return {
    disableExpiringGiftConfig,
    saveExpiringGiftConfig,
  }
}

export function dispatchExpiringPageState(detail: ExpiringPageDetail): void {
  document.dispatchEvent(new CustomEvent(EXPIRING_PAGE_EVENT_NAME, { detail }))
}

export function installLegacyExpiringTaskBridge(): void {
  window.DOUYU_KEEP_WEBUI_EXPIRING_TASK_ACTIONS = {
    create: createLegacyExpiringActions,
  }
}
