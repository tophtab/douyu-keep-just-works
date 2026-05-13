import { CronJob } from 'cron'
import type { DockerConfig, DoubleCardConfig, ExpiringGiftConfig, JobConfig, YubaCheckInConfig } from '../core/types'
import type { JobStatus } from './server'
import { createTaskRecord, formatTaskList, getTaskConfig, getTaskLabel, TASK_TYPES } from './task-metadata'
import type { TaskType } from './task-metadata'
import { DOCKER_TIMEZONE } from './runtime-constants'
import type { StatusCacheScope } from './runtime-cache'
import { createStatusTimestamp, formatScheduleForLog } from './runtime-time'
import {
  runCollectGiftTask,
  runDoubleCardTask,
  runExpiringGiftTask,
  runKeepaliveTask,
  runYubaCheckInTask,
  triggerCollectGiftTask,
  triggerDoubleCardTask,
  triggerExpiringGiftTask,
  triggerKeepaliveTask,
  triggerYubaCheckInTask,
} from './runtime-task-runners'
import type { RuntimeTaskRunnerDeps } from './runtime-task-runners'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isTaskActive(config: { active?: boolean } | null | undefined): boolean {
  return Boolean(config && config.active !== false)
}

function jsonEquals(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

function createIdleStatus(): JobStatus {
  return { running: false, lastRun: null, nextRun: null }
}

export interface TaskReloadSummary {
  started: TaskType[]
  restarted: TaskType[]
  stopped: TaskType[]
}

export class DockerTaskScheduler {
  private readonly jobs: Record<TaskType, CronJob | null> = createTaskRecord(() => null)

  private readonly statuses: Record<TaskType, JobStatus> = createTaskRecord(() => createIdleStatus())

  private readonly activeRuns: Record<TaskType, boolean> = createTaskRecord(() => false)

  constructor(
    private readonly logSystem: (message: string) => void,
    private readonly taskLoggers: Record<TaskType, (message: string) => void>,
    private readonly resolveCookieForUrl: (targetUrl: string) => string,
    private readonly runAndInvalidateStatusCache: (scope: StatusCacheScope, runTask: () => Promise<void>) => Promise<void>,
  ) {}

  getStatus(): Record<TaskType, JobStatus> {
    return createTaskRecord(type => ({ ...this.statuses[type] }))
  }

  stopJobs(): void {
    TASK_TYPES.forEach(type => this.stopTask(type))
  }

  async runTaskWithLock(
    type: TaskType,
    runTask: () => Promise<void>,
    options: {
      onBusy: 'skip' | 'throw'
      busyMessage: string
    },
  ): Promise<boolean> {
    if (this.activeRuns[type]) {
      if (options.onBusy === 'skip') {
        this.taskLoggers[type](options.busyMessage)
        return false
      }
      throw new Error(options.busyMessage)
    }

    this.activeRuns[type] = true
    try {
      await runTask()
      return true
    } finally {
      this.activeRuns[type] = false
    }
  }

  reconcileTaskJobs(prevConfig: DockerConfig | null, nextConfig: DockerConfig, hasCookieSource: boolean): TaskReloadSummary {
    const summary: TaskReloadSummary = {
      started: [],
      restarted: [],
      stopped: [],
    }

    for (const type of TASK_TYPES) {
      const nextTaskConfig = getTaskConfig(nextConfig, type)
      const nextShouldRun = hasCookieSource && isTaskActive(nextTaskConfig)
      const wasRunning = Boolean(this.jobs[type])
      const configChanged = !jsonEquals(getTaskConfig(prevConfig, type) || null, nextTaskConfig || null)

      if (!nextShouldRun) {
        if (wasRunning) {
          this.stopTask(type)
          summary.stopped.push(type)
        }
        continue
      }

      if (!wasRunning) {
        this.startTask(type, nextConfig)
        summary.started.push(type)
        continue
      }

      if (configChanged) {
        this.stopTask(type)
        this.startTask(type, nextConfig)
        summary.restarted.push(type)
      }
    }

    return summary
  }

  logTaskReloadSummary(reason: 'startup' | 'cookie_saved' | 'tasks_saved' | 'ui_saved' | 'medal_synced', summary: TaskReloadSummary): void {
    if (reason === 'startup' || reason === 'ui_saved') {
      return
    }

    const parts: string[] = []
    if (summary.started.length) {
      parts.push(`启动: ${formatTaskList(summary.started)}`)
    }
    if (summary.restarted.length) {
      parts.push(`重载: ${formatTaskList(summary.restarted)}`)
    }
    if (summary.stopped.length) {
      parts.push(`停用: ${formatTaskList(summary.stopped)}`)
    }

    if (reason === 'cookie_saved') {
      if (!parts.length) {
        this.logSystem('登录凭证已更新，现有任务继续运行，无需重启')
        return
      }
      this.logSystem(`登录凭证已更新，仅调整受影响任务：${parts.join('；')}`)
      return
    }

    if (reason === 'tasks_saved') {
      if (!parts.length) {
        this.logSystem('任务配置已更新，未重启无关任务')
        return
      }
      this.logSystem(`任务配置已更新，仅调整受影响任务：${parts.join('；')}`)
      return
    }

    if (!parts.length) {
      this.logSystem('粉丝牌列表变化，但相关任务配置无需重载')
      return
    }

    this.logSystem(`粉丝牌列表变化，仅调整受影响任务：${parts.join('；')}`)
  }

  async triggerTask(
    type: TaskType,
    config: DockerConfig | null,
    hasSendRooms: (config: JobConfig | DoubleCardConfig | ExpiringGiftConfig | null | undefined) => boolean,
  ): Promise<void> {
    switch (type) {
      case 'collectGift':
        await triggerCollectGiftTask(config, this.createTaskRunnerDeps())
        return
      case 'keepalive':
        await triggerKeepaliveTask(config, this.createTaskRunnerDeps())
        return
      case 'doubleCard':
        await triggerDoubleCardTask(config, this.createTaskRunnerDeps())
        return
      case 'expiringGift':
        await triggerExpiringGiftTask(config, hasSendRooms, this.createTaskRunnerDeps())
        return
      case 'yubaCheckIn':
        await triggerYubaCheckInTask(config, this.createTaskRunnerDeps())
    }
  }

  private createTaskRunnerDeps(): RuntimeTaskRunnerDeps {
    return {
      taskLoggers: this.taskLoggers,
      resolveCookieForUrl: this.resolveCookieForUrl,
      runAndInvalidateStatusCache: this.runAndInvalidateStatusCache,
      runTaskWithLock: async (type, runTask, options) => await this.runTaskWithLock(type, runTask, options),
    }
  }

  private stopTask(type: TaskType): void {
    const job = this.jobs[type]
    if (job) {
      job.stop()
      this.jobs[type] = null
    }
    this.statuses[type] = createIdleStatus()
  }

  private startScheduledTask(
    type: TaskType,
    label: string,
    cron: string,
    runTask: () => Promise<void>,
    summary?: string,
  ): void {
    const logger = this.taskLoggers[type]
    const run = async () => {
      await this.runTaskWithLock(type, async () => {
        logger('开始执行任务...')
        this.statuses[type].lastRun = createStatusTimestamp()
        await runTask()
      }, {
        onBusy: 'skip',
        busyMessage: '任务仍在执行中，跳过本次触发',
      }).catch((error: unknown) => {
        logger(`任务执行出错: ${errorMessage(error)}`)
      })

      const job = this.jobs[type]
      if (job) {
        this.statuses[type].nextRun = job.nextDate().toISO()
      }
    }

    const job = new CronJob(cron, () => {
      void run()
    }, null, false, DOCKER_TIMEZONE)
    this.jobs[type] = job
    job.start()
    this.statuses[type].running = true
    this.statuses[type].nextRun = job.nextDate().toISO()
    this.logSystem(`${label}已启动, cron: ${cron}, 下次执行: ${formatScheduleForLog(this.statuses[type].nextRun)}${summary ? `, ${summary}` : ''}`)
  }

  private startTask(type: TaskType, config: DockerConfig): void {
    switch (type) {
      case 'collectGift':
        this.startCollectGiftTask(config.collectGift)
        return
      case 'keepalive':
        this.startKeepaliveTask(config.keepalive)
        return
      case 'doubleCard':
        this.startDoubleCardTask(config.doubleCard)
        return
      case 'expiringGift':
        this.startExpiringGiftTask(config.expiringGift)
        return
      case 'yubaCheckIn':
        this.startYubaCheckInTask(config.yubaCheckIn)
    }
  }

  private startCollectGiftTask(config: DockerConfig['collectGift']): void {
    if (!config || config.active === false) {
      return
    }
    this.startScheduledTask(
      'collectGift',
      getTaskLabel('collectGift'),
      config.cron,
      async () => {
        await runCollectGiftTask(this.createTaskRunnerDeps())
      },
    )
  }

  private startKeepaliveTask(config: JobConfig | undefined): void {
    if (!config || config.active === false) {
      return
    }
    this.startScheduledTask(
      'keepalive',
      getTaskLabel('keepalive'),
      config.cron,
      async () => {
        await runKeepaliveTask(config, this.createTaskRunnerDeps())
      },
      `房间数: ${Object.keys(config.send).length}`,
    )
  }

  private startDoubleCardTask(config: DoubleCardConfig | undefined): void {
    if (!config || config.active === false) {
      return
    }
    this.startScheduledTask(
      'doubleCard',
      getTaskLabel('doubleCard'),
      config.cron,
      async () => {
        await runDoubleCardTask(config, this.createTaskRunnerDeps())
      },
      `房间数: ${Object.keys(config.send).length}`,
    )
  }

  private startExpiringGiftTask(config: ExpiringGiftConfig | undefined): void {
    if (!config || config.active === false) {
      return
    }
    this.startScheduledTask(
      'expiringGift',
      getTaskLabel('expiringGift'),
      config.cron,
      async () => {
        await runExpiringGiftTask(config, this.createTaskRunnerDeps())
      },
      `阈值: ${config.thresholdHours || 24}小时, 房间数: ${Object.keys(config.send).length}`,
    )
  }

  private startYubaCheckInTask(config: YubaCheckInConfig | undefined): void {
    if (!config || config.active === false) {
      return
    }
    this.startScheduledTask(
      'yubaCheckIn',
      getTaskLabel('yubaCheckIn'),
      config.cron,
      async () => {
        await runYubaCheckInTask(config, this.createTaskRunnerDeps())
      },
      `模式: ${config.mode || 'followed'}`,
    )
  }
}
