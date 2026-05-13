import type { DoubleCardConfig, DoubleCardGiftScope, Fans, FanStatus, SendGift } from '../../core/types'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatDate } from './resources'
import { requestJson } from './request'
import { showToast } from './toast'

interface TaskRunStatus {
  lastRun?: string | null
  nextRun?: string | null
  running?: boolean
}

interface DoubleOverview {
  doubleCardConfigured?: boolean
  doubleCardRooms?: number
  status?: {
    doubleCard?: TaskRunStatus
  }
}

interface RawDoubleConfig {
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
  doubleCard?: DoubleCardConfig
}

type DoubleFan = Fans & Partial<Pick<FanStatus, 'doubleActive'>>

interface DoublePageDetail {
  fans?: DoubleFan[]
  fansListError?: string
  fansListLoaded?: boolean
  managedConfig?: RawDoubleConfig | null
  managedLoading?: boolean
  overview?: DoubleOverview | null
  rawConfig?: RawDoubleConfig | null
}

interface LegacyDoubleDeps {
  getManagedConfig: () => RawDoubleConfig
  getManagedFans: () => DoubleFan[]
  getRawConfig: () => RawDoubleConfig
  isUnauthorizedError: (error: unknown) => boolean
  loadFansStatus?: (forceRefresh?: boolean) => Promise<unknown>
  loadLogs?: () => Promise<unknown>
  loadOverview?: () => Promise<unknown>
  refreshOverviewSurface: (showToast: boolean) => Promise<unknown>
}

interface LegacyDoubleActions {
  disableDoubleConfig: () => Promise<void>
  saveDoubleConfig: (options?: { revertCheckboxOnError?: boolean }) => Promise<void>
}

interface CronPreview {
  error: string
  loading: boolean
  runs: string[]
  value: string
}

interface DoubleFanRow {
  doubleActive?: boolean
  enabled: boolean
  index: number
  intimacy: string
  level: number | string
  name: string
  rank: number | string
  roomId: number
  today: number | string
  value: number
}

const DEFAULT_DOUBLE_CRON = '0 20 17,20,22,23 * * *'
const DEFAULT_DOUBLE_MODEL: 1 | 2 = 1
const DEFAULT_DOUBLE_GIFT_SCOPE: DoubleCardGiftScope = 'glowStick'
const DOUBLE_PAGE_EVENT_NAME = 'douyu-keep-webui:double-page'

const overview = ref<DoubleOverview | null>(null)
const rawConfig = ref<RawDoubleConfig | null>(null)
const managedConfig = ref<RawDoubleConfig | null>(null)
const fans = ref<DoubleFan[]>([])
const fansListError = ref('')
const fansListLoaded = ref(false)
const managedLoading = ref(false)
const doubleEnabled = ref(false)
const doubleCron = ref(DEFAULT_DOUBLE_CRON)
const doubleModel = ref<1 | 2>(DEFAULT_DOUBLE_MODEL)
const doubleGiftScope = ref<DoubleCardGiftScope>(DEFAULT_DOUBLE_GIFT_SCOPE)
const fanRows = ref<DoubleFanRow[]>([])
const cronPreview = ref<CronPreview>({
  value: '',
  runs: [],
  error: '',
  loading: false,
})

let cronPreviewSeq = 0
let legacyDeps: LegacyDoubleDeps | null = null

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_DOUBLE_TASK_ACTIONS?: {
      create: (deps: LegacyDoubleDeps) => LegacyDoubleActions
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isUnauthorizedError(error: unknown): boolean {
  if (legacyDeps?.isUnauthorizedError(error)) {
    return true
  }
  return Boolean(error && typeof error === 'object' && 'status' in error && error.status === 401)
}

function isTaskActive(config: DoubleCardConfig | undefined): boolean {
  return Boolean(config && config.active !== false)
}

function normalizeModel(model: unknown): 1 | 2 {
  return Number(model) === 2 ? 2 : DEFAULT_DOUBLE_MODEL
}

function normalizeGiftScope(scope: unknown): DoubleCardGiftScope {
  return scope === 'limitedTime' ? 'limitedTime' : DEFAULT_DOUBLE_GIFT_SCOPE
}

function getDoubleConfig(): DoubleCardConfig {
  return managedConfig.value?.doubleCard || rawConfig.value?.doubleCard || {
    active: true,
    cron: DEFAULT_DOUBLE_CRON,
    model: DEFAULT_DOUBLE_MODEL,
    giftScope: DEFAULT_DOUBLE_GIFT_SCOPE,
    send: {},
    enabled: {},
  }
}

function hasCookieSourceConfigured(config: RawDoubleConfig | null): boolean {
  const cookieCloud = config?.cookieCloud
  const manualCookies = config?.manualCookies
  return Boolean(
    String(manualCookies?.main || config?.cookie || '').trim()
    || String(manualCookies?.yuba || '').trim()
    || (cookieCloud?.active && String(cookieCloud.endpoint || '').trim() && String(cookieCloud.uuid || '').trim() && String(cookieCloud.password || '').trim()),
  )
}

function formatOptionalNumber(value: unknown): number | string {
  return value !== undefined && value !== null && value !== '' ? Number(value) : '-'
}

function buildFanRows(nextFans: DoubleFan[], config: DoubleCardConfig): DoubleFanRow[] {
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
      doubleActive: typeof fan.doubleActive === 'boolean' ? fan.doubleActive : undefined,
      enabled: Boolean(config.enabled && config.enabled[key]),
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

function applyDoubleConfig(config: DoubleCardConfig): void {
  doubleEnabled.value = isTaskActive(config)
  doubleCron.value = config.cron || DEFAULT_DOUBLE_CRON
  doubleModel.value = normalizeModel(config.model)
  doubleGiftScope.value = normalizeGiftScope(config.giftScope)
  fanRows.value = buildFanRows(fans.value, config)
  void ensureCronPreview()
}

function applyRawConfig(config: RawDoubleConfig | null): void {
  rawConfig.value = config
  applyDoubleConfig(getDoubleConfig())
}

function applyDoublePageDetail(detail: DoublePageDetail): void {
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

  applyDoubleConfig(getDoubleConfig())
}

async function loadDoubleCronPreview(): Promise<void> {
  const value = doubleCron.value.trim()
  cronPreviewSeq += 1
  const requestSeq = cronPreviewSeq

  if (!value) {
    cronPreview.value = { value: '', runs: [], error: '', loading: false }
    return
  }

  cronPreview.value = { value, runs: [], error: '', loading: true }
  try {
    const data = await requestJson<{ runs?: string[] }>(`/api/cron-preview?value=${encodeURIComponent(value)}`)
    if (cronPreviewSeq !== requestSeq) {
      return
    }
    cronPreview.value = { value, runs: data.runs || [], error: '', loading: false }
  } catch (error) {
    if (cronPreviewSeq !== requestSeq) {
      return
    }
    cronPreview.value = { value, runs: [], error: getErrorMessage(error), loading: false }
  }
}

function ensureCronPreview(): Promise<void> {
  const value = doubleCron.value.trim()
  const preview = cronPreview.value
  if (preview.value !== value || (!preview.loading && !preview.error && !preview.runs.length)) {
    return loadDoubleCronPreview()
  }
  return Promise.resolve()
}

function buildDoublePayload(): DoubleCardConfig {
  const send: Record<string, SendGift> = {}
  const enabled: Record<string, boolean> = {}
  for (const row of fanRows.value) {
    const value = Number(row.value || 0)
    const key = String(row.roomId)
    send[key] = {
      roomId: row.roomId,
      giftId: 268,
      number: doubleModel.value === 2 ? value : 0,
      weight: doubleModel.value === 1 ? value : 0,
      count: 0,
    }
    enabled[key] = Boolean(row.enabled)
  }

  return {
    active: true,
    cron: doubleCron.value.trim(),
    model: doubleModel.value,
    giftScope: doubleGiftScope.value,
    send,
    enabled,
  }
}

function formatRatioPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${rounded.toFixed(1).replace(/\.0$/, '')}%`
}

async function refreshDoubleSurfaces(): Promise<void> {
  await legacyDeps?.refreshOverviewSurface(false)
}

async function saveDoubleConfig(options?: { revertCheckboxOnError?: boolean }): Promise<void> {
  doubleEnabled.value = true
  const nextConfig = buildDoublePayload()
  if (nextConfig.model === 1) {
    const enabledKeys = Object.keys(nextConfig.enabled || {}).filter(key => nextConfig.enabled?.[key])
    const totalWeight = enabledKeys.reduce((sum, key) => sum + Number(nextConfig.send[key]?.weight || 0), 0)
    if (enabledKeys.length > 0 && totalWeight <= 0) {
      showToast('按权重模式至少需要一个已勾选房间填写大于 0 的权重值', false)
      return
    }
  }

  try {
    await requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doubleCard: nextConfig,
      }),
    })
    showToast('双倍任务已保存并启用', true)
    await refreshDoubleSurfaces()
  } catch (error) {
    if (options?.revertCheckboxOnError) {
      doubleEnabled.value = false
    }
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`保存并启用双倍任务失败：${getErrorMessage(error)}`, false)
  }
}

async function disableDoubleConfig(): Promise<void> {
  const currentConfig = managedConfig.value?.doubleCard || rawConfig.value?.doubleCard || legacyDeps?.getManagedConfig().doubleCard || legacyDeps?.getRawConfig().doubleCard || {
    active: true,
    cron: DEFAULT_DOUBLE_CRON,
    model: DEFAULT_DOUBLE_MODEL,
    giftScope: DEFAULT_DOUBLE_GIFT_SCOPE,
    send: {},
    enabled: {},
  }
  try {
    await requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        doubleCard: {
          active: false,
          cron: currentConfig.cron || DEFAULT_DOUBLE_CRON,
          model: normalizeModel(currentConfig.model),
          giftScope: normalizeGiftScope(currentConfig.giftScope),
          send: currentConfig.send || {},
          enabled: currentConfig.enabled || {},
        },
      }),
    })
    showToast('双倍任务已停用', true)
    await refreshDoubleSurfaces()
  } catch (error) {
    doubleEnabled.value = true
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`停用双倍任务失败：${getErrorMessage(error)}`, false)
  }
}

async function triggerDoubleTask(): Promise<void> {
  try {
    await requestJson('/api/trigger/doubleCard', { method: 'POST' })
    showToast('执行完成', true)
    await Promise.all([
      legacyDeps?.loadOverview?.(),
      legacyDeps?.loadLogs?.(),
      legacyDeps?.loadFansStatus?.(false),
    ].filter(Boolean))
    if (legacyDeps) {
      fans.value = legacyDeps.getManagedFans()
      managedConfig.value = legacyDeps.getManagedConfig()
      applyDoubleConfig(getDoubleConfig())
    }
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`执行失败：${getErrorMessage(error)}`, false)
  }
}

export function useDoubleTaskPage() {
  const doubleCronPreviewText = computed(() => {
    const preview = cronPreview.value
    if (!preview.value) {
      return '填写 cron 后显示未来三次执行时间。'
    }
    if (preview.loading) {
      return '正在计算未来执行时间…'
    }
    if (preview.error) {
      return `cron 校验失败：${preview.error}`
    }
    if (!preview.runs.length) {
      return '暂未生成未来执行时间。'
    }
    return `未来三次：${preview.runs.map(item => formatDate(item)).join(' / ')}`
  })

  const doubleTaskCard = computed(() => {
    if (!overview.value) {
      return {
        pills: [{ label: '等待加载', kind: 'off' }],
        cells: [
          { label: '上次执行', value: '-' },
          { label: '下次执行', value: '-' },
          { label: '房间数', value: '-' },
        ],
      }
    }

    const configured = Boolean(overview.value.doubleCardConfigured)
    const status = overview.value.status?.doubleCard || {}
    return {
      pills: [
        { label: configured ? '已启动' : '未启动', kind: configured ? 'ok' : 'off' },
        { label: configured ? (status.running ? '调度中' : '已停止') : '未启用', kind: configured ? (status.running ? 'warn' : 'off') : 'off' },
      ],
      cells: [
        { label: '上次执行', value: formatDate(status.lastRun || null) },
        { label: '下次执行', value: formatDate(status.nextRun || null) },
        { label: '房间数', value: configured ? String(overview.value.doubleCardRooms ?? 0) : '0' },
      ],
    }
  })

  const enabledCount = computed(() => fanRows.value.filter(row => row.enabled).length)

  const doubleNote = computed(() => {
    if (!hasCookieSourceConfigured(rawConfig.value)) {
      return '请先保存 Cookie 或启用 CookieCloud。没有登录凭证时无法同步粉丝牌，也不会生成双倍房间列表。'
    }
    if (managedLoading.value && !fanRows.value.length) {
      return '正在同步粉丝牌与双倍配置…'
    }
    if (!fanRows.value.length) {
      if (fansListError.value) {
        return '粉丝牌列表加载失败。'
      }
      return fansListLoaded.value ? '当前没有可用粉丝牌。' : '粉丝牌列表尚未加载。'
    }
    return `${managedLoading.value ? '正在后台同步，当前显示上次结果。' : ''}当前已勾选 ${enabledCount.value} / ${fanRows.value.length} 个房间参与双倍。`
  })

  const doubleEmptyText = computed(() => {
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

  const showDoubleTable = computed(() => hasCookieSourceConfigured(rawConfig.value) && fanRows.value.length > 0)
  const doubleValueLabel = computed(() => doubleModel.value === 2 ? '数量' : '权重值')
  const showDoubleRatioTools = computed(() => doubleModel.value === 1)
  const doubleModeHelp = computed(() => {
    if (!hasCookieSourceConfigured(rawConfig.value)) {
      return '按权重模式会在当前开双倍的房间之间重新分配。'
    }
    if (managedLoading.value && !fanRows.value.length) {
      return '正在同步双倍任务配置。'
    }
    if (!fanRows.value.length) {
      return '按权重模式会在当前开双倍的房间之间重新分配。'
    }
    if (doubleModel.value === 2) {
      return '按固定数量时，会只在当前开双倍的房间里使用你填写的数量。没有房间开双倍时本次不送；只有 1 个房间开双倍时本次全部送给它。'
    }
    return '按权重模式不要求总和等于 100。多个房间同时开双倍时，只会在这些房间里按权重值重新分配。'
  })

  const doubleRatioPreview = computed(() => {
    if (!hasCookieSourceConfigured(rawConfig.value)) {
      return '保存登录凭证并同步粉丝牌后，这里会显示当前权重预览。'
    }
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
      return '固定数量模式保留现有行为。如果你想平均分配，切回“按权重”后点击“参与房间全部设为 1”即可。'
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

  function handleDoublePageEvent(event: Event): void {
    applyDoublePageDetail((event as CustomEvent<DoublePageDetail>).detail || {})
  }

  function handleConfigEvent(event: Event): void {
    const detail = (event as CustomEvent<{ rawConfig?: RawDoubleConfig | null }>).detail || {}
    if ('rawConfig' in detail) {
      applyRawConfig(detail.rawConfig || null)
    }
  }

  function handleOverviewEvent(event: Event): void {
    const detail = (event as CustomEvent<{ overview?: DoubleOverview | null }>).detail || {}
    if ('overview' in detail) {
      overview.value = detail.overview || null
    }
  }

  function handleDoubleToggle(): void {
    if (doubleEnabled.value) {
      void saveDoubleConfig({ revertCheckboxOnError: true })
      return
    }
    void disableDoubleConfig()
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

  onMounted(() => {
    document.addEventListener(DOUBLE_PAGE_EVENT_NAME, handleDoublePageEvent)
    document.addEventListener('douyu-keep-webui:config', handleConfigEvent)
    document.addEventListener('douyu-keep-webui:overview', handleOverviewEvent)
    void ensureCronPreview()
  })

  onBeforeUnmount(() => {
    document.removeEventListener(DOUBLE_PAGE_EVENT_NAME, handleDoublePageEvent)
    document.removeEventListener('douyu-keep-webui:config', handleConfigEvent)
    document.removeEventListener('douyu-keep-webui:overview', handleOverviewEvent)
  })

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
    doubleNote,
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

function createLegacyDoubleActions(deps: LegacyDoubleDeps): LegacyDoubleActions {
  legacyDeps = deps
  rawConfig.value = deps.getRawConfig()
  managedConfig.value = deps.getManagedConfig()
  fans.value = deps.getManagedFans()
  applyRawConfig(rawConfig.value)

  return {
    disableDoubleConfig,
    saveDoubleConfig,
  }
}

export function dispatchDoublePageState(detail: DoublePageDetail): void {
  document.dispatchEvent(new CustomEvent(DOUBLE_PAGE_EVENT_NAME, { detail }))
}

export function installLegacyDoubleTaskBridge(): void {
  window.DOUYU_KEEP_WEBUI_DOUBLE_TASK_ACTIONS = {
    create: createLegacyDoubleActions,
  }
}
