import type { CookieCloudConfig, DoubleCardConfig, ExpiringGiftConfig, JobConfig, YubaCheckInConfig } from '../core/types'
import { validateCronExpression } from './cron'

export function validateCronConfig(name: string, config: { cron?: string; active?: unknown }): string | null {
  if (config.active !== undefined && typeof config.active !== 'boolean') {
    return `${name} 启用状态无效`
  }
  return validateCronExpression(name, config.cron || '')
}

export function validateJobConfig(name: string, config: JobConfig): string | null {
  const cronError = validateCronConfig(name, config)
  if (cronError) {
    return cronError
  }
  if (config.model !== 1 && config.model !== 2) {
    return `${name} 分配模式无效`
  }
  if (!config.send || typeof config.send !== 'object') {
    return `${name} 房间配置无效`
  }

  if (config.model === 1) {
    for (const [key, item] of Object.entries(config.send)) {
      if (!Number.isFinite(item.weight) || item.weight < 0) {
        return `${name} 房间 ${key} 的权重值无效`
      }
    }
  } else {
    const remainderRooms = Object.entries(config.send)
      .filter(([, item]) => item.number === -1)
      .map(([key]) => key)

    for (const [key, item] of Object.entries(config.send)) {
      if (!Number.isFinite(item.number) || item.number < -1) {
        return `${name} 房间 ${key} 的数量无效`
      }
    }

    if (remainderRooms.length > 1) {
      return `${name} 固定数量模式最多只能有一个房间配置为-1`
    }
  }

  return null
}

export function validateDoubleCardConfig(config: DoubleCardConfig): string | null {
  const error = validateJobConfig('doubleCard', config)
  if (error) {
    return error
  }
  if (config.enabled !== undefined && (typeof config.enabled !== 'object' || Array.isArray(config.enabled))) {
    return 'doubleCard 勾选配置无效'
  }
  if (config.giftScope !== undefined && config.giftScope !== 'glowStick' && config.giftScope !== 'limitedTime') {
    return 'doubleCard 礼物范围无效'
  }

  const enabledKeys = Object.entries(config.enabled || {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key)
  if (config.model === 1 && enabledKeys.length > 0) {
    const totalWeight = enabledKeys.reduce((sum, key) => sum + (config.send?.[key]?.weight || 0), 0)
    if (totalWeight <= 0) {
      return 'doubleCard 按权重模式至少需要一个已勾选房间填写大于 0 的权重值'
    }
  }

  return null
}

export function validateExpiringGiftConfig(config: ExpiringGiftConfig): string | null {
  const error = validateJobConfig('expiringGift', config)
  if (error) {
    return error
  }
  if (
    config.thresholdHours !== undefined
    && (!Number.isFinite(config.thresholdHours) || config.thresholdHours <= 0)
  ) {
    return 'expiringGift 临期阈值无效'
  }
  return null
}

export function validateYubaCheckInConfig(config: YubaCheckInConfig): string | null {
  const cronError = validateCronConfig('yubaCheckIn', config)
  if (cronError) {
    return cronError
  }
  if (config.mode !== undefined && config.mode !== 'followed') {
    return 'yubaCheckIn 模式无效'
  }
  return null
}

export function validateCookieCloudConfig(config: CookieCloudConfig): string | null {
  if (config.active !== undefined && typeof config.active !== 'boolean') {
    return 'CookieCloud 启用状态无效'
  }
  if (config.cryptoType !== undefined && config.cryptoType !== 'legacy') {
    return 'CookieCloud 加密算法无效'
  }
  if (config.cron !== undefined) {
    const cronError = validateCronConfig('cookieCloud', {
      cron: config.cron,
    })
    if (cronError) {
      return cronError
    }
  }
  if (config.active === true) {
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
