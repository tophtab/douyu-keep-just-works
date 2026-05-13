import type { DockerConfig, DoubleCardConfig, ExpiringGiftConfig, JobConfig, YubaCheckInConfig } from '../core/types'
import { DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS, DEFAULT_YUBA_CHECK_IN_MODE } from '../core/task-defaults'

export type TaskType = 'collectGift' | 'keepalive' | 'doubleCard' | 'expiringGift' | 'yubaCheckIn'

export const TASK_TYPES: TaskType[] = ['collectGift', 'keepalive', 'doubleCard', 'expiringGift', 'yubaCheckIn']

export const TASK_LABELS: Record<TaskType, string> = {
  collectGift: '领取任务',
  keepalive: '保活任务',
  doubleCard: '双倍卡任务',
  expiringGift: '临期任务',
  yubaCheckIn: '鱼吧签到任务',
}

export const TASK_LOG_CATEGORIES: Record<TaskType, string> = {
  collectGift: '领取',
  keepalive: '保活',
  doubleCard: '双倍',
  expiringGift: '临期',
  yubaCheckIn: '鱼吧',
}

export const TASK_NOT_CONFIGURED_MESSAGES: Record<TaskType, string> = {
  collectGift: '领取任务未配置',
  keepalive: '保活任务未配置',
  doubleCard: '双倍卡任务未配置',
  expiringGift: '临期任务未配置',
  yubaCheckIn: '鱼吧签到任务未配置',
}

export function createTaskRecord<T>(createValue: (type: TaskType) => T): Record<TaskType, T> {
  return TASK_TYPES.reduce((record, type) => {
    record[type] = createValue(type)
    return record
  }, {} as Record<TaskType, T>)
}

export function isTaskType(value: string): value is TaskType {
  return (TASK_TYPES as string[]).includes(value)
}

export function getTaskConfig(config: DockerConfig | null | undefined, type: TaskType): DockerConfig[TaskType] {
  return config?.[type]
}

export function getTaskCron(config: DockerConfig[TaskType]): string | undefined {
  return config?.cron
}

export function getTaskLabel(type: TaskType): string {
  return TASK_LABELS[type]
}

export function getTaskNotConfiguredMessage(type: TaskType): string {
  return TASK_NOT_CONFIGURED_MESSAGES[type]
}

export function isTaskActive(config: { active?: boolean } | null | undefined): boolean {
  return Boolean(config && config.active !== false)
}

export function getTaskScheduleSummary(type: TaskType, config: DockerConfig[TaskType]): string | undefined {
  switch (type) {
    case 'collectGift':
      return undefined
    case 'keepalive':
      return `房间数: ${Object.keys((config as JobConfig).send).length}`
    case 'doubleCard':
      return `房间数: ${Object.keys((config as DoubleCardConfig).send).length}`
    case 'expiringGift': {
      const expiringConfig = config as ExpiringGiftConfig
      return `阈值: ${expiringConfig.thresholdHours || DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS}小时, 房间数: ${Object.keys(expiringConfig.send).length}`
    }
    case 'yubaCheckIn':
      return `模式: ${(config as YubaCheckInConfig).mode || DEFAULT_YUBA_CHECK_IN_MODE}`
  }
}

export function formatTaskList(types: TaskType[]): string {
  return types.map(getTaskLabel).join('、')
}
