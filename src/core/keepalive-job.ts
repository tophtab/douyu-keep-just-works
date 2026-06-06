import { sleep } from './api'
import { errorMessage } from './errors'
import { computeGiftCountOfNumber, computeGiftCountOfProportion } from './gift'
import { loadGiftNumber, sendGifts } from './job-gift-utils'
import type { JobConfig, Logger, sendConfig } from './types'

export async function executeKeepaliveJob(config: JobConfig, cookie: string, log: Logger): Promise<void> {
  log('开始执行保活任务')
  const roomIds = Object.values(config.send).map(item => item.roomId)
  const number = await loadGiftNumber(cookie, log, '正在获取当前荧光棒数量...', roomIds)
  if (number === null) {
    throw new Error('保活任务获取荧光棒数量失败')
  }
  if (number === 0) {
    return
  }
  await sleep(2000)

  const { model, send } = config
  let jobs: sendConfig = {}
  try {
    if (model === 1) {
      jobs = computeGiftCountOfProportion(number, send)
    } else {
      jobs = computeGiftCountOfNumber(number, send)
    }
  } catch (error: unknown) {
    log(`计算赠送数量失败: ${errorMessage(error)}`)
    return
  }

  await sendGifts(jobs, cookie, log)
}
