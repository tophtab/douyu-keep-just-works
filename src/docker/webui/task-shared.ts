import { onBeforeUnmount, onMounted } from 'vue'
import type { Ref } from 'vue'
import { WEBUI_BRIDGE_EVENTS } from './bridge-contract'
import { formatDate } from './datetime'
import { requestJson } from './request'
import { showToast } from './toast'

export interface TaskRunStatus {
  lastRun?: string | null
  nextRun?: string | null
  running?: boolean
}

export interface TaskCardCell {
  label: string
  value: string
}

export interface TaskCardPill {
  kind: string
  label: string
}

export interface TaskStatusCardState {
  cells: TaskCardCell[]
  pills: TaskCardPill[]
}

export interface CookieSourceConfig {
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
}

export interface LegacyPageEventOptions<PageDetail, RawConfig, Overview> {
  ensureCronPreview?: () => Promise<void>
  onOverview: (overview: Overview | null) => void
  onPageDetail: (detail: PageDetail) => void
  onRawConfig: (rawConfig: RawConfig | null) => void
  pageEventName: string
}

export interface FanTaskPageDetail<TFan, RawConfig, Overview> {
  fans?: TFan[]
  fansListError?: string
  fansListLoaded?: boolean
  managedConfig?: RawConfig | null
  managedLoading?: boolean
  overview?: Overview | null
  rawConfig?: RawConfig | null
}

export interface FanTaskPageRefs<TFan, RawConfig, Overview> {
  fans: Ref<TFan[]>
  fansListError: Ref<string>
  fansListLoaded: Ref<boolean>
  managedConfig: Ref<RawConfig | null>
  managedLoading: Ref<boolean>
  overview: Ref<Overview | null>
  rawConfig: Ref<RawConfig | null>
}

export interface TaskTriggerOptions {
  isUnauthorizedError: (error: unknown) => boolean
  onSuccess?: () => Promise<void> | void
  refresh?: Array<(() => Promise<unknown> | undefined) | undefined>
  taskType: WebUiTaskType
}

export interface SaveTaskConfigOptions {
  failurePrefix: string
  isUnauthorizedError: (error: unknown) => boolean
  payload: unknown
  refresh: () => Promise<void>
  revertCheckboxOnError?: boolean
  setEnabled: (enabled: boolean) => void
  successMessage: string
}

export interface DisableTaskConfigOptions {
  failurePrefix: string
  isUnauthorizedError: (error: unknown) => boolean
  payload: unknown
  refresh: () => Promise<void>
  successMessage: string
  restoreEnabled: () => void
}

export interface FanListMessageOptions {
  emptyMissingCredentialText: string
  fansListError: string
  fansListLoaded: boolean
  loadingText: string
  managedLoading: boolean
  missingCredentialText: string
  rawConfig: CookieSourceConfig | null
  readyText: string
  rowCount: number
}

export type UnauthorizedChecker = (error: unknown) => boolean

export type WebUiTaskType = 'collectGift' | 'keepalive' | 'doubleCard' | 'expiringGift' | 'yubaCheckIn'

const WEBUI_TASK_TYPES: WebUiTaskType[] = ['collectGift', 'keepalive', 'doubleCard', 'expiringGift', 'yubaCheckIn']

export function isWebUiTaskType(value: string | null): value is WebUiTaskType {
  return Boolean(value && (WEBUI_TASK_TYPES as string[]).includes(value))
}

export function getTaskTriggerEndpoint(type: WebUiTaskType): string {
  return `/api/trigger/${type}`
}

export function applyFanTaskPageDetail<TFan, RawConfig, Overview>(
  detail: FanTaskPageDetail<TFan, RawConfig, Overview>,
  refs: FanTaskPageRefs<TFan, RawConfig, Overview>,
): void {
  if ('rawConfig' in detail) {
    refs.rawConfig.value = detail.rawConfig || null
  }
  if ('managedConfig' in detail) {
    refs.managedConfig.value = detail.managedConfig || null
  }
  if ('overview' in detail) {
    refs.overview.value = detail.overview || null
  }
  if ('fans' in detail) {
    refs.fans.value = detail.fans || []
  }
  if ('fansListError' in detail) {
    refs.fansListError.value = detail.fansListError || ''
  }
  if ('fansListLoaded' in detail) {
    refs.fansListLoaded.value = Boolean(detail.fansListLoaded)
  }
  if ('managedLoading' in detail) {
    refs.managedLoading.value = Boolean(detail.managedLoading)
  }
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function isHttpUnauthorized(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'status' in error && error.status === 401)
}

export function isLegacyOrHttpUnauthorized(error: unknown, ...checkers: Array<UnauthorizedChecker | undefined>): boolean {
  return checkers.some(checker => checker?.(error)) || isHttpUnauthorized(error)
}

export function hasCookieSourceConfigured(config: CookieSourceConfig | null): boolean {
  const cookieCloud = config?.cookieCloud
  const manualCookies = config?.manualCookies
  return Boolean(
    String(manualCookies?.main || config?.cookie || '').trim()
    || String(manualCookies?.yuba || '').trim()
    || (cookieCloud?.active && String(cookieCloud.endpoint || '').trim() && String(cookieCloud.uuid || '').trim() && String(cookieCloud.password || '').trim()),
  )
}

export function createFanListNote(options: FanListMessageOptions): string {
  if (!hasCookieSourceConfigured(options.rawConfig)) {
    return options.missingCredentialText
  }
  if (options.managedLoading && !options.rowCount) {
    return options.loadingText
  }
  if (!options.rowCount) {
    if (options.fansListError) {
      return '粉丝牌列表加载失败。'
    }
    return options.fansListLoaded ? '当前没有可用粉丝牌。' : '粉丝牌列表尚未加载。'
  }
  return options.readyText
}

export function createFanListEmptyText(options: FanListMessageOptions): string {
  if (!hasCookieSourceConfigured(options.rawConfig)) {
    return options.emptyMissingCredentialText
  }
  if (options.managedLoading && !options.rowCount) {
    return '请稍候…'
  }
  if (!options.rowCount && options.fansListError) {
    return `加载粉丝牌列表失败：${options.fansListError}。请点击顶部“刷新”重试。`
  }
  if (!options.rowCount && options.fansListLoaded) {
    return '已同步，但当前账号没有可用粉丝牌数据。'
  }
  return '正在准备加载粉丝牌列表，也可以点击刷新手动加载。'
}

export function formatOptionalNumber(value: unknown): number | string {
  return value !== undefined && value !== null && value !== '' ? Number(value) : '-'
}

export function isTaskActive(config: { active?: boolean } | undefined): boolean {
  return Boolean(config && config.active !== false)
}

export function createPendingTaskCard(thirdLabel: string): TaskStatusCardState {
  return {
    pills: [{ label: '等待加载', kind: 'off' }],
    cells: [
      { label: '上次执行', value: '-' },
      { label: '下次执行', value: '-' },
      { label: thirdLabel, value: '-' },
    ],
  }
}

export function createScheduledTaskCard(configured: boolean, status: TaskRunStatus, thirdCell: TaskCardCell): TaskStatusCardState {
  return {
    pills: [
      { label: configured ? '已启动' : '未启动', kind: configured ? 'ok' : 'off' },
      { label: configured ? (status.running ? '调度中' : '已停止') : '未启用', kind: configured ? (status.running ? 'warn' : 'off') : 'off' },
    ],
    cells: [
      { label: '上次执行', value: formatDate(status.lastRun || null) },
      { label: '下次执行', value: formatDate(status.nextRun || null) },
      thirdCell,
    ],
  }
}

export function useLegacyPageEvents<PageDetail, RawConfig, Overview>(options: LegacyPageEventOptions<PageDetail, RawConfig, Overview>): void {
  function handlePageEvent(event: Event): void {
    options.onPageDetail((event as CustomEvent<PageDetail>).detail || {} as PageDetail)
  }

  function handleConfigEvent(event: Event): void {
    const detail = (event as CustomEvent<{ rawConfig?: RawConfig | null }>).detail || {}
    if ('rawConfig' in detail) {
      options.onRawConfig(detail.rawConfig || null)
    }
  }

  function handleOverviewEvent(event: Event): void {
    const detail = (event as CustomEvent<{ overview?: Overview | null }>).detail || {}
    if ('overview' in detail) {
      options.onOverview(detail.overview || null)
    }
  }

  onMounted(() => {
    document.addEventListener(options.pageEventName, handlePageEvent)
    document.addEventListener(WEBUI_BRIDGE_EVENTS.config, handleConfigEvent)
    document.addEventListener(WEBUI_BRIDGE_EVENTS.overview, handleOverviewEvent)
    void options.ensureCronPreview?.()
  })

  onBeforeUnmount(() => {
    document.removeEventListener(options.pageEventName, handlePageEvent)
    document.removeEventListener(WEBUI_BRIDGE_EVENTS.config, handleConfigEvent)
    document.removeEventListener(WEBUI_BRIDGE_EVENTS.overview, handleOverviewEvent)
  })
}

async function postConfigPayload(payload: unknown): Promise<void> {
  await requestJson('/api/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export async function saveTaskConfig(options: SaveTaskConfigOptions): Promise<void> {
  options.setEnabled(true)
  try {
    await postConfigPayload(options.payload)
    showToast(options.successMessage, true)
    await options.refresh()
  } catch (error) {
    if (options.revertCheckboxOnError) {
      options.setEnabled(false)
    }
    if (options.isUnauthorizedError(error)) {
      return
    }
    showToast(`${options.failurePrefix}${getErrorMessage(error)}`, false)
  }
}

export async function disableTaskConfig(options: DisableTaskConfigOptions): Promise<void> {
  try {
    await postConfigPayload(options.payload)
    showToast(options.successMessage, true)
    await options.refresh()
  } catch (error) {
    options.restoreEnabled()
    if (options.isUnauthorizedError(error)) {
      return
    }
    showToast(`${options.failurePrefix}${getErrorMessage(error)}`, false)
  }
}

export async function triggerTask(options: TaskTriggerOptions): Promise<void> {
  try {
    await requestJson(getTaskTriggerEndpoint(options.taskType), { method: 'POST' })
    showToast('执行完成', true)
    await Promise.all((options.refresh || []).map(refresh => refresh?.()).filter(Boolean))
    await options.onSuccess?.()
  } catch (error) {
    if (options.isUnauthorizedError(error)) {
      return
    }
    showToast(`执行失败：${getErrorMessage(error)}`, false)
  }
}
