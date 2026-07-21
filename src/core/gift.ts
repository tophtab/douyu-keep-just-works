import { DEFAULT_GIFT_ID } from './task-defaults'
import type { FixedAllocationConfig, GiftAllocationConfig, GiftSendJobs, WeightedAllocationConfig } from './types'

function createGiftSendJobs(entries: Array<{ roomId: number; count: number }>): GiftSendJobs {
  return entries.reduce((jobs, entry) => {
    jobs[String(entry.roomId)] = { roomId: entry.roomId, giftId: DEFAULT_GIFT_ID, count: entry.count }
    return jobs
  }, {} as GiftSendJobs)
}

export function computeGiftCountOfNumber(number: number, roomAllocations: FixedAllocationConfig['roomAllocations']): GiftSendJobs {
  const allocations = Object.entries(roomAllocations)
    .map(([roomId, item]) => ({ roomId: Number(roomId), configuredCount: item.count }))
    .sort((a, b) => b.configuredCount - a.configuredCount)
  const configuredCount = allocations.reduce((sum, item) => sum + (item.configuredCount === -1 ? 0 : item.configuredCount), 0)
  if (configuredCount > number) {
    throw new Error(`荧光棒数量不足,请重新配置. 当前${number}个, 需求${configuredCount}个`)
  }

  const remainderRooms = allocations.filter(item => item.configuredCount === -1)
  if (remainderRooms.length > 1) {
    throw new Error('固定数量模式最多只能有一个房间配置为-1')
  }

  const jobs = allocations.map(item => ({
    roomId: item.roomId,
    count: item.configuredCount === -1 ? 0 : item.configuredCount,
  }))
  if (remainderRooms.length === 1) {
    const remainderJob = jobs.find(job => job.roomId === remainderRooms[0].roomId)!
    remainderJob.count = number - configuredCount
  }
  return createGiftSendJobs(jobs)
}

export function computeGiftCountOfProportion(number: number, roomAllocations: WeightedAllocationConfig['roomAllocations']): GiftSendJobs {
  const allocations = Object.entries(roomAllocations)
    .map(([roomId, item]) => ({ roomId: Number(roomId), weight: item.weight, count: 0 }))
    .sort((a, b) => a.weight - b.weight)
  const totalWeight = allocations.reduce((sum, item) => sum + item.weight, 0)
  if (totalWeight <= 0) {
    throw new Error('按权重模式至少需要一个房间填写大于 0 的权重值')
  }

  for (let index = 0; index < allocations.length; index += 1) {
    const item = allocations[index]
    if (index === allocations.length - 1) {
      const count = number - allocations.reduce((sum, entry) => sum + entry.count, 0)
      if (count < 0) {
        throw new Error(`荧光棒数量不足,请重新配置. 当前${number}个, 需求至少${allocations.filter(entry => entry.weight > 0).length}个`)
      }
      item.count = count
    } else if (item.weight > 0) {
      const count = Math.floor((item.weight / totalWeight) * number)
      item.count = count === 0 ? 1 : count
    }
  }

  const assignedCount = allocations.reduce((sum, item) => sum + item.count, 0)
  if (assignedCount > number) {
    throw new Error(`荧光棒数量不足,请重新配置. 当前${number}个, 需求${assignedCount}个`)
  }
  return createGiftSendJobs(allocations)
}

function selectActiveAllocations(config: GiftAllocationConfig, activeRoomIds: Set<string>): GiftAllocationConfig {
  if (config.allocationMode === 'fixed') {
    return {
      allocationMode: 'fixed',
      roomAllocations: Object.fromEntries(Object.entries(config.roomAllocations).filter(([roomId]) => activeRoomIds.has(roomId))),
    }
  }
  return {
    allocationMode: 'weighted',
    roomAllocations: Object.fromEntries(Object.entries(config.roomAllocations).filter(([roomId]) => activeRoomIds.has(roomId))),
  }
}

export function computeGiftCountWithDoubleCard(
  number: number,
  allocation: GiftAllocationConfig,
  doubleCardRooms: Record<string, boolean>,
): GiftSendJobs | null {
  const activeRoomIds = new Set(Object.entries(doubleCardRooms).filter(([, active]) => active).map(([roomId]) => roomId))
  const activeAllocation = selectActiveAllocations(allocation, activeRoomIds)
  const activeRoomKeys = Object.keys(activeAllocation.roomAllocations)
  if (activeRoomKeys.length === 0) {
    return null
  }
  if (activeRoomKeys.length === 1) {
    return createGiftSendJobs([{ roomId: Number(activeRoomKeys[0]), count: number }])
  }
  return activeAllocation.allocationMode === 'weighted'
    ? computeGiftCountOfProportion(number, activeAllocation.roomAllocations)
    : computeGiftCountOfNumber(number, activeAllocation.roomAllocations)
}
