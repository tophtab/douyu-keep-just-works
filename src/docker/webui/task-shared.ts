import type { JobConfig, sendConfig } from '../../core/types'
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

interface TaskConfigAccessorOptions<TConfig, RawConfig extends object> {
  configKey: keyof RawConfig
  fallback: TConfig
  getManagedConfig: () => RawConfig | null
  getRawConfig: () => RawConfig | null
}

interface DisabledAllocationTaskOptions {
  defaultCron: string
  normalizeModel: (model: unknown) => 1 | 2
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

export function createDisabledAllocationTaskConfig<TConfig extends { cron?: string; model?: unknown; send?: sendConfig }>(
  config: TConfig,
  options: DisabledAllocationTaskOptions,
): JobConfig {
  return {
    active: false,
    cron: config.cron || options.defaultCron,
    model: options.normalizeModel(config.model),
    send: config.send || {},
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
