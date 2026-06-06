import type { BackpackGiftRow, BackpackStatus, DoubleCardConfig, ExpiringGiftSelection, sendConfig } from './types'

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

export function getEarliestPositiveGiftExpireTime(status: BackpackStatus): number | undefined {
  const expireTimes = status.rows
    .filter(row => Number.isFinite(row.count) && row.count > 0 && row.expireTime)
    .map(row => row.expireTime!)

  return expireTimes.length ? Math.min(...expireTimes) : undefined
}

export function selectExpiringGiftCandidates(status: BackpackStatus, options: {
  thresholdHours: number
  includeAllExpiring?: boolean
  now?: number
}): ExpiringGiftSelection {
  const now = options.now ?? Date.now()
  const thresholdMs = options.thresholdHours * 60 * 60 * 1000
  const candidates: BackpackGiftRow[] = []
  let skippedNotExpiring = 0
  let skippedNoExpireTime = 0

  for (const row of status.rows) {
    if (!Number.isFinite(row.count) || row.count <= 0) {
      continue
    }

    if (!row.expireTime) {
      skippedNoExpireTime += 1
      continue
    }

    if (!options.includeAllExpiring && row.expireTime - now > thresholdMs) {
      skippedNotExpiring += 1
      continue
    }

    candidates.push(row)
  }

  const giftCounts: Record<string, number> = {}
  const giftNames: Record<string, string> = {}
  let budgetCount = 0
  const expireTimes: number[] = []
  for (const row of candidates) {
    budgetCount += row.count
    giftCounts[String(row.giftId)] = (giftCounts[String(row.giftId)] || 0) + row.count
    giftNames[String(row.giftId)] ||= row.name || '未知礼物'
    if (row.expireTime) {
      expireTimes.push(row.expireTime)
    }
  }

  return {
    candidates,
    totalRows: status.totalRows,
    skippedNotExpiring,
    skippedNoExpireTime,
    skippedUnsafe: 0,
    budgetCount,
    earliestExpireTime: expireTimes.length ? Math.min(...expireTimes) : undefined,
    giftCounts,
    giftNames,
  }
}
