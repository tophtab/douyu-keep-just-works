import type { Ref } from 'vue'
import type { WebUiPageTab } from './navigation'
import { applyManagedFansResponse, loadFansStatus } from './resource-fans'
import { loadLogs, loadOverview, refreshOverviewSurface } from './resource-state'
import { createPendingTaskCard, createScheduledTaskCard, disableTaskConfig, isHttpUnauthorized, saveTaskConfig, triggerTask } from './task-shared'
import type { SaveTaskConfigResult, TaskCardCell, TaskRunStatus, TaskStatusCardState, WebUiTaskType } from './task-shared'

interface ToggleSaveOptions {
  revertCheckboxOnError?: boolean
}

interface ScheduledTaskCardOptions {
  configured: boolean
  overviewReady: boolean
  pendingThirdLabel: string
  status?: TaskRunStatus
  thirdCell: TaskCardCell
}

interface TaskMutationOptions {
  failurePrefix: string
  payload: unknown
  refresh: (result: SaveTaskConfigResult | null) => Promise<void>
  restoreEnabled?: () => void
  revertCheckboxOnError?: boolean
  successMessage: string
}

interface SaveEnabledTaskOptions extends TaskMutationOptions {
  enabled: Ref<boolean>
}

function isUnauthorizedTaskError(error: unknown): boolean {
  return isHttpUnauthorized(error)
}

function isFansBackedTab(activeTab: WebUiPageTab): boolean {
  return activeTab === 'keepalive' || activeTab === 'double-card' || activeTab === 'expiring-gift'
}

export function createOverviewTaskCard(options: ScheduledTaskCardOptions): TaskStatusCardState {
  if (!options.overviewReady) {
    return createPendingTaskCard(options.pendingThirdLabel)
  }

  return createScheduledTaskCard(options.configured, options.status || {}, options.thirdCell)
}

export async function refreshTaskSurface(activeTab: WebUiPageTab, result: SaveTaskConfigResult | null = null): Promise<void> {
  applyManagedFansResponse(result, { updateFans: isFansBackedTab(activeTab) })
  await refreshOverviewSurface(activeTab, false)
}

export async function saveEnabledTask(options: SaveEnabledTaskOptions): Promise<void> {
  await saveTaskConfig({
    payload: options.payload,
    successMessage: options.successMessage,
    failurePrefix: options.failurePrefix,
    setEnabled: (enabled) => {
      options.enabled.value = enabled
    },
    revertCheckboxOnError: options.revertCheckboxOnError,
    isUnauthorizedError: isUnauthorizedTaskError,
    refresh: options.refresh,
  })
}

export async function disableEnabledTask(options: TaskMutationOptions): Promise<void> {
  await disableTaskConfig({
    payload: options.payload,
    successMessage: options.successMessage,
    failurePrefix: options.failurePrefix,
    restoreEnabled: options.restoreEnabled || (() => {}),
    isUnauthorizedError: isUnauthorizedTaskError,
    refresh: options.refresh,
  })
}

export function toggleEnabledTask(
  enabled: Ref<boolean>,
  save: (options?: ToggleSaveOptions) => Promise<void>,
  disable: () => Promise<void>,
): void {
  if (enabled.value) {
    void save({ revertCheckboxOnError: true })
    return
  }
  void disable()
}

export async function triggerFansBackedTask(taskType: WebUiTaskType, onSuccess?: () => Promise<void> | void): Promise<void> {
  await triggerTask({
    taskType,
    isUnauthorizedError: isUnauthorizedTaskError,
    refresh: [
      () => loadOverview(),
      () => loadLogs(),
      () => loadFansStatus(false),
    ],
    onSuccess,
  })
}
