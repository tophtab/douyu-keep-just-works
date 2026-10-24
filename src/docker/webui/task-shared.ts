import type { JobConfig } from '../../core/types'
import { formatDate } from './datetime'
import { hasCookieSourceConfigured, saveConfigPatch } from './resource-config'
import type { ConfigMutationResult, CookieSourceConfig } from './resource-config'
import { requestJson } from './request'
import { showToast } from './toast'

export { hasCookieSourceConfigured }
export type { CookieSourceConfig }

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
  refresh: (result: SaveTaskConfigResult | null) => Promise<void>
  revertCheckboxOnError?: boolean
  setEnabled: (enabled: boolean) => void
  successMessage: string
}

export interface DisableTaskConfigOptions {
  failurePrefix: string
  isUnauthorizedError: (error: unknown) => boolean
  payload: unknown
  refresh: (result: SaveTaskConfigResult | null) => Promise<void>
  successMessage: string
  restoreEnabled: () => void
}

export type SaveTaskConfigResult = ConfigMutationResult

export interface FanListMessageOptions {
  emptyMissingCredentialText: string
  fansListError: string
  fansListLoaded: boolean
  managedLoading: boolean
  rawConfig: CookieSourceConfig | null
  rowCount: number
}

export type WebUiTaskType = 'collectGift' | 'keepalive' | 'doubleCard' | 'expiringGift' | 'yubaCheckIn'

interface TaskReadinessRule {
  cookie: 'main' | 'yuba'
  requiresRooms: boolean
}

/** 只描述判断启动状态所需的配置字段，页面自带的窄类型也能直接传入。 */
export interface TaskReadinessConfig {
  loginCookies?: { main?: string, yuba?: string }
  collectGift?: { cron?: string }
  keepalive?: { cron?: string, roomAllocations?: Record<string, unknown> }
  doubleCard?: { cron?: string, roomAllocations?: Record<string, unknown> }
  expiringGift?: { cron?: string, roomAllocations?: Record<string, unknown> }
  yubaCheckIn?: { cron?: string }
}

/** 每个任务跑起来必需的配置：对应 Cookie、Cron，以及可选的房间分配。 */
const TASK_READINESS_RULES: Record<WebUiTaskType, TaskReadinessRule> = {
  collectGift: { cookie: 'main', requiresRooms: false },
  keepalive: { cookie: 'main', requiresRooms: true },
  doubleCard: { cookie: 'main', requiresRooms: true },
  expiringGift: { cookie: 'main', requiresRooms: true },
  yubaCheckIn: { cookie: 'yuba', requiresRooms: false },
}

export interface ScheduledTaskCardInput {
  enabled: boolean
  ready: boolean
}

interface TaskConfigAccessorOptions<TConfig, RawConfig extends object> {
  configKey: keyof RawConfig
  fallback: TConfig
  getManagedConfig: () => RawConfig | null
  getRawConfig: () => RawConfig | null
}

export function getTaskTriggerEndpoint(type: WebUiTaskType): string {
  return `/api/trigger/${type}`
}

export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function isHttpUnauthorized(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'status' in error && error.status === 401)
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

export function isTaskEnabled(config: { enabled?: boolean } | undefined): boolean {
  return Boolean(config?.enabled)
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

export function getAllocationValueLabel(model: 1 | 2): string {
  return model === 2 ? '数量' : '权重值'
}

export function hasFanTaskTableRows(rawConfig: CookieSourceConfig | null, rowCount: number): boolean {
  return hasCookieSourceConfigured(rawConfig) && rowCount > 0
}

export function resolveCurrentTaskConfig<TConfig, RawConfig extends object>(options: {
  configKey: keyof RawConfig
  fallback: TConfig
  getManagedConfig?: () => RawConfig
  getRawConfig?: () => RawConfig
  managedConfig: RawConfig | null
  rawConfig: RawConfig | null
}): TConfig {
  const key = options.configKey
  return (
    options.managedConfig?.[key] as TConfig | undefined
  ) || (
    options.rawConfig?.[key] as TConfig | undefined
  ) || (
    options.getManagedConfig?.()[key] as TConfig | undefined
  ) || (
    options.getRawConfig?.()[key] as TConfig | undefined
  ) || options.fallback
}

export function createTaskConfigAccessor<TConfig, RawConfig extends object>(
  options: TaskConfigAccessorOptions<TConfig, RawConfig>,
): () => TConfig {
  return () => resolveCurrentTaskConfig({
    configKey: options.configKey,
    managedConfig: options.getManagedConfig(),
    rawConfig: options.getRawConfig(),
    fallback: options.fallback,
  })
}

export function createDisabledAllocationTaskConfig(config: JobConfig): JobConfig {
  return { ...config, enabled: false }
}

export function isScheduledTaskReady(
  type: WebUiTaskType,
  config: TaskReadinessConfig | null | undefined,
  roomCount?: number,
): boolean {
  if (!config) {
    return false
  }
  const rule = TASK_READINESS_RULES[type]
  const taskConfig = config[type] as { cron?: string, roomAllocations?: Record<string, unknown> } | undefined
  if (!taskConfig || !String(taskConfig.cron || '').trim()) {
    return false
  }
  const cookie = rule.cookie === 'yuba' ? config.loginCookies?.yuba : config.loginCookies?.main
  if (!String(cookie || '').trim()) {
    return false
  }
  if (rule.requiresRooms) {
    const count = roomCount ?? Object.keys(taskConfig.roomAllocations || {}).length
    if (count <= 0) {
      return false
    }
  }
  return true
}

export function resolveTaskPill(enabled: boolean, ready: boolean): TaskCardPill {
  if (!enabled) {
    return { label: '未启动', kind: 'off' }
  }
  if (!ready) {
    return { label: '未配置', kind: 'warn' }
  }
  return { label: '已启动', kind: 'ok' }
}

export function createScheduledTaskCard(input: ScheduledTaskCardInput, status: TaskRunStatus, thirdCell: TaskCardCell): TaskStatusCardState {
  return {
    pills: [resolveTaskPill(input.enabled, input.ready)],
    cells: [
      { label: '上次执行', value: formatDate(status.lastRun || null) },
      { label: '下次执行', value: formatDate(status.nextRun || null) },
      thirdCell,
    ],
  }
}

async function postConfigPayload(payload: unknown): Promise<SaveTaskConfigResult | null> {
  return await saveConfigPatch(payload)
}

export async function saveTaskConfig(options: SaveTaskConfigOptions): Promise<void> {
  options.setEnabled(true)
  try {
    const result = await postConfigPayload(options.payload)
    showToast(options.successMessage, true)
    await options.refresh(result)
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
    const result = await postConfigPayload(options.payload)
    showToast(options.successMessage, true)
    await options.refresh(result)
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
