import type { BackpackGiftRow, ExpiringGiftConfig, Fans, GiftStatus } from '../../core/types'
import { computed, ref, watch } from 'vue'
import { DEFAULT_EXPIRING_GIFT_CRON, DEFAULT_EXPIRING_GIFT_MODEL, DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS } from '../../core/task-defaults'
import type { AllocationFanRow } from './allocation-task'
import { buildAllocationFanRows, buildAllocationSendMap, normalizeAllocationModel } from './allocation-task'
import { useCronPreview } from './composables/use-cron-preview'
import { formatDate } from './datetime'
import { rawConfig as sharedRawConfig } from './resource-config'
import { fansListError as sharedFansListError, fansListLoaded as sharedFansListLoaded, fansStatus as sharedFansStatus, fansStatusDetailsLoading as sharedFansStatusDetailsLoading, fansStatusLoaded as sharedFansStatusLoaded, fansStatusLoading as sharedFansStatusLoading, getManagedConfig, getManagedFans, giftStatus as sharedGiftStatus, managed, managedLoading as sharedManagedLoading } from './resource-fans'
import { overview as sharedOverview } from './resource-state'
import { createOverviewTaskCard, disableEnabledTask, refreshTaskSurface, saveEnabledTask, toggleEnabledTask, triggerFansBackedTask } from './task-page-actions'
import { createFanListMessages, getAllocationValueLabel, hasCookieSourceConfigured, hasFanTaskTableRows, isTaskActive, resolveCurrentTaskConfig } from './task-shared'
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
const expiringCron = ref(DEFAULT_EXPIRING_GIFT_CRON)
const expiringThresholdHours = ref(DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS)
const expiringModel = ref<1 | 2>(DEFAULT_EXPIRING_GIFT_MODEL)
const fanRows = ref<ExpiringFanRow[]>([])
const { cronPreviewText: expiringCronPreviewText, ensureCronPreview, loadCronPreview: loadExpiringCronPreview } = useCronPreview(() => expiringCron.value)

function normalizeModel(model: unknown): 1 | 2 {
  return normalizeAllocationModel(model, DEFAULT_EXPIRING_GIFT_MODEL)
}

function normalizeThresholdHours(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS
}

function getExpiringConfig(): ExpiringGiftConfig {
  return resolveCurrentTaskConfig({
    configKey: 'expiringGift',
    managedConfig: managedConfig.value,
    rawConfig: rawConfig.value,
    fallback: {
      active: false,
      cron: DEFAULT_EXPIRING_GIFT_CRON,
      thresholdHours: DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
      model: DEFAULT_EXPIRING_GIFT_MODEL,
      send: {},
    },
  })
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
  expiringCron.value = config.cron || DEFAULT_EXPIRING_GIFT_CRON
  expiringThresholdHours.value = normalizeThresholdHours(config.thresholdHours)
  expiringModel.value = normalizeModel(config.model)
  fanRows.value = buildFanRows(fans.value, config)
  void ensureCronPreview()
}

function applyResourceState(): void {
  rawConfig.value = sharedRawConfig.value
  managedConfig.value = getManagedConfig()
  overview.value = sharedOverview.value
  fans.value = getManagedFans()
  fansListError.value = sharedFansListError.value
  fansListLoaded.value = sharedFansListLoaded.value
  fansStatusLoaded.value = sharedFansStatusLoaded.value
  fansStatusLoading.value = sharedFansStatusLoading.value
  fansStatusDetailsLoading.value = sharedFansStatusDetailsLoading.value
  managedLoading.value = sharedManagedLoading.value
  giftStatus.value = sharedGiftStatus.value
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
  const currentConfig = resolveCurrentTaskConfig({
    configKey: 'expiringGift',
    managedConfig: managedConfig.value,
    rawConfig: rawConfig.value,
    fallback: {
      active: false,
      cron: DEFAULT_EXPIRING_GIFT_CRON,
      thresholdHours: DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
      model: DEFAULT_EXPIRING_GIFT_MODEL,
      send: {},
    },
  })
  await disableEnabledTask({
    payload: {
      expiringGift: {
        active: false,
        cron: currentConfig.cron || DEFAULT_EXPIRING_GIFT_CRON,
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
    refresh: refreshExpiringSurfaces,
  })
}

async function triggerExpiringTask(): Promise<void> {
  await triggerFansBackedTask('expiringGift', applyResourceState)
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

  const expiringMessages = computed(() => {
    return createFanListMessages({
      rawConfig: rawConfig.value,
      managedLoading: managedLoading.value,
      rowCount: fanRows.value.length,
      fansListError: fansListError.value,
      fansListLoaded: fansStatusLoaded.value || fansListLoaded.value,
      missingCredentialText: '请先保存 Cookie 或启用 CookieCloud。没有登录凭证时无法同步粉丝牌，也无法读取背包礼物和过期时间。',
      emptyMissingCredentialText: '保存 Cookie 或启用 CookieCloud 后再同步粉丝牌，这里才会出现临期赠送房间列表。',
      loadingText: '正在同步粉丝牌与临期配置…',
      readyText: `${managedLoading.value || fansStatusLoading.value ? '正在后台更新，当前显示上次结果。' : ''}当前已同步 ${fanRows.value.length} 个粉丝牌房间。临期任务会按背包行筛选进入阈值且有明确过期时间的礼物，并按房间配置释放。`,
    })
  })

  const expiringNote = computed(() => expiringMessages.value.note)
  const expiringTableEmptyText = computed(() => expiringMessages.value.emptyText)

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

  const showExpiringTable = computed(() => hasFanTaskTableRows(rawConfig.value, fanRows.value.length))
  const showExpiringBackpackTable = computed(() => Boolean(giftStatus.value && !giftStatus.value.error && expiringBackpackRows.value.length))
  const expiringValueLabel = computed(() => getAllocationValueLabel(expiringModel.value))

  function handleExpiringToggle(): void {
    toggleEnabledTask(expiringEnabled, saveExpiringGiftConfig, disableExpiringGiftConfig)
  }

  function handleExpiringModelChange(): void {
    fanRows.value = buildFanRows(fans.value, {
      ...getExpiringConfig(),
      model: expiringModel.value,
    })
  }

  watch([
    sharedRawConfig,
    managed,
    sharedFansStatus,
    sharedOverview,
    sharedManagedLoading,
    sharedFansListError,
    sharedFansListLoaded,
    sharedFansStatusLoaded,
    sharedFansStatusLoading,
    sharedFansStatusDetailsLoading,
    sharedGiftStatus,
  ], applyResourceState, { immediate: true })

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
