import type { Fans, JobConfig, SendGift } from '../../core/types'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatDate } from './resources'
import { requestJson } from './request'
import { showToast } from './toast'

interface TaskRunStatus {
  lastRun?: string | null
  nextRun?: string | null
  running?: boolean
}

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

interface CronPreview {
  error: string
  loading: boolean
  runs: string[]
  value: string
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
const cronPreview = ref<CronPreview>({
  value: '',
  runs: [],
  error: '',
  loading: false,
})

let cronPreviewSeq = 0
let legacyDeps: LegacyKeepaliveDeps | null = null

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_KEEPALIVE_TASK_ACTIONS?: {
      create: (deps: LegacyKeepaliveDeps) => LegacyKeepaliveActions
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

function isTaskActive(config: JobConfig | undefined): boolean {
  return Boolean(config && config.active !== false)
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

function hasCookieSourceConfigured(config: RawKeepaliveConfig | null): boolean {
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

async function loadKeepaliveCronPreview(): Promise<void> {
  const value = keepaliveCron.value.trim()
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
  const value = keepaliveCron.value.trim()
  const preview = cronPreview.value
  if (preview.value !== value || (!preview.loading && !preview.error && !preview.runs.length)) {
    return loadKeepaliveCronPreview()
  }
  return Promise.resolve()
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
  keepaliveEnabled.value = true
  try {
    await requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keepalive: buildSendPayload(),
      }),
    })
    showToast('保活任务已保存并启用', true)
    await refreshKeepaliveSurfaces()
  } catch (error) {
    if (options?.revertCheckboxOnError) {
      keepaliveEnabled.value = false
    }
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`保存并启用保活任务失败：${getErrorMessage(error)}`, false)
  }
}

async function disableKeepaliveConfig(): Promise<void> {
  const currentConfig = managedConfig.value?.keepalive || rawConfig.value?.keepalive || legacyDeps?.getManagedConfig().keepalive || legacyDeps?.getRawConfig().keepalive || {
    active: true,
    cron: DEFAULT_KEEPALIVE_CRON,
    model: DEFAULT_KEEPALIVE_MODEL,
    send: {},
  }
  try {
    await requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        keepalive: {
          active: false,
          cron: currentConfig.cron || DEFAULT_KEEPALIVE_CRON,
          model: normalizeModel(currentConfig.model),
          send: currentConfig.send || {},
        },
      }),
    })
    showToast('保活任务已停用', true)
    await refreshKeepaliveSurfaces()
  } catch (error) {
    keepaliveEnabled.value = true
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`停用保活任务失败：${getErrorMessage(error)}`, false)
  }
}

async function triggerKeepaliveTask(): Promise<void> {
  try {
    await requestJson('/api/trigger/keepalive', { method: 'POST' })
    showToast('执行完成', true)
    await Promise.all([
      legacyDeps?.loadOverview?.(),
      legacyDeps?.loadLogs?.(),
      legacyDeps?.loadFansStatus?.(false),
    ].filter(Boolean))
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`执行失败：${getErrorMessage(error)}`, false)
  }
}

export function useKeepaliveTaskPage() {
  const keepaliveCronPreviewText = computed(() => {
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

  const keepaliveTaskCard = computed(() => {
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

    const configured = Boolean(overview.value.keepaliveConfigured)
    const status = overview.value.status?.keepalive || {}
    return {
      pills: [
        { label: configured ? '已启动' : '未启动', kind: configured ? 'ok' : 'off' },
        { label: configured ? (status.running ? '调度中' : '已停止') : '未启用', kind: configured ? (status.running ? 'warn' : 'off') : 'off' },
      ],
      cells: [
        { label: '上次执行', value: formatDate(status.lastRun || null) },
        { label: '下次执行', value: formatDate(status.nextRun || null) },
        { label: '房间数', value: configured ? String(overview.value.keepaliveRooms ?? 0) : '0' },
      ],
    }
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

  function handleKeepalivePageEvent(event: Event): void {
    applyKeepalivePageDetail((event as CustomEvent<KeepalivePageDetail>).detail || {})
  }

  function handleConfigEvent(event: Event): void {
    const detail = (event as CustomEvent<{ rawConfig?: RawKeepaliveConfig | null }>).detail || {}
    if ('rawConfig' in detail) {
      applyRawConfig(detail.rawConfig || null)
    }
  }

  function handleOverviewEvent(event: Event): void {
    const detail = (event as CustomEvent<{ overview?: KeepaliveOverview | null }>).detail || {}
    if ('overview' in detail) {
      overview.value = detail.overview || null
    }
  }

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

  onMounted(() => {
    document.addEventListener(KEEPALIVE_PAGE_EVENT_NAME, handleKeepalivePageEvent)
    document.addEventListener('douyu-keep-webui:config', handleConfigEvent)
    document.addEventListener('douyu-keep-webui:overview', handleOverviewEvent)
    void ensureCronPreview()
  })

  onBeforeUnmount(() => {
    document.removeEventListener(KEEPALIVE_PAGE_EVENT_NAME, handleKeepalivePageEvent)
    document.removeEventListener('douyu-keep-webui:config', handleConfigEvent)
    document.removeEventListener('douyu-keep-webui:overview', handleOverviewEvent)
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
