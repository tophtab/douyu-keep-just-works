import { onBeforeUnmount, onMounted } from 'vue'
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

export interface TaskTriggerOptions {
  endpoint: string
  isUnauthorizedError: (error: unknown) => boolean
  onSuccess?: () => Promise<void> | void
  refresh?: Array<(() => Promise<unknown> | undefined) | undefined>
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

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function isHttpUnauthorized(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'status' in error && error.status === 401)
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
    document.addEventListener('douyu-keep-webui:config', handleConfigEvent)
    document.addEventListener('douyu-keep-webui:overview', handleOverviewEvent)
    void options.ensureCronPreview?.()
  })

  onBeforeUnmount(() => {
    document.removeEventListener(options.pageEventName, handlePageEvent)
    document.removeEventListener('douyu-keep-webui:config', handleConfigEvent)
    document.removeEventListener('douyu-keep-webui:overview', handleOverviewEvent)
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
    await requestJson(options.endpoint, { method: 'POST' })
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
