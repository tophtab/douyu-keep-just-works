import cronParse from 'cron-parser'
import { CronJob } from 'cron'
import type { DockerConfig } from '../core/types'

const DOCKER_TIMEZONE = 'Asia/Shanghai'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function validateCronExpression(name: string, cron: string): string | null {
  if (!cron) {
    return `${name} 缺少 cron`
  }

  try {
    const job = new CronJob(cron, () => {}, null, false, DOCKER_TIMEZONE)
    job.stop()
    return null
  } catch (error: unknown) {
    return `${name} cron 无效: ${errorMessage(error)}`
  }
}

export function getNextCronRuns(cron: string, count = 3): string[] {
  const interval = cronParse.parseExpression(cron, { tz: DOCKER_TIMEZONE })
  const runs: string[] = []

  for (let i = 0; i < count; i += 1) {
    runs.push(interval.next().toDate().toISOString())
  }

  return runs
}

export function assertDockerConfigCrons(config: DockerConfig): void {
  const checks: Array<[string, string | undefined]> = [
    ['collectGift', config.collectGift?.cron],
    ['keepalive', config.keepalive?.cron],
    ['doubleCard', config.doubleCard?.cron],
    ['expiringGift', config.expiringGift?.cron],
    ['yubaCheckIn', config.yubaCheckIn?.cron],
  ]

  for (const [name, cron] of checks) {
    if (!cron) {
      continue
    }

    const error = validateCronExpression(name, cron)
    if (error) {
      throw new Error(error)
    }
  }
}
