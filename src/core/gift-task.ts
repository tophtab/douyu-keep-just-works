import type { BackpackGiftRow, BackpackStatus, DoubleCardConfig, ExpiringGiftSelection, GiftAllocationConfig, GiftSendJobs } from './types'

export interface GiftSendGroup {
  giftCount: number
  giftId: number
  giftName: string
}

export function buildParticipatingAllocation(config: DoubleCardConfig): GiftAllocationConfig {
  const participatingRoomIds = new Set(config.participatingRoomIds.map(String))
  if (config.allocationMode === 'fixed') {
    return {
      allocationMode: 'fixed',
      roomAllocations: Object.fromEntries(Object.entries(config.roomAllocations).filter(([roomId]) => participatingRoomIds.has(roomId))),
    }
  }
  return {
    allocationMode: 'weighted',
    roomAllocations: Object.fromEntries(Object.entries(config.roomAllocations).filter(([roomId]) => participatingRoomIds.has(roomId))),
  }
}

export function buildGiftSendGroups(selection: Pick<ExpiringGiftSelection, 'giftCounts' | 'giftNames'>): GiftSendGroup[] {
  return Object.entries(selection.giftCounts).map(([giftIdText, giftCount]) => ({
    giftId: Number(giftIdText),
    giftName: selection.giftNames[giftIdText] || '未知礼物',
    giftCount,
  }))
}

export function applyGiftIdToSendJobs(jobs: GiftSendJobs, giftId: number): GiftSendJobs {
  for (const item of Object.values(jobs)) {
    item.giftId = giftId
  }
  return jobs
}

export function countPositiveGiftTargets(jobs: GiftSendJobs): number {
  return Object.values(jobs).filter(item => item.count > 0).length
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
