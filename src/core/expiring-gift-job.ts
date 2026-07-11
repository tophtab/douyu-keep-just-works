import { sleep } from './api'
import { errorMessage } from './errors'
import { computeGiftCountOfNumber, computeGiftCountOfProportion } from './gift'
import { applyGiftIdToSendJobs, buildGiftSendGroups, countPositiveGiftTargets, getEarliestPositiveGiftExpireTime, selectExpiringGiftCandidates } from './gift-task'
import { createRoomDidResolver, formatShanghaiTime, loadBackpackStatus, sendGifts } from './job-gift-utils'
import type { ExpiringGiftConfig, Logger, sendConfig } from './types'

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
  const resolveDid = createRoomDidResolver(cookie)
  for (const group of buildGiftSendGroups(selection)) {
    const giftLabel = `${group.giftName}(ID ${group.giftId})`
    let jobs: sendConfig = {}
    try {
      if (model === 1) {
        jobs = computeGiftCountOfProportion(group.giftCount, send)
      } else {
        jobs = computeGiftCountOfNumber(group.giftCount, send)
      }
    } catch (error: unknown) {
      log(`计算${giftLabel}临期赠送数量失败: ${errorMessage(error)}`)
      continue
    }

    applyGiftIdToSendJobs(jobs, group.giftId)

    const targetCount = countPositiveGiftTargets(jobs)
    log(`已达到临期阈值，准备向 ${targetCount} 个房间释放 ${group.giftCount} 个临期${giftLabel}`)
    await sendGifts(jobs, cookie, log, giftLabel, `${giftLabel}临期赠送`, { resolveDid })
  }
}
