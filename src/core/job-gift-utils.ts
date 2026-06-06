import { getBackpackStatus, getDid, getGiftNumber, parseDyAndSidFromCookie, sendGift, sleep } from './api'
import { errorMessage } from './errors'
import type { BackpackStatus, Logger, sendArgs, sendConfig } from './types'

export async function loadGiftNumber(cookie: string, log: Logger, prefix?: string, candidateRoomIds: number[] = []): Promise<number | null> {
  if (prefix) {
    log(prefix)
  }

  let number = 0
  try {
    number = await getGiftNumber(cookie, candidateRoomIds)
  } catch (error) {
    log(`获取荧光棒数量失败: ${errorMessage(error)}`)
    return null
  }
  if (number === 0) {
    log('荧光棒数量为0, 结束任务')
  } else {
    log(`荧光棒数量为${number}`)
  }
  return number
}

export async function loadBackpackStatus(cookie: string, log: Logger, prefix?: string, candidateRoomIds: number[] = []): Promise<BackpackStatus | null> {
  if (prefix) {
    log(prefix)
  }

  try {
    const status = await getBackpackStatus(cookie, candidateRoomIds)
    log(`背包可见礼物行数: ${status.totalRows}，荧光棒数量: ${status.glowStickCount}`)
    return status
  } catch (error) {
    log(`获取背包明细失败: ${errorMessage(error)}`)
    return null
  }
}

export function formatShanghaiTime(value: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value)).replace(/\//g, '-')
}

export async function sendGifts(jobs: sendConfig, cookie: string, log: Logger, giftLabel = '荧光棒', completionLabel = '任务'): Promise<void> {
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

      log(`即将赠送${item.roomId}房间${item.count}个${giftLabel}`)
      const did = await getDid(item.roomId.toString(), cookie)
      args.did = did
      await sendGift(args, item, cookie)
      failedNumber = 0
      log(`赠送${item.roomId}房间${item.count}个${giftLabel}成功`)
    } catch (error) {
      failedNumber += item?.count ?? 0
      log(`${item.roomId}房间赠送失败: ${error}, ${item.count}个${giftLabel}自动移交给下一个房间`)
    }
    await sleep(2000)
  }

  if (failedNumber > 0) {
    log(`${completionLabel}执行完毕, 有${failedNumber}个${giftLabel}未赠送成功`)
  } else {
    log(`${completionLabel}执行完毕`)
  }
}
