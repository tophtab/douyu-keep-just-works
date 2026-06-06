import type { DockerConfig, DoubleCardConfig, ExpiringGiftConfig, JobConfig, YubaCheckInConfig } from '../core/types'
import { DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS, DEFAULT_YUBA_CHECK_IN_MODE } from '../core/task-defaults'
import { validateCronConfig, validateDoubleCardConfig, validateExpiringGiftConfig, validateJobConfig, validateYubaCheckInConfig } from './config-validation'

export type TaskType = 'collectGift' | 'keepalive' | 'doubleCard' | 'expiringGift' | 'yubaCheckIn'

export type TaskStatusCacheScope = 'fans' | 'yuba'
export type TaskConfigMap = Partial<Pick<DockerConfig, TaskType>>
export type TaskConfigUpdateMap = Partial<Record<TaskType, DockerConfig[TaskType] | null | undefined>>

export interface TaskDefinition {
  type: TaskType
  label: string
  logCategory: string
  notConfiguredMessage: string
  statusCacheScope: TaskStatusCacheScope
  configChangeScope?: TaskStatusCacheScope
  requiresFansSync: boolean
  requiresSendRooms: boolean
  getConfig: (config: DockerConfig | null | undefined) => DockerConfig[TaskType]
  validate: (config: NonNullable<DockerConfig[TaskType]>) => string | null
  getRoomCount?: (config: DockerConfig[TaskType]) => number
  getScheduleSummary: (config: DockerConfig[TaskType]) => string | undefined
}

function countSendRooms(config: JobConfig | DoubleCardConfig | ExpiringGiftConfig | null | undefined): number {
  return Object.keys(config?.send || {}).length
}

export const TASK_DEFINITIONS: TaskDefinition[] = [
  {
    type: 'collectGift',
    label: '领取任务',
    logCategory: '领取',
    notConfiguredMessage: '领取任务未配置',
    statusCacheScope: 'fans',
    requiresFansSync: false,
    requiresSendRooms: false,
    getConfig: config => config?.collectGift,
    validate: config => validateCronConfig('collectGift', config),
    getScheduleSummary: () => undefined,
  },
  {
    type: 'keepalive',
    label: '保活任务',
    logCategory: '保活',
    notConfiguredMessage: '保活任务未配置',
    statusCacheScope: 'fans',
    configChangeScope: 'fans',
    requiresFansSync: true,
    requiresSendRooms: false,
    getConfig: config => config?.keepalive,
    validate: config => validateJobConfig('keepalive', config as JobConfig),
    getRoomCount: config => countSendRooms(config as JobConfig),
    getScheduleSummary: config => `房间数: ${countSendRooms(config as JobConfig)}`,
  },
  {
    type: 'doubleCard',
    label: '双倍任务',
    logCategory: '双倍',
    notConfiguredMessage: '双倍任务未配置',
    statusCacheScope: 'fans',
    configChangeScope: 'fans',
    requiresFansSync: true,
    requiresSendRooms: false,
    getConfig: config => config?.doubleCard,
    validate: config => validateDoubleCardConfig(config as DoubleCardConfig),
    getRoomCount: config => countSendRooms(config as DoubleCardConfig),
    getScheduleSummary: config => `房间数: ${countSendRooms(config as DoubleCardConfig)}`,
  },
  {
    type: 'expiringGift',
    label: '临期任务',
    logCategory: '临期',
    notConfiguredMessage: '临期任务未配置',
    statusCacheScope: 'fans',
    configChangeScope: 'fans',
    requiresFansSync: true,
    requiresSendRooms: true,
    getConfig: config => config?.expiringGift,
    validate: config => validateExpiringGiftConfig(config as ExpiringGiftConfig),
    getRoomCount: config => countSendRooms(config as ExpiringGiftConfig),
    getScheduleSummary: (config) => {
      const expiringConfig = config as ExpiringGiftConfig
      return `阈值: ${expiringConfig.thresholdHours || DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS}小时, 房间数: ${countSendRooms(expiringConfig)}`
    },
  },
  {
    type: 'yubaCheckIn',
    label: '鱼吧签到任务',
    logCategory: '鱼吧',
    notConfiguredMessage: '鱼吧签到任务未配置',
    statusCacheScope: 'yuba',
    configChangeScope: 'yuba',
    requiresFansSync: false,
    requiresSendRooms: false,
    getConfig: config => config?.yubaCheckIn,
    validate: config => validateYubaCheckInConfig(config as YubaCheckInConfig),
    getScheduleSummary: config => `模式: ${(config as YubaCheckInConfig).mode || DEFAULT_YUBA_CHECK_IN_MODE}`,
  },
]

export const TASK_TYPES: TaskType[] = TASK_DEFINITIONS.map(definition => definition.type)

export const TASK_LABELS: Record<TaskType, string> = createTaskRecord(type => getTaskDefinition(type).label)

export const TASK_LOG_CATEGORIES: Record<TaskType, string> = createTaskRecord(type => getTaskDefinition(type).logCategory)

export const TASK_NOT_CONFIGURED_MESSAGES: Record<TaskType, string> = createTaskRecord(type => getTaskDefinition(type).notConfiguredMessage)

export function getTaskDefinition(type: TaskType): TaskDefinition {
  return TASK_DEFINITIONS.find(definition => definition.type === type)!
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
  return getTaskDefinition(type).getConfig(config)
}

export function getTriggerableTaskConfig(
  config: DockerConfig | null | undefined,
  type: TaskType,
  hasSendRooms: (config: JobConfig | DoubleCardConfig | ExpiringGiftConfig | null | undefined) => boolean,
): DockerConfig[TaskType] | null | undefined {
  const taskConfig = getTaskConfig(config, type)
  if (
    getTaskDefinition(type).requiresSendRooms
    && !hasSendRooms(taskConfig as JobConfig | DoubleCardConfig | ExpiringGiftConfig | null | undefined)
  ) {
    return null
  }
  return taskConfig
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

export function hasActiveTaskConfig(config: DockerConfig | null | undefined): boolean {
  return TASK_TYPES.some(type => isTaskActive(getTaskConfig(config, type)))
}

export function getTaskScheduleSummary(type: TaskType, config: DockerConfig[TaskType]): string | undefined {
  return getTaskDefinition(type).getScheduleSummary(config)
}

export function formatTaskList(types: TaskType[]): string {
  return types.map(getTaskLabel).join('、')
}

export function validateTaskConfig(type: TaskType, config: NonNullable<DockerConfig[TaskType]>): string | null {
  return getTaskDefinition(type).validate(config)
}

export function hasTaskUpdatePayload(config: TaskConfigUpdateMap): boolean {
  return TASK_TYPES.some(type => config[type] !== undefined)
}

export function needsFansSyncForTaskUpdate(config: TaskConfigUpdateMap): boolean {
  return TASK_DEFINITIONS.some(definition => definition.requiresFansSync && config[definition.type] !== undefined)
}

export function getTaskConfigChangeScope(type: TaskType): TaskStatusCacheScope | undefined {
  return getTaskDefinition(type).configChangeScope
}

export function getTaskStatusCacheScope(type: TaskType): TaskStatusCacheScope {
  return getTaskDefinition(type).statusCacheScope
}

export function getTaskRoomCount(type: TaskType, config: DockerConfig[TaskType]): number | undefined {
  return getTaskDefinition(type).getRoomCount?.(config)
}

export function assignTaskConfig(target: TaskConfigMap, type: TaskType, value: DockerConfig[TaskType]): void {
  switch (type) {
    case 'collectGift':
      target.collectGift = value as DockerConfig['collectGift']
      return
    case 'keepalive':
      target.keepalive = value as DockerConfig['keepalive']
      return
    case 'doubleCard':
      target.doubleCard = value as DockerConfig['doubleCard']
      return
    case 'expiringGift':
      target.expiringGift = value as DockerConfig['expiringGift']
      return
    case 'yubaCheckIn':
      target.yubaCheckIn = value as DockerConfig['yubaCheckIn']
  }
}

export function getTaskOverviewSummary(config: DockerConfig | null): Record<string, boolean | number> {
  return TASK_DEFINITIONS.reduce((summary, definition) => {
    const taskConfig = getTaskConfig(config, definition.type)
    summary[`${definition.type}Configured`] = isTaskActive(taskConfig)
    const roomCount = getTaskRoomCount(definition.type, taskConfig)
    if (roomCount !== undefined) {
      summary[`${definition.type}Rooms`] = roomCount
    }
    return summary
  }, {} as Record<string, boolean | number>)
}

export function collectTaskConfigUpdates(current: DockerConfig | null, updates: TaskConfigUpdateMap): TaskConfigMap {
  return TASK_TYPES.reduce((taskUpdates: TaskConfigMap, type) => {
    const nextValue = updates[type]
    if (nextValue !== undefined) {
      if (nextValue) {
        assignTaskConfig(taskUpdates, type, nextValue)
      }
      return taskUpdates
    }

    const currentValue = getTaskConfig(current, type)
    if (currentValue) {
      assignTaskConfig(taskUpdates, type, currentValue)
    }
    return taskUpdates
  }, {} as Partial<DockerConfig>)
}

export function collectTaskUpdatePayload(updates: TaskConfigUpdateMap): TaskConfigMap {
  return TASK_TYPES.reduce((taskUpdates: TaskConfigMap, type) => {
    const nextValue = updates[type]
    if (nextValue) {
      assignTaskConfig(taskUpdates, type, nextValue)
    }
    return taskUpdates
  }, {})
}
