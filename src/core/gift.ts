import type { sendConfig } from './types'

function cloneSendItem<T extends sendConfig[keyof sendConfig]>(item: T): T {
  return { ...item }
}

function toSendConfig(items: sendConfig[keyof sendConfig][]): sendConfig {
  return items.reduce((acc, item) => {
    acc[item.roomId] = item
    return acc
  }, {} as sendConfig)
}

export function computeGiftCountOfNumber(number: number, send: sendConfig): sendConfig {
  const sendSort = Object.values(send).map(cloneSendItem).sort((a, b) => b.number - a.number)
  const cfgCountNumber = sendSort.reduce((a, b) => a + (b.number === -1 ? 0 : b.number), 0)
  if (cfgCountNumber > number) {
    throw new Error(`荧光棒数量不足,请重新配置. 当前${number}个, 需求${cfgCountNumber}个`)
  }

  const remainderRooms = sendSort.filter(item => item.number === -1)
  if (remainderRooms.length > 1) {
    throw new Error('固定数量模式最多只能有一个房间配置为-1')
  }

  let assignedCount = 0
  for (const item of sendSort) {
    if (item.number === -1) {
      item.count = 0
    } else {
      item.count = item.number
      assignedCount += item.number
    }
  }

  if (remainderRooms.length === 1) {
    remainderRooms[0].count = number - assignedCount
  }

  return toSendConfig(sendSort)
}

export function computeGiftCountOfProportion(number: number, send: sendConfig): sendConfig {
  const sendSort = Object.values(send).map(cloneSendItem).sort((a, b) => a.weight - b.weight)
  const totalWeight = sendSort.reduce((sum, item) => sum + item.weight, 0)

  if (totalWeight <= 0) {
    throw new Error('按权重模式至少需要一个房间填写大于 0 的权重值')
  }

  for (let i = 0; i < sendSort.length; i++) {
    const item = sendSort[i]
    if (i === sendSort.length - 1) {
      const count = number - sendSort.reduce((sum, entry) => sum + (entry.count || 0), 0)
      if (count < 0) {
        throw new Error(`荧光棒数量不足,请重新配置. 当前${number}个, 需求至少${sendSort.filter(entry => entry.weight > 0).length}个`)
      }
      item.count = count
    } else {
      if (item.weight === 0) {
        item.count = 0
        continue
      }
      const count = Math.floor((item.weight / totalWeight) * number)
      item.count = count === 0 ? 1 : count
    }
  }

  const newSend = toSendConfig(sendSort)
  const cfgCountNumber = Object.values(newSend).reduce((a, b) => a + (b.count || 0), 0)
  if (cfgCountNumber > number) {
    throw new Error(`荧光棒数量不足,请重新配置. 当前${number}个, 需求${cfgCountNumber}个`)
  }
  return newSend
}

export function computeGiftCountWithDoubleCard(
  number: number,
  send: sendConfig,
  doubleCardRooms: Record<string, boolean>,
  baseModel: 1 | 2,
): sendConfig | null {
  const rooms = Object.values(send)
  const doubleRooms = rooms.filter(r => doubleCardRooms[String(r.roomId)])

  // 0个双倍 → 不送，攒着
  if (doubleRooms.length === 0) {
    return null
  }

  // 恰好1个双倍 → 全部送给这个房间
  if (doubleRooms.length === 1) {
    const room = { ...doubleRooms[0], count: number }
    return { [room.roomId]: room }
  }

  // 2个及以上双倍（含全部双倍）→ 按原比例在双倍房间之间重新分配
  const doubleSend: sendConfig = {}
  for (const room of doubleRooms) {
    doubleSend[room.roomId] = { ...room }
  }

  return baseModel === 1
    ? computeGiftCountOfProportion(number, doubleSend)
    : computeGiftCountOfNumber(number, doubleSend)
}
