import { CronJob } from 'cron'
import { DEFAULT_COOKIE_CLOUD_SYNC_CRON } from '../core/task-defaults'
import type { DockerConfig } from '../core/types'
import { jsonEquals } from './config-equality'
import { DOCKER_TIMEZONE } from './runtime-constants'
import { formatScheduleForLog } from './runtime-time'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

interface CookieCloudSyncDeps {
  hasCookieCloudSource: (config?: DockerConfig | null) => boolean
  logSystem: (message: string) => void
  persistEffectiveCookies: (forceRefresh?: boolean) => Promise<{ updated: boolean }>
}

export class DockerCookieCloudSyncService {
  private job: CronJob | null = null

  private running = false

  constructor(private readonly deps: CookieCloudSyncDeps) {}

  stop(): void {
    if (this.job) {
      this.job.stop()
      this.job = null
    }
  }

  async syncSnapshot(reason: 'startup' | 'scheduled'): Promise<void> {
    if (!this.deps.hasCookieCloudSource()) {
      return
    }
    if (this.running) {
      if (reason === 'scheduled') {
        this.deps.logSystem('CookieCloud 每日同步仍在执行中，跳过本次触发')
      }
      return
    }

    this.running = true
    try {
      const result = await this.deps.persistEffectiveCookies(true)
      if (result.updated) {
        this.deps.logSystem(reason === 'startup'
          ? 'CookieCloud 启动同步完成，本地登录快照已更新'
          : 'CookieCloud 每日同步完成，本地登录快照已更新')
      } else if (reason === 'scheduled') {
        this.deps.logSystem('CookieCloud 每日同步完成，本地登录快照无需更新')
      }
    } catch (error) {
      this.deps.logSystem(`${reason === 'startup' ? 'CookieCloud 启动同步' : 'CookieCloud 每日同步'}失败: ${errorMessage(error)}`)
    } finally {
      this.running = false
    }
  }

  reconcile(prevConfig: DockerConfig | null, nextConfig: DockerConfig): void {
    const nextShouldRun = this.deps.hasCookieCloudSource(nextConfig)
    const wasRunning = Boolean(this.job)
    const configChanged = !jsonEquals(prevConfig?.cookieCloud || null, nextConfig.cookieCloud || null)

    if (!nextShouldRun) {
      if (wasRunning) {
        this.stop()
      }
      return
    }

    if (!wasRunning || configChanged) {
      this.start(nextConfig)
    }
  }

  private start(config: DockerConfig): void {
    this.stop()

    if (!this.deps.hasCookieCloudSource(config)) {
      return
    }

    const cron = config.cookieCloud?.cron || DEFAULT_COOKIE_CLOUD_SYNC_CRON
    const job = new CronJob(cron, () => {
      void this.syncSnapshot('scheduled')
    }, null, false, DOCKER_TIMEZONE)
    this.job = job
    job.start()

    this.deps.logSystem(`CookieCloud 每日同步已启动, cron: ${cron}, 下次执行: ${formatScheduleForLog(job.nextDate().toISO())}`)
    void this.syncSnapshot('startup')
  }
}
