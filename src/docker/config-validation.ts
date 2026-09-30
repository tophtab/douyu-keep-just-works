import type { CookieCloudConfig, DoubleCardConfig, ExpiringGiftConfig, JobConfig, YubaCheckInConfig } from '../core/types'
import { validateCronExpression } from './cron'

type UnknownRecord = Record<string, unknown>

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : undefined
}

export function validateCronConfig(name: string, config: { cron?: unknown; enabled?: unknown }): string | null {
  if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
    return `${name} 启用状态无效`
  }
  return validateCronExpression(name, typeof config.cron === 'string' ? config.cron : '')
}

export function validateJobConfig(name: string, input: JobConfig | unknown): string | null {
  const config = asRecord(input)
  if (!config) {
    return `${name} 配置无效`
  }
  const cronError = validateCronConfig(name, config)
  if (cronError) {
    return cronError
  }

  const allocationMode = config.allocationMode
  if (allocationMode !== 'weighted' && allocationMode !== 'fixed') {
    return `${name} 分配模式无效`
  }

  const allocations = asRecord(config.roomAllocations)
  if (!allocations) {
    return `${name} 房间配置无效`
  }

  if (allocationMode === 'weighted') {
    for (const [key, rawItem] of Object.entries(allocations)) {
      const item = asRecord(rawItem)
      if (!item) {
        return `${name} 房间 ${key} 的配置无效`
      }
      if (item.count !== undefined) {
        return `${name} 房间 ${key} 的固定数量字段不适用于按权重模式`
      }
      if (!Number.isFinite(item.weight) || Number(item.weight) < 0) {
        return `${name} 房间 ${key} 的权重值无效`
      }
    }
    return null
  }

  const remainderRooms: string[] = []
  for (const [key, rawItem] of Object.entries(allocations)) {
    const item = asRecord(rawItem)
    if (!item) {
      return `${name} 房间 ${key} 的配置无效`
    }
    if (item.weight !== undefined) {
      return `${name} 房间 ${key} 的权重字段不适用于固定数量模式`
    }
    const value = item.count
    if (!Number.isInteger(value) || Number(value) < -1) {
      return `${name} 房间 ${key} 的数量无效`
    }
    if (value === -1) {
      remainderRooms.push(key)
    }
  }

  return remainderRooms.length > 1
    ? `${name} 固定数量模式最多只能有一个房间配置为-1`
    : null
}

export function validateDoubleCardConfig(input: DoubleCardConfig | unknown): string | null {
  const config = asRecord(input)
  if (!config) {
    return 'doubleCard 配置无效'
  }
  const error = validateJobConfig('doubleCard', config)
  if (error) {
    return error
  }
  if (config.participatingRoomIds !== undefined && !Array.isArray(config.participatingRoomIds)) {
    return 'doubleCard 勾选配置无效'
  }
  if (Array.isArray(config.participatingRoomIds) && config.participatingRoomIds.some(roomId => !Number.isInteger(Number(roomId)))) {
    return 'doubleCard 勾选配置无效'
  }
  if (config.giftScope !== undefined && config.giftScope !== 'glowStick' && config.giftScope !== 'limitedTime') {
    return 'doubleCard 礼物范围无效'
  }

  const allocationSource = asRecord(config.roomAllocations)!
  const participatingRoomIds = Array.isArray(config.participatingRoomIds)
    ? config.participatingRoomIds.map(String)
    : []
  if (config.allocationMode === 'weighted' && participatingRoomIds.length > 0) {
    const totalWeight = participatingRoomIds.reduce((sum, roomId) => {
      const item = asRecord(allocationSource[roomId])
      return sum + (typeof item?.weight === 'number' ? item.weight : 0)
    }, 0)
    if (totalWeight <= 0) {
      return 'doubleCard 按权重模式至少需要一个已勾选房间填写大于 0 的权重值'
    }
  }
  return null
}

export function validateExpiringGiftConfig(input: ExpiringGiftConfig | unknown): string | null {
  const error = validateJobConfig('expiringGift', input)
  if (error) {
    return error
  }
  const config = asRecord(input)!
  if (config.thresholdHours !== undefined && (!Number.isFinite(config.thresholdHours) || Number(config.thresholdHours) <= 0)) {
    return 'expiringGift 临期阈值无效'
  }
  return null
}

export function validateYubaCheckInConfig(input: YubaCheckInConfig | unknown): string | null {
  const config = asRecord(input)
  if (!config) {
    return 'yubaCheckIn 配置无效'
  }
  const cronError = validateCronConfig('yubaCheckIn', config)
  if (cronError) {
    return cronError
  }
  return config.mode !== undefined && config.mode !== 'followed'
    ? 'yubaCheckIn 模式无效'
    : null
}

export function validateCookieCloudConfig(input: CookieCloudConfig | unknown): string | null {
  const config = asRecord(input)
  if (!config) {
    return 'CookieCloud 配置无效'
  }
  if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
    return 'CookieCloud 启用状态无效'
  }
  if (config.cryptoType !== undefined && config.cryptoType !== 'legacy') {
    return 'CookieCloud 加密算法无效'
  }
  if (config.cron !== undefined) {
    const cronError = validateCronConfig('cookieCloud', { cron: config.cron })
    if (cronError) {
      return cronError
    }
  }
  if (config.enabled) {
    if (!String(config.endpoint || '').trim()) {
      return 'CookieCloud 服务器地址不能为空'
    }
    if (!String(config.uuid || '').trim()) {
      return 'CookieCloud UUID 不能为空'
    }
    if (!String(config.password || '').trim()) {
      return 'CookieCloud 密码不能为空'
    }
  }
  return null
}
