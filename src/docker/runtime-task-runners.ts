import { executeCollectGiftJob, executeDoubleCardJob, executeExpiringGiftJob, executeKeepaliveJob, executeYubaCheckInJob } from '../core/job'
import type { DockerConfig, DoubleCardConfig, ExpiringGiftConfig, JobConfig, YubaCheckInConfig } from '../core/types'
import type { StatusCacheScope } from './runtime-cache'
import { MAIN_DOUYU_URL, YUBA_DOUYU_URL } from './runtime-constants'
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

export async function triggerCollectGiftTask(config: DockerConfig | null, deps: RuntimeTaskRunnerDeps): Promise<void> {
  if (!config?.collectGift) {
    throw new Error('领取任务未配置')
  }
  await deps.runTaskWithLock('collectGift', async () => {
    deps.taskLoggers.collectGift('手动触发执行...')
    await runCollectGiftTask(deps)
  }, manualTriggerOptions)
}

export async function triggerKeepaliveTask(config: DockerConfig | null, deps: RuntimeTaskRunnerDeps): Promise<void> {
  if (!config?.keepalive) {
    throw new Error('保活任务未配置')
  }
  const keepaliveConfig = config.keepalive
  await deps.runTaskWithLock('keepalive', async () => {
    deps.taskLoggers.keepalive('手动触发执行...')
    await runKeepaliveTask(keepaliveConfig, deps)
  }, manualTriggerOptions)
}

export async function triggerDoubleCardTask(config: DockerConfig | null, deps: RuntimeTaskRunnerDeps): Promise<void> {
  if (!config?.doubleCard) {
    throw new Error('双倍卡任务未配置')
  }
  const doubleCardConfig = config.doubleCard
  await deps.runTaskWithLock('doubleCard', async () => {
    deps.taskLoggers.doubleCard('手动触发执行...')
    await runDoubleCardTask(doubleCardConfig, deps)
  }, manualTriggerOptions)
}

export async function triggerExpiringGiftTask(
  config: DockerConfig | null,
  hasSendRooms: (config: JobConfig | DoubleCardConfig | ExpiringGiftConfig | null | undefined) => boolean,
  deps: RuntimeTaskRunnerDeps,
): Promise<void> {
  if (!config?.expiringGift || !hasSendRooms(config.expiringGift)) {
    throw new Error('临期任务未配置')
  }
  const expiringGiftConfig = config.expiringGift
  await deps.runTaskWithLock('expiringGift', async () => {
    deps.taskLoggers.expiringGift('手动触发执行...')
    await runExpiringGiftTask(expiringGiftConfig, deps)
  }, manualTriggerOptions)
}

export async function triggerYubaCheckInTask(config: DockerConfig | null, deps: RuntimeTaskRunnerDeps): Promise<void> {
  if (!config?.yubaCheckIn) {
    throw new Error('鱼吧签到任务未配置')
  }
  const yubaCheckInConfig = config.yubaCheckIn
  await deps.runTaskWithLock('yubaCheckIn', async () => {
    deps.taskLoggers.yubaCheckIn('手动触发执行...')
    await runYubaCheckInTask(yubaCheckInConfig, deps)
  }, manualTriggerOptions)
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
