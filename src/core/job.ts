import { getDid, getFansList, getGiftNumber, parseDyAndSidFromCookie, sendGift, sleep } from './api'
import { collectGiftViaDanmu } from './collect-gift'
import { checkDoubleCard } from './double-card'
import { computeGiftCountOfNumber, computeGiftCountOfPercentage, computeGiftCountWithDoubleCard } from './gift'
import type { DoubleCardConfig, JobConfig, Logger, YubaCheckInConfig, sendArgs, sendConfig } from './types'
import { executeFollowedYubaCheckIn, formatYubaModeLabel } from './yuba'

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function loadGiftNumber(cookie: string, log: Logger, prefix?: string, candidateRoomIds: number[] = []): Promise<number> {
  if (prefix) {
    log(prefix)
  }

  let number = 0
  try {
    number = await getGiftNumber(cookie, candidateRoomIds)
  } catch (error) {
    log(`获取荧光棒数量失败: ${error}`)
    return 0
  }
  if (number === 0) {
    log('荧光棒数量为0, 结束任务')
  } else {
    log(`荧光棒数量为${number}`)
  }
  return number
}

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

  return await loadGiftNumber(cookie, log, '领取完成，正在查询当前荧光棒数量...', roomIds)
}

async function sendGifts(jobs: sendConfig, cookie: string, log: Logger): Promise<void> {
  let args: sendArgs
  try {
    args = parseDyAndSidFromCookie(cookie)
  } catch (error: unknown) {
    log(`获取参数失败: ${errorMessage(error)}`)
    return
  }

  let failedNumber = 0
  for (const item of Object.values(jobs)) {
    try {
      if (item.count === 0) {
        continue
      }

      item.count = (item.count ?? 0) + failedNumber

      log(`即将赠送${item.roomId}房间${item.count}个荧光棒`)
      const did = await getDid(item.roomId.toString(), cookie)
      args.did = did
      await sendGift(args, item, cookie)
      failedNumber = 0
      log(`赠送${item.roomId}房间${item.count}个荧光棒成功`)
    } catch (error) {
      failedNumber += item?.count ?? 0
      log(`${item.roomId}房间赠送失败: ${error}, ${item.count}个荧光棒自动移交给下一个房间`)
    }
    await sleep(2000)
  }

  if (failedNumber > 0) {
    log(`任务执行完毕, 有${failedNumber}个荧光棒未赠送成功`)
  } else {
    log('任务执行完毕')
  }
}

export async function executeKeepaliveJob(config: JobConfig, cookie: string, log: Logger): Promise<void> {
  log('开始执行保活任务')
  const roomIds = Object.values(config.send).map(item => item.roomId)
  const number = await loadGiftNumber(cookie, log, '正在获取当前荧光棒数量...', roomIds)
  if (number === 0) {
    return
  }
  await sleep(2000)

  const { model, send } = config
  let jobs: sendConfig = {}
  try {
    if (model === 1) {
      jobs = await computeGiftCountOfPercentage(number, JSON.parse(JSON.stringify(send)))
    } else {
      jobs = await computeGiftCountOfNumber(number, JSON.parse(JSON.stringify(send)))
    }
  } catch (error: unknown) {
    log(`计算赠送数量失败: ${errorMessage(error)}`)
    return
  }

  await sendGifts(jobs, cookie, log)
}

export async function executeDoubleCardJob(config: DoubleCardConfig, cookie: string, log: Logger): Promise<void> {
  log('开始执行双倍任务')
  const roomIds = Object.values(config.send).map(item => item.roomId)
  const number = await loadGiftNumber(cookie, log, '正在获取当前荧光棒数量...', roomIds)
  if (number === 0) {
    return
  }
  await sleep(2000)

  const { model, send, enabled } = config
  const activeSend = Object.values(send).reduce((prev, item) => {
    const roomKey = String(item.roomId)
    if (enabled && !enabled[roomKey]) {
      return prev
    }
    prev[roomKey] = item
    return prev
  }, {} as sendConfig)

  if (Object.keys(activeSend).length === 0) {
    log('未勾选任何双倍卡房间，跳过本次任务')
    return
  }

  log(`开始检测双倍状态，待检测房间数: ${Object.keys(activeSend).length}`)
  const doubleCardRooms: Record<string, boolean> = {}
  for (const item of Object.values(activeSend)) {
    const doubleInfo = await checkDoubleCard(item.roomId, cookie)
    doubleCardRooms[String(item.roomId)] = doubleInfo.active
    if (doubleInfo.active) {
      log(`房间${item.roomId}检测到双倍亲密度卡生效`)
    } else {
      log(`房间${item.roomId}未检测到双倍亲密度卡`)
    }
  }

  let jobs: sendConfig | null = null
  try {
    jobs = await computeGiftCountWithDoubleCard(number, activeSend, doubleCardRooms, model)
  } catch (error: unknown) {
    log(`计算赠送数量失败: ${errorMessage(error)}`)
    return
  }

  if (jobs === null) {
    log('双倍状态检测完成，未检测到可执行的双倍房间，本次不执行赠送')
    return
  }

  log('双倍状态检测完成，检测到可执行房间，开始执行双倍赠送')
  await sendGifts(jobs, cookie, log)
}

export async function executeYubaCheckInJob(config: YubaCheckInConfig, cookie: string, log: Logger): Promise<void> {
  const mode = config.mode || 'followed'
  log(`开始执行鱼吧签到任务，模式: ${formatYubaModeLabel(mode)}`)

  if (mode !== 'followed') {
    throw new Error(`暂不支持的鱼吧签到模式: ${mode}`)
  }

  await executeFollowedYubaCheckIn(cookie, log)
}
