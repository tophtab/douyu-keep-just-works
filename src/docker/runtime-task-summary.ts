import type { TaskRunRecord } from '../core/types'

/**
 * 单次任务卡片里「关键数据」的来源。
 *
 * 之前的做法是把日志尾部 10 行整块贴进卡片，一次临期任务就有 11 条 bullet，
 * 手机上要滑两屏才看到结论。这里改成从日志里抽取结构化字段，
 * 只把「送了多少、送给谁、什么时候过期」这类一眼要看的信息放进表格，
 * 完整日志收进可折叠面板。
 *
 * 抽取用正则而不是改造 job 层：job 的日志文案由上游维护，改文案会跟上游冲突，
 * 而文案本身足够稳定（下面按实测输出写）。抽不到的字段直接跳过，绝不编造数值。
 */

export interface TaskSummaryRow {
  item: string
  value: string
}

export interface TaskRunSummary {
  rows: TaskSummaryRow[]
  /** 一句话结论，用于文本降级与折叠面板标题 */
  headline: string
}

interface GiftDelivery {
  roomId: string
  count: number
  gift: string
}

const RE_DELIVERED = /^赠送(\d+)房间(\d+)个(.+?)(?:成功)?$/
const RE_DELIVERING = /^即将赠送(\d+)房间(\d+)个(.+)$/
const RE_DELIVER_FAILED = /^(\d+)房间赠送失败.*,\s*(\d+)个/
const RE_EXPIRE = /过期时间\s*([\d-]{10} [\d:]{8})，距离过期约\s*([\d.]+)\s*小时/
const RE_GLOW_COUNT = /荧光棒数量为(\d+)/
const RE_YUBA_DONE = /鱼吧签到任务完成: 成功\s*(\d+)，已签到\s*(\d+)，失败\s*(\d+)/

/**
 * 「任务跑了但没事可做」的日志特征 → 展示用短语。
 * 这类情况以前统一显示「执行完成」，看不出到底是送了还是跳过了。
 */
const SKIP_PATTERNS: Array<[string, RegExp]> = [
  ['无临期礼物，跳过', /当前没有进入临期阈值的可释放礼物/],
  ['背包无库存，跳过', /当前背包没有可释放的礼物库存/],
  ['无双倍礼物，跳过', /当前没有可用于双倍任务的限时礼物/],
  ['无双倍房间，跳过', /未检测到可执行的双倍房间/],
  ['未配置房间，跳过', /未勾选任何双倍卡房间/],
  ['无关注鱼吧', /当前没有关注的鱼吧/],
  ['今日无免费荧光棒', /荧光棒数量为0/],
]

function stripGiftId(gift: string): string {
  return gift.replace(/\(ID\s*\d+\)/g, '').trim()
}

export function collectDeliveries(logs: string[]): {
  delivered: GiftDelivery[]
  failed: Array<{ roomId: string, count: number }>
} {
  const delivered: GiftDelivery[] = []
  const failed: Array<{ roomId: string, count: number }> = []

  for (const line of logs) {
    const done = RE_DELIVERED.exec(line) || RE_DELIVERING.exec(line)
    if (done) {
      const roomId = done[1]
      const count = Number(done[2])
      // 同一房间会有「即将赠送」+「赠送成功」两条，后者覆盖前者
      const existing = delivered.findIndex(item => item.roomId === roomId)
      const entry = { roomId, count, gift: stripGiftId(done[3]) }
      if (existing >= 0) {
        delivered[existing] = entry
      } else {
        delivered.push(entry)
      }
      continue
    }
    const bad = RE_DELIVER_FAILED.exec(line)
    if (bad) {
      failed.push({ roomId: bad[1], count: Number(bad[2]) })
    }
  }

  return { delivered, failed }
}

function formatExpire(logs: string[]): string | null {
  for (const line of logs) {
    const match = RE_EXPIRE.exec(line)
    if (!match) {
      continue
    }
    const [, time, hours] = match
    const hhmm = time.slice(11, 16)
    const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Shanghai' })
    const sameDay = time.slice(0, 10) === today
    return sameDay ? `今天 ${hhmm}（当时剩 ${hours}h）` : `${time.slice(5, 10)} ${hhmm}（当时剩 ${hours}h）`
  }
  return null
}

export function buildTaskRunSummary(record: TaskRunRecord): TaskRunSummary {
  const logs = record.logs ?? []
  const rows: TaskSummaryRow[] = []
  const parts: string[] = []

  const { delivered, failed } = collectDeliveries(logs)

  if (delivered.length > 0) {
    const rooms = Array.from(new Set(delivered.map(item => item.roomId)))
    const total = delivered.reduce((sum, item) => sum + item.count, 0)
    const gifts = Array.from(new Set(delivered.map(item => item.gift).filter(Boolean)))
    rows.push({ item: '房间', value: rooms.join('、') })
    if (gifts.length === 1) {
      rows.push({ item: '礼物', value: gifts[0] })
    }
    rows.push({ item: '数量', value: `${total} 个` })
    const expire = formatExpire(logs)
    if (expire) {
      rows.push({ item: '过期', value: expire })
    }
    parts.push(`赠送 ${rooms.join('、')} · ${gifts[0] ?? '礼物'} × ${total}`)
  }

  if (failed.length > 0) {
    const total = failed.reduce((sum, item) => sum + item.count, 0)
    rows.push({ item: '未送出', value: `${failed.map(item => item.roomId).join('、')} · ${total} 个` })
    parts.push(`${total} 个未能送出`)
  }

  const glow = logs.map(line => RE_GLOW_COUNT.exec(line)).find(Boolean)
  if (glow) {
    const count = Number(glow[1])
    if (count > 0) {
      rows.push({ item: '荧光棒', value: `${count} 根` })
      parts.push(`背包荧光棒 ${count} 根`)
    } else if (delivered.length === 0) {
      rows.push({ item: '荧光棒', value: '0 根（今日已领完或无免费额度）' })
      parts.push('今日无免费荧光棒')
    }
  }

  const yuba = logs.map(line => RE_YUBA_DONE.exec(line)).find(Boolean)
  if (yuba) {
    const [, ok, already, fail] = yuba
    rows.push({ item: '签到', value: `成功 ${ok} · 已签 ${already} · 失败 ${fail}` })
    parts.push(`鱼吧签到 成功 ${ok} / 已签 ${already} / 失败 ${fail}`)
  }

  if (rows.length === 0) {
    const skip = SKIP_PATTERNS.find(([, pattern]) => logs.some(line => pattern.test(line)))
    if (skip) {
      rows.push({ item: '结果', value: skip[0] })
      parts.push(skip[0])
    }
  }

  if (rows.length === 0 && record.error) {
    rows.push({ item: '原因', value: record.error.slice(0, 80) })
    parts.push(record.error.slice(0, 60))
  }

  const headline = parts.length > 0 ? parts.join(' · ') : (record.ok ? '执行完成' : '执行失败')
  return { rows, headline }
}
