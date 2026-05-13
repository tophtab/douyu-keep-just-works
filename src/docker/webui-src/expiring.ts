import type { BackpackGiftRow, ExpiringGiftConfig, Fans, GiftStatus, SendGift } from '../../core/types'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatDate } from './resources'
import { requestJson } from './request'
import { showToast } from './toast'

interface TaskRunStatus {
  lastRun?: string | null
  nextRun?: string | null
  running?: boolean
}

interface ExpiringOverview {
  expiringGiftConfigured?: boolean
  expiringGiftRooms?: number
  status?: {
    expiringGift?: TaskRunStatus
  }
}

interface RawExpiringConfig {
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

interface CronPreview {
  error: string
  loading: boolean
  runs: string[]
  value: string
}

interface ExpiringFanRow {
  index: number
  intimacy: string
  level: number | string
  name: string
  rank: number | string
  roomId: number
  today: number | string
  value: number
}

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
const cronPreview = ref<CronPreview>({
  value: '',
  runs: [],
  error: '',
  loading: false,
})

let cronPreviewSeq = 0
let legacyDeps: LegacyExpiringDeps | null = null

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_EXPIRING_TASK_ACTIONS?: {
      create: (deps: LegacyExpiringDeps) => LegacyExpiringActions
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

function isTaskActive(config: ExpiringGiftConfig | undefined): boolean {
  return Boolean(config && config.active !== false)
}

function normalizeModel(model: unknown): 1 | 2 {
  return Number(model) === 2 ? 2 : DEFAULT_EXPIRING_MODEL
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

function hasCookieSourceConfigured(config: RawExpiringConfig | null): boolean {
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

function buildFanRows(nextFans: Fans[], config: ExpiringGiftConfig): ExpiringFanRow[] {
  const model = normalizeModel(config.model)
  return nextFans.map((fan, index) => {
    const key = String(fan.roomId)
    const sendItem = config.send && config.send[key]
      ? config.send[key]
      : {
          roomId: fan.roomId,
          giftId: 268,
          number: model === 2 ? 1 : 0,
          weight: model === 1 ? (index === 0 ? 1 : 0) : 0,
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

async function loadExpiringCronPreview(): Promise<void> {
  const value = expiringCron.value.trim()
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
  const value = expiringCron.value.trim()
  const preview = cronPreview.value
  if (preview.value !== value || (!preview.loading && !preview.error && !preview.runs.length)) {
    return loadExpiringCronPreview()
  }
  return Promise.resolve()
}

function buildExpiringPayload(): ExpiringGiftConfig {
  const send: Record<string, SendGift> = {}
  for (const row of fanRows.value) {
    const value = Number(row.value || 0)
    send[String(row.roomId)] = {
      roomId: row.roomId,
      giftId: 268,
      number: expiringModel.value === 2 ? value : 0,
      weight: expiringModel.value === 1 ? value : 0,
      count: 0,
    }
  }

  return {
    active: true,
    cron: expiringCron.value.trim(),
    thresholdHours: normalizeThresholdHours(expiringThresholdHours.value),
    model: expiringModel.value,
    send,
  }
}

async function refreshExpiringSurfaces(): Promise<void> {
  await legacyDeps?.refreshOverviewSurface(false)
}

async function saveExpiringGiftConfig(options?: { revertCheckboxOnError?: boolean }): Promise<void> {
  expiringEnabled.value = true
  try {
    await requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expiringGift: buildExpiringPayload(),
      }),
    })
    showToast('临期任务已保存并启用', true)
    await refreshExpiringSurfaces()
  } catch (error) {
    if (options?.revertCheckboxOnError) {
      expiringEnabled.value = false
    }
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`保存并启用临期任务失败：${getErrorMessage(error)}`, false)
  }
}

async function disableExpiringGiftConfig(): Promise<void> {
  const currentConfig = managedConfig.value?.expiringGift || rawConfig.value?.expiringGift || legacyDeps?.getManagedConfig().expiringGift || legacyDeps?.getRawConfig().expiringGift || {
    active: false,
    cron: DEFAULT_EXPIRING_CRON,
    thresholdHours: DEFAULT_EXPIRING_THRESHOLD_HOURS,
    model: DEFAULT_EXPIRING_MODEL,
    send: {},
  }
  try {
    await requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expiringGift: {
          active: false,
          cron: currentConfig.cron || DEFAULT_EXPIRING_CRON,
          thresholdHours: normalizeThresholdHours(currentConfig.thresholdHours),
          model: normalizeModel(currentConfig.model),
          send: currentConfig.send || {},
        },
      }),
    })
    showToast('临期任务已停用', true)
    await refreshExpiringSurfaces()
  } catch (error) {
    expiringEnabled.value = true
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`停用临期任务失败：${getErrorMessage(error)}`, false)
  }
}

async function triggerExpiringTask(): Promise<void> {
  try {
    await requestJson('/api/trigger/expiringGift', { method: 'POST' })
    showToast('执行完成', true)
    await Promise.all([
      legacyDeps?.loadOverview?.(),
      legacyDeps?.loadLogs?.(),
      legacyDeps?.loadFansStatus?.(false),
    ].filter(Boolean))
    if (legacyDeps) {
      fans.value = legacyDeps.getManagedFans()
      managedConfig.value = legacyDeps.getManagedConfig()
      applyExpiringConfig(getExpiringConfig())
    }
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`执行失败：${getErrorMessage(error)}`, false)
  }
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
  const expiringCronPreviewText = computed(() => {
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

  const expiringTaskCard = computed(() => {
    if (!overview.value) {
      return {
        pills: [{ label: '等待加载', kind: 'off' }],
        cells: [
          { label: '上次执行', value: '-' },
          { label: '下次执行', value: '-' },
          { label: '阈值', value: '-' },
        ],
      }
    }

    const configured = Boolean(overview.value.expiringGiftConfigured)
    const status = overview.value.status?.expiringGift || {}
    return {
      pills: [
        { label: configured ? '已启动' : '未启动', kind: configured ? 'ok' : 'off' },
        { label: configured ? (status.running ? '调度中' : '已停止') : '未启用', kind: configured ? (status.running ? 'warn' : 'off') : 'off' },
      ],
      cells: [
        { label: '上次执行', value: formatDate(status.lastRun || null) },
        { label: '下次执行', value: formatDate(status.nextRun || null) },
        { label: '阈值', value: `${normalizeThresholdHours(getExpiringConfig().thresholdHours)} 小时` },
      ],
    }
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

  function handleExpiringPageEvent(event: Event): void {
    applyExpiringPageDetail((event as CustomEvent<ExpiringPageDetail>).detail || {})
  }

  function handleConfigEvent(event: Event): void {
    const detail = (event as CustomEvent<{ rawConfig?: RawExpiringConfig | null }>).detail || {}
    if ('rawConfig' in detail) {
      applyRawConfig(detail.rawConfig || null)
    }
  }

  function handleOverviewEvent(event: Event): void {
    const detail = (event as CustomEvent<{ overview?: ExpiringOverview | null }>).detail || {}
    if ('overview' in detail) {
      overview.value = detail.overview || null
    }
  }

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

  onMounted(() => {
    document.addEventListener(EXPIRING_PAGE_EVENT_NAME, handleExpiringPageEvent)
    document.addEventListener('douyu-keep-webui:config', handleConfigEvent)
    document.addEventListener('douyu-keep-webui:overview', handleOverviewEvent)
    void ensureCronPreview()
  })

  onBeforeUnmount(() => {
    document.removeEventListener(EXPIRING_PAGE_EVENT_NAME, handleExpiringPageEvent)
    document.removeEventListener('douyu-keep-webui:config', handleConfigEvent)
    document.removeEventListener('douyu-keep-webui:overview', handleOverviewEvent)
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
