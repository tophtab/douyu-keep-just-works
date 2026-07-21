import type { DoubleCardConfig, DoubleCardGiftScope, Fans, FanStatus } from '../../core/types'
import { computed, ref } from 'vue'
import { DEFAULT_DOUBLE_CARD_ALLOCATION_MODE, DEFAULT_DOUBLE_CARD_CRON, DEFAULT_DOUBLE_CARD_GIFT_SCOPE } from '../../core/task-defaults'
import type { AllocationFanRow } from './allocation-task'
import { allocationModeToModel, buildAllocationConfig, buildAllocationFanRows, buildParticipatingRoomIds, formatRatioPercent } from './allocation-task'
import { useCronPreview } from './composables/use-cron-preview'
import { createFansBackedTaskPageState } from './fans-backed-task-page'
import { createOverviewTaskCard, disableEnabledTask, refreshTaskSurface, saveEnabledTask, toggleEnabledTask, triggerFansBackedTask } from './task-page-actions'
import { createDisabledAllocationTaskConfig, createFanListEmptyText, createTaskConfigAccessor, getAllocationValueLabel, hasFanTaskTableRows, isTaskEnabled } from './task-shared'
import { showToast } from './toast'
import type { CookieSourceConfig, TaskRunStatus } from './task-shared'

interface DoubleOverview {
  doubleCardConfigured?: boolean
  doubleCardRooms?: number
  status?: {
    doubleCard?: TaskRunStatus
  }
}

interface RawDoubleConfig extends CookieSourceConfig {
  doubleCard?: DoubleCardConfig
}

type DoubleFan = Fans & Partial<Pick<FanStatus, 'doubleActive'>>

interface DoubleFanRow extends AllocationFanRow {
  doubleActive?: boolean
  enabled: boolean
}

const taskPage = createFansBackedTaskPageState<DoubleOverview, RawDoubleConfig, DoubleFan>()
const { fans, fansListError, fansListLoaded, managedConfig, managedLoading, overview, rawConfig } = taskPage
const doubleEnabled = ref(false)
const doubleCron = ref(DEFAULT_DOUBLE_CARD_CRON)
const doubleModel = ref<1 | 2>(allocationModeToModel(DEFAULT_DOUBLE_CARD_ALLOCATION_MODE, DEFAULT_DOUBLE_CARD_ALLOCATION_MODE))
const doubleGiftScope = ref<DoubleCardGiftScope>(DEFAULT_DOUBLE_CARD_GIFT_SCOPE)
const fanRows = ref<DoubleFanRow[]>([])
const { cronPreviewText: doubleCronPreviewText, ensureCronPreview, loadCronPreview: loadDoubleCronPreview } = useCronPreview(() => doubleCron.value)

const DOUBLE_CONFIG_FALLBACK: DoubleCardConfig = {
  enabled: true,
  cron: DEFAULT_DOUBLE_CARD_CRON,
  giftScope: DEFAULT_DOUBLE_CARD_GIFT_SCOPE,
  participatingRoomIds: [],
  allocationMode: DEFAULT_DOUBLE_CARD_ALLOCATION_MODE,
  roomAllocations: {},
}

function normalizeModel(mode: unknown): 1 | 2 {
  return allocationModeToModel(mode, DEFAULT_DOUBLE_CARD_ALLOCATION_MODE)
}

function normalizeGiftScope(scope: unknown): DoubleCardGiftScope {
  return scope === 'limitedTime' ? 'limitedTime' : DEFAULT_DOUBLE_CARD_GIFT_SCOPE
}

const getDoubleConfig = createTaskConfigAccessor<DoubleCardConfig, RawDoubleConfig>({
  configKey: 'doubleCard',
  fallback: DOUBLE_CONFIG_FALLBACK,
  getManagedConfig: () => managedConfig.value,
  getRawConfig: () => rawConfig.value,
})

function buildFanRows(nextFans: DoubleFan[], config: DoubleCardConfig): DoubleFanRow[] {
  const model = normalizeModel(config.allocationMode)
  const participatingRoomIds = new Set(config.participatingRoomIds)
  return buildAllocationFanRows(nextFans, {
    model,
    roomAllocations: config.roomAllocations,
    defaultValue: () => 1,
    extra: fan => ({
      doubleActive: typeof fan.doubleActive === 'boolean' ? fan.doubleActive : undefined,
      enabled: participatingRoomIds.has(fan.roomId),
    }),
  })
}

function applyDoubleConfig(config: DoubleCardConfig): void {
  doubleEnabled.value = isTaskEnabled(config)
  doubleCron.value = config.cron || DEFAULT_DOUBLE_CARD_CRON
  doubleModel.value = normalizeModel(config.allocationMode)
  doubleGiftScope.value = normalizeGiftScope(config.giftScope)
  fanRows.value = buildFanRows(fans.value, config)
  void ensureCronPreview()
}

function applyResourceState(): void {
  taskPage.syncResourceState()
  applyDoubleConfig(getDoubleConfig())
}

function buildDoublePayload(): DoubleCardConfig {
  return {
    enabled: true,
    cron: doubleCron.value.trim(),
    giftScope: doubleGiftScope.value,
    participatingRoomIds: buildParticipatingRoomIds(fanRows.value),
    ...buildAllocationConfig(fanRows.value, doubleModel.value),
  }
}

function formatDoubleRoomCount(currentOverview: DoubleOverview | null, rows: DoubleFanRow[]): string {
  if (!rows.length) {
    return String(currentOverview?.doubleCardRooms ?? 0)
  }
  const selectedRooms = rows.filter(row => row.enabled).length
  return `${selectedRooms}/${rows.length}`
}

async function refreshDoubleSurfaces(): Promise<void> {
  await refreshTaskSurface('double-card')
}

async function saveDoubleConfig(options?: { revertCheckboxOnError?: boolean }): Promise<void> {
  doubleEnabled.value = true
  const nextConfig = buildDoublePayload()
  if (nextConfig.allocationMode === 'weighted') {
    const participatingRoomIds = nextConfig.participatingRoomIds.map(String)
    const totalWeight = participatingRoomIds.reduce((sum, roomId) => sum + Number(nextConfig.roomAllocations[roomId]?.weight || 0), 0)
    if (participatingRoomIds.length > 0 && totalWeight <= 0) {
      showToast('按权重模式至少需要一个已勾选房间填写大于 0 的权重值', false)
      return
    }
  }

  await saveEnabledTask({
    payload: { doubleCard: nextConfig },
    successMessage: '双倍任务已保存并启用',
    failurePrefix: '保存并启用双倍任务失败：',
    enabled: doubleEnabled,
    revertCheckboxOnError: options?.revertCheckboxOnError,
    refresh: refreshDoubleSurfaces,
  })
}

async function disableDoubleConfig(): Promise<void> {
  const currentConfig = getDoubleConfig()
  await disableEnabledTask({
    payload: {
      doubleCard: {
        ...createDisabledAllocationTaskConfig(currentConfig),
        giftScope: normalizeGiftScope(currentConfig.giftScope),
        participatingRoomIds: currentConfig.participatingRoomIds,
      },
    },
    successMessage: '双倍任务已停用',
    failurePrefix: '停用双倍任务失败：',
    restoreEnabled: () => {
      doubleEnabled.value = true
    },
    refresh: refreshDoubleSurfaces,
  })
}

async function triggerDoubleTask(): Promise<void> {
  await triggerFansBackedTask('doubleCard', applyResourceState)
}

export function useDoubleTaskPage() {
  const doubleTaskCard = computed(() => {
    const currentOverview = overview.value
    const configured = Boolean(currentOverview?.doubleCardConfigured)
    const status = currentOverview?.status?.doubleCard || {}
    return createOverviewTaskCard({
      overviewReady: Boolean(currentOverview),
      pendingThirdLabel: '房间数',
      configured,
      status,
      thirdCell: { label: '房间数', value: configured ? formatDoubleRoomCount(currentOverview, fanRows.value) : '0' },
    })
  })

  const doubleEmptyText = computed(() => {
    return createFanListEmptyText({
      rawConfig: rawConfig.value,
      managedLoading: managedLoading.value,
      rowCount: fanRows.value.length,
      fansListError: fansListError.value,
      fansListLoaded: fansListLoaded.value,
      emptyMissingCredentialText: '保存 Cookie 或启用 CookieCloud 后再同步粉丝牌，这里才会出现房间列表。',
    })
  })

  const showDoubleTable = computed(() => hasFanTaskTableRows(rawConfig.value, fanRows.value.length))
  const doubleValueLabel = computed(() => getAllocationValueLabel(doubleModel.value))
  const showDoubleRatioTools = computed(() => doubleModel.value === 1)
  const doubleModeHelp = computed(() => {
    if (managedLoading.value && !fanRows.value.length) {
      return '正在同步双倍任务配置。'
    }
    if (!fanRows.value.length) {
      return '按权重模式会在当前开双倍的房间之间重新分配。'
    }
    if (doubleModel.value === 2) {
      return '按固定数量时，会只在当前开双倍的房间里使用你填写的数量。没有房间开双倍时本次不送；只有 1 个房间开双倍时本次全部送给它。'
    }
    return ''
  })

  const doubleRatioPreview = computed(() => {
    if (managedLoading.value && !fanRows.value.length) {
      return '同步完成后，这里会显示当前权重预览。'
    }
    if (!fanRows.value.length) {
      if (fansListError.value) {
        return '粉丝牌列表加载失败，刷新成功后会显示当前权重预览。'
      }
      return fansListLoaded.value ? '当前没有可用于预览的粉丝牌房间。' : '粉丝牌列表加载后，这里会显示当前权重预览。'
    }
    if (doubleModel.value === 2) {
      return '固定数量模式保留现有行为。如果你想平均分配，切回“按权重”后点击“平均权重”即可。'
    }

    const enabledEntries = fanRows.value.filter(row => row.enabled)
    if (!enabledEntries.length) {
      return '当前还没有勾选参与双倍的房间。'
    }

    const positiveEntries = enabledEntries.filter(row => row.value > 0)
    if (!positiveEntries.length) {
      return '当前已勾选房间的权重值全是 0。至少给一个已勾选房间填写大于 0 的权重值。'
    }

    const totalWeight = positiveEntries.reduce((sum, row) => sum + row.value, 0)
    const ratioText = positiveEntries.map(row => `${row.name}(${row.value})`).join(' / ')
    const percentText = positiveEntries.map(row => `${row.name} ${formatRatioPercent((row.value / totalWeight) * 100)}`).join(' / ')
    return `当前权重：${ratioText}\n折算占比：${percentText}`
  })

  function handleDoubleToggle(): void {
    toggleEnabledTask(doubleEnabled, saveDoubleConfig, disableDoubleConfig)
  }

  function applyDoubleRatioPreset(preset: 'equal' | 'level'): void {
    if (doubleModel.value !== 1) {
      showToast('当前不是按权重模式', false)
      return
    }

    let updated = 0
    for (const row of fanRows.value) {
      if (!row.enabled) {
        continue
      }
      if (preset === 'level') {
        const level = Number(row.level)
        row.value = Number.isFinite(level) ? Math.max(level, 1) : 1
      } else {
        row.value = 1
      }
      updated += 1
    }

    if (updated === 0) {
      showToast('请先勾选参与双倍的房间', false)
      return
    }

    showToast(preset === 'level' ? '已按粉丝牌等级填入权重值' : '已将参与房间全部设为 1', true)
  }

  taskPage.watchResourceState(applyResourceState)

  return {
    applyDoubleRatioPreset,
    doubleCron,
    doubleCronPreviewText,
    doubleEmptyText,
    doubleEnabled,
    doubleFanRows: fanRows,
    doubleGiftScope,
    doubleModeHelp,
    doubleModel,
    doubleRatioPreview,
    doubleTaskCard,
    doubleValueLabel,
    handleDoubleToggle,
    loadDoubleCronPreview,
    saveDoubleConfig,
    showDoubleRatioTools,
    showDoubleTable,
    triggerDoubleTask,
  }
}
