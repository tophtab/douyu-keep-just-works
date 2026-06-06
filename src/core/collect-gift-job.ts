import { getFansList } from './api'
import { collectGiftViaDanmu } from './collect-gift'
import { errorMessage } from './errors'
import { loadGiftNumber } from './job-gift-utils'
import type { Logger } from './types'

function pickCollectRoomId(roomIds: number[]): number {
  return roomIds[Math.floor(Math.random() * roomIds.length)]
}

export async function executeCollectGiftJob(cookie: string, log: Logger): Promise<number> {
  log('开始执行领取任务')
  let roomIds: number[]
  try {
    const fans = await getFansList(cookie)
    roomIds = Array.from(new Set(fans.map(fan => fan.roomId).filter(roomId => Number.isInteger(roomId) && roomId > 0)))
  } catch (error: unknown) {
    throw new Error(`领取荧光棒失败: 获取粉丝牌房间失败，${errorMessage(error)}`)
  }

  if (roomIds.length === 0) {
    throw new Error('领取荧光棒失败: 未找到可用于领取的粉丝牌房间')
  }

  const collectRoomId = pickCollectRoomId(roomIds)
  log(`正在领取荧光棒，随机进入粉丝牌房间${collectRoomId}...`)
  await collectGiftViaDanmu(cookie, collectRoomId)

  const number = await loadGiftNumber(cookie, log, '领取完成，正在查询当前荧光棒数量...', roomIds)
  if (number === null) {
    throw new Error('领取完成，但查询当前荧光棒数量失败')
  }
  return number
}
