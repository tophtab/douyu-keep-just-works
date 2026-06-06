import { GLOW_STICK_GIFT_ID, sleep } from './api'
import { checkDoubleCard } from './double-card'
import { errorMessage } from './errors'
import { computeGiftCountWithDoubleCard } from './gift'
import { applyGiftIdToSendJobs, buildEnabledSendConfig, buildGiftSendGroups, countPositiveGiftTargets, hasActiveDoubleCardRoom, selectExpiringGiftCandidates } from './gift-task'
import { loadBackpackStatus, loadGiftNumber, sendGifts } from './job-gift-utils'
import type { DoubleCardConfig, Logger, sendConfig } from './types'

export async function executeDoubleCardJob(config: DoubleCardConfig, cookie: string, log: Logger): Promise<void> {
  log('开始执行双倍任务')
  const { model, send, enabled } = config
  const activeSend = buildEnabledSendConfig({ enabled, send })

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

    giftGroups.push(...buildGiftSendGroups(selection))
  } else {
    const number = await loadGiftNumber(cookie, log, '正在获取当前荧光棒数量...', roomIds)
    if (number === null) {
      throw new Error('双倍任务获取荧光棒数量失败')
    }
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
    try {
      const doubleInfo = await checkDoubleCard(item.roomId, cookie)
      doubleCardRooms[String(item.roomId)] = doubleInfo.active
      if (doubleInfo.active) {
        log(`房间${item.roomId}检测到双倍亲密度卡生效`)
      } else {
        log(`房间${item.roomId}未检测到双倍亲密度卡`)
      }
    } catch (error: unknown) {
      log(`房间${item.roomId}双倍状态检测失败，跳过该房间: ${errorMessage(error)}`)
    }
  }

  if (!hasActiveDoubleCardRoom(doubleCardRooms)) {
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
      jobs = computeGiftCountWithDoubleCard(group.giftCount, activeSend, doubleCardRooms, model)
    } catch (error: unknown) {
      log(`计算${giftLabel}双倍赠送数量失败: ${errorMessage(error)}`)
      continue
    }

    if (jobs === null) {
      continue
    }

    applyGiftIdToSendJobs(jobs, group.giftId)

    const targetCount = countPositiveGiftTargets(jobs)
    log(`准备使用双倍卡向 ${targetCount} 个房间赠送 ${group.giftCount} 个${giftLabel}`)
    await sendGifts(jobs, cookie, log, giftLabel, `${giftLabel}双倍赠送`)
  }
}
