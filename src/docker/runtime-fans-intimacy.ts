import type { Fans, TaskRunIntimacy } from '../core/types'
import { getFansList } from '../core/api'

/**
 * 亲密度快照：送礼任务开始前 / 结束后各读一次粉丝牌列表，差值就是这次任务带来的亲密度增量。
 *
 * 为什么不用「当前亲密度」单指标：斗鱼在升级那一刻会把当前值清零（例如 65500/65500 → 0/70000），
 * 直接相减会得到负数。所以同时记 `today`（今日累计增量，每天 0 点重置）与当前值，
 * 取增量时优先用 `today`，它在一次任务内的变化只会来自本次送礼。
 */
export interface IntimacySnapshot {
  [roomId: string]: {
    name: string
    level: number
    current: number
    threshold: number
    today: number
  }
}

/** 把 "64080.2/65500" 拆成当前值和门槛 */
function parseIntimacy(raw: string): { current: number, threshold: number } {
  const [left, right] = String(raw || '').split('/')
  const current = Number.parseFloat(String(left).trim())
  const threshold = Number.parseFloat(String(right ?? '').trim())
  return {
    current: Number.isFinite(current) ? current : 0,
    threshold: Number.isFinite(threshold) ? threshold : 0,
  }
}

/**
 * 读取粉丝牌列表并转成快照。失败返回 null —— 亲密度只是附加信息，
 * 读不到不能影响任务本身。
 */
export async function snapshotIntimacy(cookie: string): Promise<IntimacySnapshot | null> {
  try {
    const fans: Fans[] = await getFansList(cookie)
    const snapshot: IntimacySnapshot = {}
    for (const fan of fans) {
      const { current, threshold } = parseIntimacy(fan.intimacy)
      snapshot[String(fan.roomId)] = {
        name: fan.name,
        level: fan.level,
        current,
        threshold,
        today: Number(fan.today) || 0,
      }
    }
    return snapshot
  } catch {
    return null
  }
}

/**
 * 对比前后快照，算出每个房间的亲密度增量。
 * 只返回确实有变化的房间（新增房间也算，delta 以当前值为准）。
 */
export function diffIntimacy(before: IntimacySnapshot | null, after: IntimacySnapshot | null): TaskRunIntimacy[] {
  if (!before || !after) {
    return []
  }
  const result: TaskRunIntimacy[] = []
  for (const [roomId, next] of Object.entries(after)) {
    const prev = before[roomId]
    if (!prev) {
      continue
    }
    const deltaToday = next.today - prev.today
    const deltaCurrent = next.current - prev.current
    // 跨 0 点或升级清零时 today 会跳变，取能站得住的那个
    const delta = deltaToday > 0 ? deltaToday : (deltaCurrent > 0 ? deltaCurrent : 0)
    const levelUp = next.level > prev.level
    if (delta <= 0 && !levelUp) {
      continue
    }
    result.push({
      roomId,
      name: next.name,
      level: next.level,
      current: next.current,
      threshold: next.threshold,
      delta: Math.round(delta * 10) / 10,
      levelUp,
    })
  }
  return result
}
