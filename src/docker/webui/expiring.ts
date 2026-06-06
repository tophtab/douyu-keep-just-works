import type { BackpackGiftRow, ExpiringGiftConfig, Fans, GiftStatus } from '../../core/types'
import { computed, ref } from 'vue'
import { DEFAULT_EXPIRING_GIFT_CRON, DEFAULT_EXPIRING_GIFT_MODEL, DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS } from '../../core/task-defaults'
import type { AllocationFanRow } from './allocation-task'
import { buildAllocationFanRows, buildAllocationSendMap, normalizeAllocationModel } from './allocation-task'
import { useCronPreview } from './composables/use-cron-preview'
import { createFansBackedTaskPageState } from './fans-backed-task-page'
import { fansStatusDetailsLoading as sharedFansStatusDetailsLoading, fansStatusLoaded as sharedFansStatusLoaded, giftStatus as sharedGiftStatus } from './resource-fans'
import { createOverviewTaskCard, disableEnabledTask, refreshTaskSurface, saveEnabledTask, toggleEnabledTask, triggerFansBackedTask } from './task-page-actions'
import { createDisabledAllocationTaskConfig, createFanListEmptyText, createTaskConfigAccessor, getAllocationValueLabel, hasCookieSourceConfigured, hasFanTaskTableRows, isTaskActive } from './task-shared'
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
  count: number
  expireText: string
  giftId: number
  inThreshold: boolean
  index: number
  intimacy: number
  name: string
  remainingText: string
}

const taskPage = createFansBackedTaskPageState<ExpiringOverview, RawExpiringConfig, Fans>()
const { fans, fansListError, fansListLoaded, managedConfig, managedLoading, overview, rawConfig } = taskPage
const fansStatusLoaded = ref(false)
const fansStatusDetailsLoading = ref(false)
const giftStatus = ref<GiftStatus | null>(null)
const expiringEnabled = ref(false)
const expiringCron = ref(DEFAULT_EXPIRING_GIFT_CRON)
const expiringThresholdHours = ref(DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS)
const expiringModel = ref<1 | 2>(DEFAULT_EXPIRING_GIFT_MODEL)
const fanRows = ref<ExpiringFanRow[]>([])
const { cronPreviewText: expiringCronPreviewText, ensureCronPreview, loadCronPreview: loadExpiringCronPreview } = useCronPreview(() => expiringCron.value)

const EXPIRING_CONFIG_FALLBACK: ExpiringGiftConfig = {
  active: false,
  cron: DEFAULT_EXPIRING_GIFT_CRON,
  thresholdHours: DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS,
  model: DEFAULT_EXPIRING_GIFT_MODEL,
  send: {},
}

function normalizeModel(model: unknown): 1 | 2 {
  return normalizeAllocationModel(model, DEFAULT_EXPIRING_GIFT_MODEL)
}

function normalizeThresholdHours(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS
}

const getExpiringConfig = createTaskConfigAccessor<ExpiringGiftConfig, RawExpiringConfig>({
  configKey: 'expiringGift',
  fallback: EXPIRING_CONFIG_FALLBACK,
  getManagedConfig: () => managedConfig.value,
  getRawConfig: () => rawConfig.value,
})

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
  taskPage.syncResourceState()
  fansStatusLoaded.value = sharedFansStatusLoaded.value
  fansStatusDetailsLoading.value = sharedFansStatusDetailsLoading.value
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
  const currentConfig = getExpiringConfig()
  await disableEnabledTask({
    payload: {
      expiringGift: {
        ...createDisabledAllocationTaskConfig(currentConfig, {
          defaultCron: DEFAULT_EXPIRING_GIFT_CRON,
          normalizeModel,
        }),
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

function formatTimestamp(value: number | undefined): string {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  try {
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    }).formatToParts(date)
    const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || '00'
    return `${getPart('month')}/${getPart('day')} ${getPart('hour')}:${getPart('minute')}`
  } catch {
    const shanghaiTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)
    const pad = (part: number): string => String(part).padStart(2, '0')
    return `${pad(shanghaiTime.getUTCMonth() + 1)}/${pad(shanghaiTime.getUTCDate())} ${pad(shanghaiTime.getUTCHours())}:${pad(shanghaiTime.getUTCMinutes())}`
  }
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

  const expiringBackpackRows = computed<ExpiringBackpackRow[]>(() => {
    const rows = giftStatus.value?.rows || []
    return rows.map((row, index) => {
      const rowState = describeBackpackRow(row, normalizeThresholdHours(expiringThresholdHours.value))
      return {
        count: Number(row.count || 0),
        expireText: formatTimestamp(row.expireTime),
        giftId: row.giftId,
        inThreshold: rowState.inThreshold,
        index: index + 1,
        intimacy: Number(row.intimacy || 0),
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
