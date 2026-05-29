import { executeCollectGiftJob, executeDoubleCardJob, executeExpiringGiftJob, executeKeepaliveJob, executeYubaCheckInJob } from '../core/job'
import type { DockerConfig, DoubleCardConfig, ExpiringGiftConfig, JobConfig, YubaCheckInConfig } from '../core/types'
import type { StatusCacheScope } from './runtime-cache'
import { MAIN_DOUYU_URL, YUBA_DOUYU_URL } from './runtime-constants'
import { getTaskLabel, getTaskNotConfiguredMessage, createTaskRecord } from './task-metadata'
import type { TaskType } from './task-metadata'

type TaskLoggerMap = Record<TaskType, (message: string) => void>

type TaskLockRunner = (
  type: TaskType,
  runTask: () => Promise<void>,
  options: {
    onBusy: 'skip' | 'throw'
    busyMessage: string
  },
) => Promise<boolean>

export interface RuntimeTaskRunnerDeps {
  taskLoggers: TaskLoggerMap
  resolveCookieForUrl: (targetUrl: string) => string
  refreshCookieSourceAfterFailure: (error: unknown, context: string) => Promise<boolean>
  runAndInvalidateStatusCache: (scope: StatusCacheScope, runTask: () => Promise<void>) => Promise<void>
  runTaskWithLock: TaskLockRunner
}

const manualTriggerOptions = {
  onBusy: 'throw' as const,
  busyMessage: '任务正在执行中，请稍后再试',
}

type TaskConfigResolver = (
  config: DockerConfig | null,
  hasSendRooms: (config: JobConfig | DoubleCardConfig | ExpiringGiftConfig | null | undefined) => boolean,
) => DockerConfig[TaskType] | null | undefined

type RuntimeTaskRunner = (config: DockerConfig[TaskType], deps: RuntimeTaskRunnerDeps) => Promise<void>

const taskConfigResolvers: Record<TaskType, TaskConfigResolver> = {
  collectGift: config => config?.collectGift,
  keepalive: config => config?.keepalive,
  doubleCard: config => config?.doubleCard,
  expiringGift: (config, hasSendRooms) => hasSendRooms(config?.expiringGift) ? config?.expiringGift : null,
  yubaCheckIn: config => config?.yubaCheckIn,
}

const runtimeTaskRunners: Record<TaskType, RuntimeTaskRunner> = createTaskRecord(type => async (config, deps) => {
  switch (type) {
    case 'collectGift':
      await runCollectGiftTask(deps)
      return
    case 'keepalive':
      await runKeepaliveTask(config as JobConfig, deps)
      return
    case 'doubleCard':
      await runDoubleCardTask(config as DoubleCardConfig, deps)
      return
    case 'expiringGift':
      await runExpiringGiftTask(config as ExpiringGiftConfig, deps)
      return
    case 'yubaCheckIn':
      await runYubaCheckInTask(config as YubaCheckInConfig, deps)
  }
})

async function triggerConfiguredTask<TConfig>(options: {
  config: TConfig | null | undefined
  deps: RuntimeTaskRunnerDeps
  runTask: (config: TConfig) => Promise<void>
  taskType: TaskType
}): Promise<void> {
  if (!options.config) {
    throw new Error(getTaskNotConfiguredMessage(options.taskType))
  }

  await options.deps.runTaskWithLock(options.taskType, async () => {
    options.deps.taskLoggers[options.taskType]('手动触发执行...')
    await options.runTask(options.config as TConfig)
  }, manualTriggerOptions)
}

export async function runRuntimeTask(type: TaskType, config: DockerConfig[TaskType], deps: RuntimeTaskRunnerDeps): Promise<void> {
  try {
    await runtimeTaskRunners[type](config, deps)
  } catch (error: unknown) {
    const refreshed = await deps.refreshCookieSourceAfterFailure(error, getTaskLabel(type))
    if (!refreshed) {
      throw error
    }

    deps.taskLoggers[type]('登录凭证恢复完成，重试本次任务...')
    await runtimeTaskRunners[type](config, deps)
  }
}

export async function triggerRuntimeTask(
  type: TaskType,
  config: DockerConfig | null,
  hasSendRooms: (config: JobConfig | DoubleCardConfig | ExpiringGiftConfig | null | undefined) => boolean,
  deps: RuntimeTaskRunnerDeps,
): Promise<void> {
  const taskConfig = taskConfigResolvers[type](config, hasSendRooms)
  await triggerConfiguredTask({
    config: taskConfig,
    deps,
    taskType: type,
    runTask: async resolvedConfig => await runRuntimeTask(type, resolvedConfig, deps),
  })
}

export async function runCollectGiftTask(deps: RuntimeTaskRunnerDeps): Promise<void> {
  const cookie = deps.resolveCookieForUrl(MAIN_DOUYU_URL)
  await deps.runAndInvalidateStatusCache('fans', async () => {
    await executeCollectGiftJob(cookie, deps.taskLoggers.collectGift)
  })
}

export async function runKeepaliveTask(config: JobConfig, deps: RuntimeTaskRunnerDeps): Promise<void> {
  const cookie = deps.resolveCookieForUrl(MAIN_DOUYU_URL)
  await deps.runAndInvalidateStatusCache('fans', async () => {
    await executeKeepaliveJob(config, cookie, deps.taskLoggers.keepalive)
  })
}

export async function runDoubleCardTask(config: DoubleCardConfig, deps: RuntimeTaskRunnerDeps): Promise<void> {
  const cookie = deps.resolveCookieForUrl(MAIN_DOUYU_URL)
  await deps.runAndInvalidateStatusCache('fans', async () => {
    await executeDoubleCardJob(config, cookie, deps.taskLoggers.doubleCard)
  })
}

export async function runExpiringGiftTask(config: ExpiringGiftConfig, deps: RuntimeTaskRunnerDeps): Promise<void> {
  const cookie = deps.resolveCookieForUrl(MAIN_DOUYU_URL)
  await deps.runAndInvalidateStatusCache('fans', async () => {
    await executeExpiringGiftJob(config, cookie, deps.taskLoggers.expiringGift)
  })
}

export async function runYubaCheckInTask(config: YubaCheckInConfig, deps: RuntimeTaskRunnerDeps): Promise<void> {
  const mainCookie = deps.resolveCookieForUrl(MAIN_DOUYU_URL)
  const yubaCookie = deps.resolveCookieForUrl(YUBA_DOUYU_URL)
  await deps.runAndInvalidateStatusCache('yuba', async () => {
    await executeYubaCheckInJob(config, yubaCookie, mainCookie, deps.taskLoggers.yubaCheckIn)
  })
}
