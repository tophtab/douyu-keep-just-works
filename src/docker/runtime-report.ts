import { CronJob } from 'cron'
import type { DockerConfig } from '../core/types'
import { DOCKER_TIMEZONE } from './runtime-constants'
import { buildCookieStatus } from './runtime-cookie-status'
import { previousDayKey, sendDailyReport } from './runtime-notify'

const REPORT_JOB_NAME = '每日推送汇总'

interface DockerReportSchedulerDeps {
  getConfig: () => DockerConfig | null
  getConfigPath: () => string
  logSystem: (message: string) => void
}

function formatScheduleForLog(iso?: string): string {
  if (!iso) {
    return '-'
  }
  return iso.replace('T', ' ').replace(/\.\d+Z?$/, '').slice(0, 19)
}

/**
 * 「推送设置」的调度器：按配置里的 cron 每天推一次当日任务汇总。
 * 与业务任务调度器分开，避免影响任务锁与状态缓存。
 */
export class DockerReportScheduler {
  private job: CronJob | null = null
  private cron = ''
  private enabled = false

  constructor(private readonly deps: DockerReportSchedulerDeps) {}

  getNextRun(): string | undefined {
    return this.job?.nextDate()?.toISO() ?? undefined
  }

  reconcile(config: DockerConfig | null): void {
    const next = config?.pushReport
    const enabled = Boolean(next?.enabled)
    const cron = next?.cron || ''

    if (!enabled) {
      if (this.job) {
        this.stop()
        this.deps.logSystem(`推送汇总已停用`)
      }
      this.enabled = false
      this.cron = cron
      return
    }

    if (this.job && this.cron === cron) {
      this.enabled = true
      return
    }

    this.stop()
    this.enabled = true
    this.cron = cron

    try {
      this.job = new CronJob(cron, () => {
        // cron 回调里的 rejection 不会有人接，必须在这里兜住，避免整个进程收到未捕获异常
        void this.run().catch((error: unknown) => {
          this.deps.logSystem(`${REPORT_JOB_NAME}推送异常: ${error instanceof Error ? error.message : String(error)}`)
        })
      }, null, false, DOCKER_TIMEZONE)
      this.job.start()
      this.deps.logSystem(`${REPORT_JOB_NAME}已启动, cron: ${cron}, 下次执行: ${formatScheduleForLog(this.job.nextDate()?.toISO() ?? undefined)}`)
    } catch (error: unknown) {
      this.job = null
      this.deps.logSystem(`${REPORT_JOB_NAME}启动失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }

  async run(): Promise<void> {
    const config = this.deps.getConfig()
    this.deps.logSystem(`${REPORT_JOB_NAME}开始推送`)
    const cookieStatus = buildCookieStatus(config, this.deps.getConfigPath())
    // 定时日报统计「前一天」：默认 09:00 推送，当天任务基本还没跑，只有前一天是完整的一天
    const result = await sendDailyReport(config, cookieStatus, { dayKey: previousDayKey() })
    if (result.ok) {
      this.deps.logSystem(`${REPORT_JOB_NAME}推送完成`)
    } else {
      this.deps.logSystem(`${REPORT_JOB_NAME}推送失败: ${result.error || '未知错误'}`)
    }
  }

  stop(): void {
    if (this.job) {
      this.job.stop()
      this.job = null
    }
  }

  isEnabled(): boolean {
    return this.enabled
  }
}
