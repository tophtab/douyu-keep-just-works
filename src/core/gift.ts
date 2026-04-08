import type { sendConfig } from './types'

export async function computeGiftCountOfNumber(number: number, send: sendConfig): Promise<sendConfig> {
  const cfgCountNumber = Object.values(send).reduce((a, b) => a + (b.number === -1 ? 0 : b.number), 0)
  if (cfgCountNumber > number) {
    return Promise.reject(new Error(`荧光棒数量不足,请重新配置. 当前${number}个, 需求${cfgCountNumber}个`))
  }
  const sendSort = Object.values(send).sort((a, b) => b.number - a.number)
  for (let i = 0; i < sendSort.length; i++) {
    const item = sendSort[i]
    if (i === sendSort.length - 1) {
      const count = number - sendSort.reduce((a, b) => a + (b.count || 0), 0)
      item.count = count
    } else {
      item.count = item.number
    }
  }
  return sendSort.reduce((a, b) => ({ ...a, [b.roomId]: b }), {} as sendConfig)
}

export async function computeGiftCountOfPercentage(number: number, send: sendConfig): Promise<sendConfig> {
  const sendSort = Object.values(send).sort((a, b) => a.percentage - b.percentage)
  for (let i = 0; i < sendSort.length; i++) {
    const item = sendSort[i]
    if (i === sendSort.length - 1) {
      const count = number - sendSort.reduce((a, b) => a + (b.count || 0), 0)
      item.count = count
    } else {
      if (item.percentage === 0) {
        item.count = 0
        continue
      }
      const count = Math.floor((item.percentage / 100) * number)
      item.count = count === 0 ? 1 : count
    }
  }
  const newSend = sendSort.reduce((a, b) => ({ ...a, [b.roomId]: b }), {} as sendConfig)
  const cfgCountNumber = Object.values(newSend).reduce((a, b) => a + (b.number <= -1 ? 1 : b.number), 0)
  if (cfgCountNumber > number) {
    return Promise.reject(new Error(`荧光棒数量不足,请重新配置. 当前${number}个, 需求${cfgCountNumber}个`))
  }
  return newSend
}

export async function computeGiftCountWithDoubleCard(
  number: number,
  send: sendConfig,
  doubleCardRooms: Record<string, boolean>,
  baseModel: 1 | 2,
): Promise<sendConfig | null> {
  const rooms = Object.values(send)
  const doubleRooms = rooms.filter(r => doubleCardRooms[String(r.roomId)])

  // 0个双倍 → 不送，攒着
  if (doubleRooms.length === 0) {
    return null
  }

  // 恰好1个双倍 → 全部送给这个房间
  if (doubleRooms.length === 1) {
    const room = { ...doubleRooms[0], count: number }
    return { [room.roomId]: room } as sendConfig
  }

  // 2个及以上双倍（含全部双倍）→ 按原比例在双倍房间之间重新分配
  const doubleSend: sendConfig = {}
  if (baseModel === 1) {
    const totalPct = doubleRooms.reduce((sum, r) => sum + r.percentage, 0)
    for (const r of doubleRooms) {
      doubleSend[r.roomId] = {
        ...r,
        percentage: Math.round((r.percentage / totalPct) * 100),
      }
    }
    return computeGiftCountOfPercentage(number, JSON.parse(JSON.stringify(doubleSend)))
  } else {
    for (const r of doubleRooms) {
      doubleSend[r.roomId] = { ...r }
    }
    return computeGiftCountOfNumber(number, JSON.parse(JSON.stringify(doubleSend)))
  }
}
