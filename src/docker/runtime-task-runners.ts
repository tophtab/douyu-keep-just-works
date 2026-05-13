import { executeCollectGiftJob, executeDoubleCardJob, executeExpiringGiftJob, executeKeepaliveJob, executeYubaCheckInJob } from '../core/job'
import type { DockerConfig, DoubleCardConfig, ExpiringGiftConfig, JobConfig, YubaCheckInConfig } from '../core/types'
import type { StatusCacheScope } from './runtime-cache'
import { MAIN_DOUYU_URL, YUBA_DOUYU_URL } from './runtime-constants'
import { getTaskNotConfiguredMessage } from './task-metadata'
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
  runAndInvalidateStatusCache: (scope: StatusCacheScope, runTask: () => Promise<void>) => Promise<void>
  runTaskWithLock: TaskLockRunner
}

const manualTriggerOptions = {
  onBusy: 'throw' as const,
  busyMessage: '任务正在执行中，请稍后再试',
}

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

export async function triggerCollectGiftTask(config: DockerConfig | null, deps: RuntimeTaskRunnerDeps): Promise<void> {
  await triggerConfiguredTask({
    config: config?.collectGift,
    deps,
    taskType: 'collectGift',
    runTask: async () => {
      await runCollectGiftTask(deps)
    },
  })
}

export async function triggerKeepaliveTask(config: DockerConfig | null, deps: RuntimeTaskRunnerDeps): Promise<void> {
  await triggerConfiguredTask({
    config: config?.keepalive,
    deps,
    taskType: 'keepalive',
    runTask: async taskConfig => await runKeepaliveTask(taskConfig, deps),
  })
}

export async function triggerDoubleCardTask(config: DockerConfig | null, deps: RuntimeTaskRunnerDeps): Promise<void> {
  await triggerConfiguredTask({
    config: config?.doubleCard,
    deps,
    taskType: 'doubleCard',
    runTask: async taskConfig => await runDoubleCardTask(taskConfig, deps),
  })
}

export async function triggerExpiringGiftTask(
  config: DockerConfig | null,
  hasSendRooms: (config: JobConfig | DoubleCardConfig | ExpiringGiftConfig | null | undefined) => boolean,
  deps: RuntimeTaskRunnerDeps,
): Promise<void> {
  await triggerConfiguredTask({
    config: hasSendRooms(config?.expiringGift) ? config?.expiringGift : null,
    deps,
    taskType: 'expiringGift',
    runTask: async taskConfig => await runExpiringGiftTask(taskConfig, deps),
  })
}

export async function triggerYubaCheckInTask(config: DockerConfig | null, deps: RuntimeTaskRunnerDeps): Promise<void> {
  await triggerConfiguredTask({
    config: config?.yubaCheckIn,
    deps,
    taskType: 'yubaCheckIn',
    runTask: async taskConfig => await runYubaCheckInTask(taskConfig, deps),
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
