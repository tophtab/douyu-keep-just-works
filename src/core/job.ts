import { GLOW_STICK_GIFT_ID, getBackpackStatus, getDid, getFansList, getGiftNumber, parseDyAndSidFromCookie, sendGift, sleep } from './api'
import { collectGiftViaDanmu } from './collect-gift'
import { checkDoubleCard } from './double-card'
import { computeGiftCountOfNumber, computeGiftCountOfProportion, computeGiftCountWithDoubleCard } from './gift'
import type { BackpackGiftRow, BackpackStatus, DoubleCardConfig, ExpiringGiftConfig, ExpiringGiftSelection, JobConfig, Logger, YubaCheckInConfig, sendArgs, sendConfig } from './types'
import { executeFollowedYubaCheckInWithDyToken, formatYubaModeLabel } from './yuba'

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

async function loadBackpackStatus(cookie: string, log: Logger, prefix?: string, candidateRoomIds: number[] = []): Promise<BackpackStatus | null> {
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

function formatShanghaiTime(value: number): string {
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

function pickCollectRoomId(roomIds: number[]): number {
  return roomIds[Math.floor(Math.random() * roomIds.length)]
}

function getEarliestPositiveGiftExpireTime(status: BackpackStatus): number | undefined {
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

async function sendGifts(jobs: sendConfig, cookie: string, log: Logger, giftLabel = '荧光棒', completionLabel = '任务'): Promise<void> {
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
      jobs = await computeGiftCountOfProportion(number, JSON.parse(JSON.stringify(send)))
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

  const roomIds = Object.values(send).map(item => item.roomId)
  const giftScope = config.giftScope === 'limitedTime' ? 'limitedTime' : 'glowStick'
  const giftGroups: Array<{ giftId: number; giftName: string; giftCount: number }> = []
  if (giftScope === 'limitedTime') {
    const status = await loadBackpackStatus(cookie, log, '正在获取背包明细和过期时间...', roomIds)
    if (!status) {
      return
    }

    const selection = selectExpiringGiftCandidates(status, {
      thresholdHours: Number.POSITIVE_INFINITY,
      includeAllExpiring: true,
    })
    log(`双倍限时礼物筛选结果: 总背包礼物行 ${selection.totalRows}，限时候选行 ${selection.candidates.length}，无过期时间跳过 ${selection.skippedNoExpireTime}`)

    if (!selection.candidates.length || selection.budgetCount <= 0) {
      log('当前没有可用于双倍任务的限时礼物，跳过本次赠送')
      return
    }

    for (const [giftIdText, giftCount] of Object.entries(selection.giftCounts)) {
      giftGroups.push({
        giftId: Number(giftIdText),
        giftName: selection.giftNames[giftIdText] || '未知礼物',
        giftCount,
      })
    }
  } else {
    const number = await loadGiftNumber(cookie, log, '正在获取当前荧光棒数量...', roomIds)
    if (number === 0) {
      return
    }
    giftGroups.push({
      giftId: GLOW_STICK_GIFT_ID,
      giftName: '荧光棒',
      giftCount: number,
    })
  }

  await sleep(2000)

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

  if (!Object.values(doubleCardRooms).some(Boolean)) {
    log('双倍状态检测完成，未检测到可执行的双倍房间，本次不执行赠送')
    return
  }

  log('双倍状态检测完成，检测到可执行房间，开始执行双倍赠送')
  for (const group of giftGroups) {
    const giftLabel = giftScope === 'glowStick' && group.giftId === GLOW_STICK_GIFT_ID
      ? '荧光棒'
      : `${group.giftName}(ID ${group.giftId})`
    let jobs: sendConfig | null = null
    try {
      jobs = await computeGiftCountWithDoubleCard(group.giftCount, activeSend, doubleCardRooms, model)
    } catch (error: unknown) {
      log(`计算${giftLabel}双倍赠送数量失败: ${errorMessage(error)}`)
      continue
    }

    if (jobs === null) {
      continue
    }

    for (const item of Object.values(jobs)) {
      item.giftId = group.giftId
    }

    const targetCount = Object.values(jobs).filter(item => (item.count || 0) > 0).length
    log(`准备使用双倍卡向 ${targetCount} 个房间赠送 ${group.giftCount} 个${giftLabel}`)
    await sendGifts(jobs, cookie, log, giftLabel, `${giftLabel}双倍赠送`)
  }
}

export async function executeExpiringGiftJob(config: ExpiringGiftConfig, cookie: string, log: Logger): Promise<void> {
  log('开始执行临期任务')
  if (!Object.keys(config.send || {}).length) {
    log('临期任务未配置赠送房间，跳过本次任务')
    return
  }

  const roomIds = Object.values(config.send).map(item => item.roomId)
  const status = await loadBackpackStatus(cookie, log, '正在获取背包明细和过期时间...', roomIds)
  if (!status) {
    return
  }

  const thresholdHours = typeof config.thresholdHours === 'number' && Number.isFinite(config.thresholdHours) && config.thresholdHours > 0
    ? config.thresholdHours
    : 24
  const selection = selectExpiringGiftCandidates(status, {
    thresholdHours,
  })

  log(`临期筛选结果: 总背包礼物行 ${selection.totalRows}，临期候选行 ${selection.candidates.length}，未临期跳过 ${selection.skippedNotExpiring}，无过期时间跳过 ${selection.skippedNoExpireTime}`)

  if (!selection.candidates.length || selection.budgetCount <= 0) {
    const earliestExpireTime = getEarliestPositiveGiftExpireTime(status)
    if (earliestExpireTime) {
      const remainingMs = earliestExpireTime - Date.now()
      const remainingHours = Math.max(0, remainingMs / (60 * 60 * 1000))
      log(`最早可见礼物过期时间: ${formatShanghaiTime(earliestExpireTime)}，距离过期约 ${remainingHours.toFixed(1)} 小时，阈值 ${thresholdHours} 小时`)
    } else if (status.totalRows === 0) {
      log('当前背包没有可释放的礼物库存')
    }
    log('当前没有进入临期阈值的可释放礼物，跳过本次赠送')
    return
  }

  for (const row of selection.candidates) {
    const expireTime = row.expireTime
    if (!expireTime) {
      continue
    }
    const remainingMs = expireTime - Date.now()
    const remainingHours = Math.max(0, remainingMs / (60 * 60 * 1000))
    log(`临期候选: ${row.name || '未知礼物'}(ID ${row.giftId}) ${row.count} 个，过期时间 ${formatShanghaiTime(expireTime)}，距离过期约 ${remainingHours.toFixed(1)} 小时`)
  }
  if (selection.earliestExpireTime) {
    log(`临期候选最早过期时间: ${formatShanghaiTime(selection.earliestExpireTime)}，本次可赠送预算 ${selection.budgetCount} 个`)
  }
  log('当前送礼接口不指定背包批次；本次只按临期候选数量赠送，实际扣减顺序由斗鱼决定')

  await sleep(2000)

  const { model, send } = config
  const giftEntries = Object.entries(selection.giftCounts)
  for (const [giftIdText, giftCount] of giftEntries) {
    const giftId = Number(giftIdText)
    const giftName = selection.giftNames[giftIdText] || '未知礼物'
    const giftLabel = `${giftName}(ID ${giftId})`
    let jobs: sendConfig = {}
    try {
      if (model === 1) {
        jobs = await computeGiftCountOfProportion(giftCount, JSON.parse(JSON.stringify(send)))
      } else {
        jobs = await computeGiftCountOfNumber(giftCount, JSON.parse(JSON.stringify(send)))
      }
    } catch (error: unknown) {
      log(`计算${giftLabel}临期赠送数量失败: ${errorMessage(error)}`)
      continue
    }

    for (const item of Object.values(jobs)) {
      item.giftId = giftId
    }

    const targetCount = Object.values(jobs).filter(item => (item.count || 0) > 0).length
    log(`已达到临期阈值，准备向 ${targetCount} 个房间释放 ${giftCount} 个临期${giftLabel}`)
    await sendGifts(jobs, cookie, log, giftLabel, `${giftLabel}临期赠送`)
  }
}

export async function executeYubaCheckInJob(config: YubaCheckInConfig, yubaCookie: string, mainCookie: string, log: Logger): Promise<void> {
  const mode = config.mode || 'followed'
  log(`开始执行鱼吧签到任务，模式: ${formatYubaModeLabel(mode)}`)

  if (mode !== 'followed') {
    throw new Error(`暂不支持的鱼吧签到模式: ${mode}`)
  }

  await executeFollowedYubaCheckInWithDyToken(yubaCookie, mainCookie, log)
}
