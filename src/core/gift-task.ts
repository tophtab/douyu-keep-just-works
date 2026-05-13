import type { DoubleCardConfig, ExpiringGiftSelection, sendConfig } from './types'

export interface GiftSendGroup {
  giftCount: number
  giftId: number
  giftName: string
}

export function buildEnabledSendConfig(config: Pick<DoubleCardConfig, 'enabled' | 'send'>): sendConfig {
  return Object.values(config.send).reduce((prev, item) => {
    const roomKey = String(item.roomId)
    if (config.enabled && !config.enabled[roomKey]) {
      return prev
    }
    prev[roomKey] = item
    return prev
  }, {} as sendConfig)
}

export function buildGiftSendGroups(selection: Pick<ExpiringGiftSelection, 'giftCounts' | 'giftNames'>): GiftSendGroup[] {
  return Object.entries(selection.giftCounts).map(([giftIdText, giftCount]) => {
    const giftId = Number(giftIdText)
    return {
      giftId,
      giftName: selection.giftNames[giftIdText] || '未知礼物',
      giftCount,
    }
  })
}

export function applyGiftIdToSendJobs(jobs: sendConfig, giftId: number): sendConfig {
  for (const item of Object.values(jobs)) {
    item.giftId = giftId
  }
  return jobs
}

export function countPositiveGiftTargets(jobs: sendConfig): number {
  return Object.values(jobs).filter(item => (item.count || 0) > 0).length
}

export function hasActiveDoubleCardRoom(doubleCardRooms: Record<string, boolean>): boolean {
  return Object.values(doubleCardRooms).some(Boolean)
}
