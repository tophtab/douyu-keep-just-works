import { executeCollectGiftJob, executeDoubleCardJob, executeExpiringGiftJob, executeKeepaliveJob, executeYubaCheckInJob } from '../core/job'
import type { DockerConfig, DoubleCardConfig, ExpiringGiftConfig, JobConfig, YubaCheckInConfig } from '../core/types'
import type { StatusCacheScope } from './runtime-cache'
import { MAIN_DOUYU_URL, YUBA_DOUYU_URL } from './runtime-constants'
import { getTaskLabel, getTaskNotConfiguredMessage, createTaskRecord, getTriggerableTaskConfig } from './task-metadata'
import type { TaskType } from './task-metadata'
import { recordTaskRun, sendTaskRunCard } from './runtime-notify'
import { diffIntimacy, snapshotIntimacy } from './runtime-fans-intimacy'
import type { IntimacySnapshot } from './runtime-fans-intimacy'

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

/**
 * 会真正送出礼物的任务。只有这些任务需要读粉丝牌算亲密度增量；
 * 领取、鱼吧签到不发礼物，多读一次只是浪费请求。
 */
const GIFT_TASK_TYPES = new Set<TaskType>(['expiringGift', 'doubleCard', 'keepalive'])

/**
 * 读取亲密度快照。cookie 解析失败、网络失败都只返回 null。
 * 亲密度只是附加信息：既不能阻止任务执行，也不能阻止失败记录落盘，
 * 更不能把原始任务错误替换成「请先配置 cookie」。
 */
async function safeSnapshotIntimacy(resolveCookie: () => string): Promise<IntimacySnapshot | null> {
  try {
    return await snapshotIntimacy(resolveCookie())
  } catch {
    return null
  }
}

type RuntimeTaskRunner = (config: DockerConfig[TaskType], deps: RuntimeTaskRunnerDeps) => Promise<void>

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

export async function runRuntimeTask(
  type: TaskType,
  config: DockerConfig[TaskType],
  deps: RuntimeTaskRunnerDeps,
  trigger: 'manual' | 'scheduled' = 'scheduled',
): Promise<void> {
  const startedAt = new Date().toISOString()
  const collected: string[] = []
  const recordingDeps: RuntimeTaskRunnerDeps = {
    ...deps,
    taskLoggers: {
      ...deps.taskLoggers,
      [type]: (message: string) => {
        deps.taskLoggers[type](message)
        collected.push(message)
        if (collected.length > 40) {
          collected.shift()
        }
      },
    },
  }

  // 送礼类任务：执行前后各读一次粉丝牌，差值即本次亲密度增量
  const trackIntimacy = GIFT_TASK_TYPES.has(type)
  const beforeIntimacy = trackIntimacy
    ? await safeSnapshotIntimacy(() => deps.resolveCookieForUrl(MAIN_DOUYU_URL))
    : null

  try {
    await executeRuntimeTask(type, config, recordingDeps)
    const intimacy = trackIntimacy
      ? diffIntimacy(beforeIntimacy, await safeSnapshotIntimacy(() => deps.resolveCookieForUrl(MAIN_DOUYU_URL)))
      : undefined
    const record = recordTaskRun({ type, ok: true, startedAt, logs: collected, intimacy })
    // 定时任务只记录，等每日汇总统一发；手动触发立即推送单次结果
    if (trigger === 'manual') {
      await sendTaskRunCard(record, trigger)
    }
  } catch (error: unknown) {
    const intimacy = trackIntimacy
      ? diffIntimacy(beforeIntimacy, await safeSnapshotIntimacy(() => deps.resolveCookieForUrl(MAIN_DOUYU_URL)))
      : undefined
    const record = recordTaskRun({ type, ok: false, startedAt, error, logs: collected, intimacy })
    if (trigger === 'manual') {
      await sendTaskRunCard(record, trigger)
    }
    throw error
  }
}

async function executeRuntimeTask(type: TaskType, config: DockerConfig[TaskType], deps: RuntimeTaskRunnerDeps): Promise<void> {
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
  const taskConfig = getTriggerableTaskConfig(config, type, hasSendRooms)
  await triggerConfiguredTask({
    config: taskConfig,
    deps,
    taskType: type,
    runTask: async resolvedConfig => await runRuntimeTask(type, resolvedConfig, deps, 'manual'),
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
