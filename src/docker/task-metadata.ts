import type { DockerConfig } from '../core/types'

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

export function getTaskLabel(type: TaskType): string {
  return TASK_LABELS[type]
}

export function formatTaskList(types: TaskType[]): string {
  return types.map(getTaskLabel).join('、')
}
