import type { DockerConfig } from '../core/types'

export type TaskType = 'collectGift' | 'keepalive' | 'doubleCard' | 'expiringGift' | 'yubaCheckIn'

export const TASK_TYPES: TaskType[] = ['collectGift', 'keepalive', 'doubleCard', 'expiringGift', 'yubaCheckIn']

export function getTaskConfig(config: DockerConfig | null | undefined, type: TaskType): DockerConfig[TaskType] {
  switch (type) {
    case 'collectGift':
      return config?.collectGift
    case 'keepalive':
      return config?.keepalive
    case 'doubleCard':
      return config?.doubleCard
    case 'expiringGift':
      return config?.expiringGift
    case 'yubaCheckIn':
      return config?.yubaCheckIn
  }
}

export function getTaskLabel(type: TaskType): string {
  switch (type) {
    case 'collectGift':
      return '领取任务'
    case 'keepalive':
      return '保活任务'
    case 'doubleCard':
      return '双倍卡任务'
    case 'expiringGift':
      return '临期任务'
    case 'yubaCheckIn':
      return '鱼吧签到任务'
  }
}

export function formatTaskList(types: TaskType[]): string {
  return types.map(getTaskLabel).join('、')
}
