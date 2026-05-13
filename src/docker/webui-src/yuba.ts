import type { YubaCheckInConfig, YubaCheckInMode, YubaGroupStatus, YubaStatusResponse } from '../../core/types'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { formatDate } from './resources'
import { requestJson } from './request'
import { showToast } from './toast'

interface TaskRunStatus {
  lastRun?: string | null
  nextRun?: string | null
  running?: boolean
}

interface YubaOverview {
  yubaCheckInConfigured?: boolean
  status?: {
    yubaCheckIn?: TaskRunStatus
  }
}

interface RawYubaConfig {
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
  yubaCheckIn?: YubaCheckInConfig
}

interface YubaPageDetail {
  overview?: YubaOverview | null
  rawConfig?: RawYubaConfig | null
  yubaStatus?: YubaGroupStatus[]
  yubaStatusError?: string
  yubaStatusLoaded?: boolean
  yubaStatusLoading?: boolean
}

interface LegacyResourceRequest {
  pending: Promise<unknown> | null
  requestSeq: number
}

interface LegacyYubaState {
  overview: unknown
  rawConfig: unknown
  yubaStatus: YubaGroupStatus[]
  yubaStatusError: string
  yubaStatusLoaded: boolean
  yubaStatusLoading: boolean
}

interface LegacyYubaResourceDeps {
  getRawConfig: () => unknown
  getResourceRequest: (key: 'yubaStatus') => LegacyResourceRequest
  hasCookieSourceConfigured: (config?: unknown) => boolean
  invalidateResourceRequest: (key: 'yubaStatus') => void
  isUnauthorizedError: (error: unknown) => boolean
  markResourceLoaded: (key: 'yubaStatus') => void
  renderYubaPage: () => void
  state: LegacyYubaState
  toast: (message: string, ok: boolean) => void
  trackResourceRequest: <T>(resource: LegacyResourceRequest, requestSeq: number, pending: Promise<T>) => Promise<T>
}

interface LegacyYubaTaskDeps {
  getRawConfig: () => RawYubaConfig
  isUnauthorizedError: (error: unknown) => boolean
  loadLogs?: () => Promise<unknown>
  loadOverview?: () => Promise<unknown>
  refreshOverviewSurface: (showToast: boolean) => Promise<unknown>
}

interface LegacyYubaTaskActions {
  disableYubaConfig: () => Promise<void>
  saveYubaConfig: (options?: { revertCheckboxOnError?: boolean }) => Promise<void>
}

interface LegacyYubaResourceActions {
  loadYubaStatus: (showToast?: boolean) => Promise<unknown>
}

interface CronPreview {
  error: string
  loading: boolean
  runs: string[]
  value: string
}

const DEFAULT_YUBA_CRON = '0 23 0 * * *'
const DEFAULT_YUBA_MODE: YubaCheckInMode = 'followed'
const YUBA_PAGE_EVENT_NAME = 'douyu-keep-webui:yuba-page'

const overview = ref<YubaOverview | null>(null)
const rawConfig = ref<RawYubaConfig | null>(null)
const yubaStatus = ref<YubaGroupStatus[]>([])
const yubaStatusError = ref('')
const yubaStatusLoaded = ref(false)
const yubaStatusLoading = ref(false)
const yubaEnabled = ref(false)
const yubaCron = ref(DEFAULT_YUBA_CRON)
const yubaMode = ref<YubaCheckInMode>(DEFAULT_YUBA_MODE)
const cronPreview = ref<CronPreview>({
  value: '',
  runs: [],
  error: '',
  loading: false,
})

let cronPreviewSeq = 0
let legacyResourceDeps: LegacyYubaResourceDeps | null = null
let legacyTaskDeps: LegacyYubaTaskDeps | null = null

declare global {
  interface Window {
    DOUYU_KEEP_WEBUI_YUBA_RESOURCE_ACTIONS?: {
      create: (deps: LegacyYubaResourceDeps) => LegacyYubaResourceActions
    }
    DOUYU_KEEP_WEBUI_YUBA_TASK_ACTIONS?: {
      create: (deps: LegacyYubaTaskDeps) => LegacyYubaTaskActions
    }
  }
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isUnauthorizedError(error: unknown): boolean {
  if (legacyTaskDeps?.isUnauthorizedError(error) || legacyResourceDeps?.isUnauthorizedError(error)) {
    return true
  }
  return Boolean(error && typeof error === 'object' && 'status' in error && error.status === 401)
}

function isTaskActive(config: YubaCheckInConfig | undefined): boolean {
  return Boolean(config && config.active !== false)
}

function normalizeMode(mode: unknown): YubaCheckInMode {
  return mode === 'followed' ? 'followed' : DEFAULT_YUBA_MODE
}

function getYubaConfig(config: RawYubaConfig | null): YubaCheckInConfig {
  return config?.yubaCheckIn || { active: false, cron: DEFAULT_YUBA_CRON, mode: DEFAULT_YUBA_MODE }
}

function hasCookieSourceConfigured(config: RawYubaConfig | null): boolean {
  if (legacyResourceDeps) {
    return legacyResourceDeps.hasCookieSourceConfigured(config)
  }

  const cookieCloud = config?.cookieCloud
  const manualCookies = config?.manualCookies
  return Boolean(
    String(manualCookies?.main || config?.cookie || '').trim()
    || String(manualCookies?.yuba || '').trim()
    || (cookieCloud?.active && String(cookieCloud.endpoint || '').trim() && String(cookieCloud.uuid || '').trim() && String(cookieCloud.password || '').trim()),
  )
}

function applyRawConfig(config: RawYubaConfig | null): void {
  rawConfig.value = config
  const yubaConfig = getYubaConfig(config)
  yubaEnabled.value = isTaskActive(yubaConfig)
  yubaCron.value = yubaConfig.cron || DEFAULT_YUBA_CRON
  yubaMode.value = normalizeMode(yubaConfig.mode)
  void ensureCronPreview()
}

function applyYubaStatusState(detail: {
  yubaStatus?: YubaGroupStatus[]
  yubaStatusError?: string
  yubaStatusLoaded?: boolean
  yubaStatusLoading?: boolean
}): void {
  if ('yubaStatus' in detail) {
    yubaStatus.value = detail.yubaStatus || []
  }
  if ('yubaStatusError' in detail) {
    yubaStatusError.value = detail.yubaStatusError || ''
  }
  if ('yubaStatusLoaded' in detail) {
    yubaStatusLoaded.value = Boolean(detail.yubaStatusLoaded)
  }
  if ('yubaStatusLoading' in detail) {
    yubaStatusLoading.value = Boolean(detail.yubaStatusLoading)
  }
}

function applyYubaPageDetail(detail: YubaPageDetail): void {
  if ('rawConfig' in detail) {
    applyRawConfig(detail.rawConfig || null)
  }
  if ('overview' in detail) {
    overview.value = detail.overview || null
  }
  applyYubaStatusState(detail)
}

async function loadYubaCronPreview(): Promise<void> {
  const value = yubaCron.value.trim()
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
  const value = yubaCron.value.trim()
  const preview = cronPreview.value
  if (preview.value !== value || (!preview.loading && !preview.error && !preview.runs.length)) {
    return loadYubaCronPreview()
  }
  return Promise.resolve()
}

async function refreshYubaSurfaces(): Promise<void> {
  await legacyTaskDeps?.refreshOverviewSurface(false)
}

async function saveYubaConfig(options?: { revertCheckboxOnError?: boolean }): Promise<void> {
  yubaEnabled.value = true
  try {
    await requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yubaCheckIn: {
          active: true,
          cron: yubaCron.value.trim(),
          mode: yubaMode.value || DEFAULT_YUBA_MODE,
        },
      }),
    })
    showToast('鱼吧签到任务已保存并启用', true)
    await refreshYubaSurfaces()
  } catch (error) {
    if (options?.revertCheckboxOnError) {
      yubaEnabled.value = false
    }
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`保存并启用鱼吧签到任务失败：${getErrorMessage(error)}`, false)
  }
}

async function disableYubaConfig(): Promise<void> {
  const currentConfig = rawConfig.value?.yubaCheckIn || legacyTaskDeps?.getRawConfig().yubaCheckIn || {
    active: false,
    cron: DEFAULT_YUBA_CRON,
    mode: DEFAULT_YUBA_MODE,
  }
  try {
    await requestJson('/api/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        yubaCheckIn: {
          active: false,
          cron: currentConfig.cron || DEFAULT_YUBA_CRON,
          mode: normalizeMode(currentConfig.mode),
        },
      }),
    })
    showToast('鱼吧签到任务已停用', true)
    await refreshYubaSurfaces()
  } catch (error) {
    yubaEnabled.value = true
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`停用鱼吧签到任务失败：${getErrorMessage(error)}`, false)
  }
}

function updateLegacyYubaState(detail: Required<Pick<YubaPageDetail, 'yubaStatus' | 'yubaStatusError' | 'yubaStatusLoaded' | 'yubaStatusLoading'>>): void {
  if (legacyResourceDeps) {
    legacyResourceDeps.state.yubaStatus = detail.yubaStatus
    legacyResourceDeps.state.yubaStatusError = detail.yubaStatusError
    legacyResourceDeps.state.yubaStatusLoaded = detail.yubaStatusLoaded
    legacyResourceDeps.state.yubaStatusLoading = detail.yubaStatusLoading
  }
  applyYubaStatusState(detail)
}

function renderLegacyYubaPage(): void {
  legacyResourceDeps?.renderYubaPage()
}

async function loadYubaStatus(showSuccessToast = false): Promise<unknown> {
  if (!legacyResourceDeps) {
    return Promise.resolve()
  }

  const deps = legacyResourceDeps
  const config = deps.getRawConfig() as RawYubaConfig
  const resource = deps.getResourceRequest('yubaStatus')
  if (!deps.hasCookieSourceConfigured(config)) {
    deps.invalidateResourceRequest('yubaStatus')
    updateLegacyYubaState({
      yubaStatus: [],
      yubaStatusError: '',
      yubaStatusLoaded: false,
      yubaStatusLoading: false,
    })
    renderLegacyYubaPage()
    if (showSuccessToast) {
      showToast('请先保存 Cookie 或启用 CookieCloud', false)
    }
    return Promise.resolve()
  }

  if (resource.pending) {
    return resource.pending
  }

  const requestSeq = resource.requestSeq + 1
  resource.requestSeq = requestSeq
  updateLegacyYubaState({
    yubaStatus: yubaStatus.value,
    yubaStatusError: '',
    yubaStatusLoaded: yubaStatusLoaded.value,
    yubaStatusLoading: true,
  })
  renderLegacyYubaPage()

  const pending = requestJson<YubaStatusResponse>('/api/yuba/status').then((data) => {
    if (resource.requestSeq !== requestSeq) {
      return
    }
    updateLegacyYubaState({
      yubaStatus: data?.groups || [],
      yubaStatusError: '',
      yubaStatusLoaded: true,
      yubaStatusLoading: false,
    })
    deps.markResourceLoaded('yubaStatus')
    renderLegacyYubaPage()
    if (showSuccessToast) {
      showToast('鱼吧状态已刷新', true)
    }
  }).catch((error) => {
    if (resource.requestSeq !== requestSeq) {
      return
    }
    if (isUnauthorizedError(error)) {
      return
    }
    updateLegacyYubaState({
      yubaStatus: yubaStatusLoaded.value ? yubaStatus.value : [],
      yubaStatusError: getErrorMessage(error),
      yubaStatusLoaded: yubaStatusLoaded.value,
      yubaStatusLoading: false,
    })
    renderLegacyYubaPage()
    showToast(`加载鱼吧状态失败：${getErrorMessage(error)}`, false)
  })

  return deps.trackResourceRequest(resource, requestSeq, pending)
}

async function triggerYubaTask(): Promise<void> {
  try {
    await requestJson('/api/trigger/yubaCheckIn', { method: 'POST' })
    showToast('执行完成', true)
    await Promise.all([
      legacyTaskDeps?.loadOverview?.(),
      legacyTaskDeps?.loadLogs?.(),
      loadYubaStatus(false),
    ].filter(Boolean))
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return
    }
    showToast(`执行失败：${getErrorMessage(error)}`, false)
  }
}

function formatOptionalNumber(value: unknown): string {
  return value !== undefined && value !== null && value !== '' ? String(value) : '-'
}

export function useYubaTaskPage() {
  const yubaCronPreviewText = computed(() => {
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

  const yubaTaskCard = computed(() => {
    if (!overview.value) {
      return {
        pills: [{ label: '等待加载', kind: 'off' }],
        cells: [
          { label: '上次执行', value: '-' },
          { label: '下次执行', value: '-' },
          { label: '模式', value: '-' },
        ],
      }
    }

    const configured = Boolean(overview.value.yubaCheckInConfigured)
    const status = overview.value.status?.yubaCheckIn || {}
    return {
      pills: [
        { label: configured ? '已启动' : '未启动', kind: configured ? 'ok' : 'off' },
        { label: configured ? (status.running ? '调度中' : '已停止') : '未启用', kind: configured ? (status.running ? 'warn' : 'off') : 'off' },
      ],
      cells: [
        { label: '上次执行', value: formatDate(status.lastRun || null) },
        { label: '下次执行', value: formatDate(status.nextRun || null) },
        { label: '模式', value: yubaMode.value === 'followed' ? '签到全部已关注鱼吧' : String(yubaMode.value || '-') },
      ],
    }
  })

  const yubaNote = computed(() => {
    const config = rawConfig.value
    if (!hasCookieSourceConfigured(config)) {
      return '请先保存 Cookie 或启用 CookieCloud。鱼吧签到依赖当前账号的鱼吧登录态，以及主站 Cookie 中可组成 dy-token 的 acf 字段。'
    }
    if (yubaMode.value !== 'followed') {
      return '当前模式无效，请重新保存鱼吧签到配置。'
    }
    if (yubaStatusLoading.value && !yubaStatusLoaded.value) {
      return '正在加载已关注鱼吧列表…'
    }
    if (yubaStatusError.value && !yubaStatusLoaded.value) {
      return '鱼吧列表加载失败。'
    }
    if (!yubaStatusLoaded.value) {
      return '当前会通过 HTTP 接口拉取全部已关注鱼吧，再逐个检测签到状态并执行签到。'
    }
    if (!yubaStatus.value.length) {
      return '当前没有可展示的已关注鱼吧。'
    }
    return `${yubaStatusLoading.value ? '正在后台更新，当前显示上次结果。' : ''}当前已加载 ${yubaStatus.value.length} 个已关注鱼吧，可直接查看等级、经验、排名和今日签到状态。`
  })

  const yubaEmptyText = computed(() => {
    const config = rawConfig.value
    if (!hasCookieSourceConfigured(config)) {
      return '保存鱼吧登录态后，这里会展示已关注鱼吧的等级、经验和签到状态。'
    }
    if (yubaMode.value !== 'followed') {
      return '当前模式无效，无法展示鱼吧状态列表。'
    }
    if (yubaStatusLoading.value && !yubaStatusLoaded.value) {
      return '请稍候，鱼吧等级和经验列表正在更新。'
    }
    if (yubaStatusError.value && !yubaStatusLoaded.value) {
      return `加载鱼吧列表失败：${yubaStatusError.value}。请点击顶部“刷新”重试。`
    }
    if (!yubaStatusLoaded.value) {
      return '正在准备加载鱼吧列表，也可以点击刷新手动加载。'
    }
    return '当前没有可展示的已关注鱼吧数据。'
  })

  const yubaTableRows = computed(() => yubaStatus.value.map((item, index) => {
    const isSigned = typeof item.isSigned === 'number' ? item.isSigned : -1
    return {
      error: item.error || '',
      expText: `${formatOptionalNumber(item.groupExp)}/${formatOptionalNumber(item.nextLevelExp)}`,
      groupId: formatOptionalNumber(item.groupId),
      groupLevel: formatOptionalNumber(item.groupLevel),
      groupName: item.groupName || '未知鱼吧',
      index: index + 1,
      rank: typeof item.rank === 'number' && item.rank > 0 ? String(item.rank) : '-',
      signed: isSigned > 0,
    }
  }))

  const showYubaTable = computed(() => hasCookieSourceConfigured(rawConfig.value) && yubaMode.value === 'followed' && yubaStatusLoaded.value && yubaTableRows.value.length > 0)

  function handleYubaPageEvent(event: Event): void {
    applyYubaPageDetail((event as CustomEvent<YubaPageDetail>).detail || {})
  }

  function handleConfigEvent(event: Event): void {
    const detail = (event as CustomEvent<{ rawConfig?: RawYubaConfig | null }>).detail || {}
    if ('rawConfig' in detail) {
      applyRawConfig(detail.rawConfig || null)
    }
  }

  function handleOverviewEvent(event: Event): void {
    const detail = (event as CustomEvent<{ overview?: YubaOverview | null }>).detail || {}
    if ('overview' in detail) {
      overview.value = detail.overview || null
    }
  }

  function handleYubaToggle(): void {
    if (yubaEnabled.value) {
      void saveYubaConfig({ revertCheckboxOnError: true })
      return
    }
    void disableYubaConfig()
  }

  onMounted(() => {
    document.addEventListener(YUBA_PAGE_EVENT_NAME, handleYubaPageEvent)
    document.addEventListener('douyu-keep-webui:config', handleConfigEvent)
    document.addEventListener('douyu-keep-webui:overview', handleOverviewEvent)
    void ensureCronPreview()
  })

  onBeforeUnmount(() => {
    document.removeEventListener(YUBA_PAGE_EVENT_NAME, handleYubaPageEvent)
    document.removeEventListener('douyu-keep-webui:config', handleConfigEvent)
    document.removeEventListener('douyu-keep-webui:overview', handleOverviewEvent)
  })

  return {
    handleYubaToggle,
    loadYubaCronPreview,
    saveYubaConfig,
    showYubaTable,
    triggerYubaTask,
    yubaCron,
    yubaCronPreviewText,
    yubaEmptyText,
    yubaEnabled,
    yubaMode,
    yubaNote,
    yubaTableRows,
    yubaTaskCard,
  }
}

function createLegacyYubaResourceActions(deps: LegacyYubaResourceDeps): LegacyYubaResourceActions {
  legacyResourceDeps = deps
  applyRawConfig(deps.getRawConfig() as RawYubaConfig)
  applyYubaStatusState({
    yubaStatus: deps.state.yubaStatus || [],
    yubaStatusError: deps.state.yubaStatusError || '',
    yubaStatusLoaded: deps.state.yubaStatusLoaded,
    yubaStatusLoading: deps.state.yubaStatusLoading,
  })

  return {
    loadYubaStatus,
  }
}

function createLegacyYubaTaskActions(deps: LegacyYubaTaskDeps): LegacyYubaTaskActions {
  legacyTaskDeps = deps
  applyRawConfig(deps.getRawConfig())

  return {
    disableYubaConfig,
    saveYubaConfig,
  }
}

export function dispatchYubaPageState(detail: YubaPageDetail): void {
  document.dispatchEvent(new CustomEvent(YUBA_PAGE_EVENT_NAME, { detail }))
}

export function installLegacyYubaBridge(): void {
  window.DOUYU_KEEP_WEBUI_YUBA_RESOURCE_ACTIONS = {
    create: createLegacyYubaResourceActions,
  }
  window.DOUYU_KEEP_WEBUI_YUBA_TASK_ACTIONS = {
    create: createLegacyYubaTaskActions,
  }
}
