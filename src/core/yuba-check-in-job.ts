import type { Logger, YubaCheckInConfig } from './types'
import { executeFollowedYubaCheckInWithDyToken, formatYubaModeLabel } from './yuba'

export async function executeYubaCheckInJob(config: YubaCheckInConfig, yubaCookie: string, mainCookie: string, log: Logger): Promise<void> {
  const mode = config.mode || 'followed'
  log(`开始执行鱼吧签到任务，模式: ${formatYubaModeLabel(mode)}`)

  if (mode !== 'followed') {
    throw new Error(`暂不支持的鱼吧签到模式: ${mode}`)
  }

  await executeFollowedYubaCheckInWithDyToken(yubaCookie, mainCookie, log)
}
