import type { BackpackGiftRow } from '../../core/types'
import { DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS } from '../../core/task-defaults'

export interface BackpackDisplayRow {
  count: number
  expireText: string
  giftId: number
  inThreshold: boolean
  index: number
  intimacy: number
  name: string
  remainingText: string
}

export function normalizeExpiringThresholdHours(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_EXPIRING_GIFT_THRESHOLD_HOURS
}

function formatTimestamp(value: number | undefined): string {
  if (!value) {
    return '-'
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return '-'
  }
  try {
    const parts = new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      hourCycle: 'h23',
    }).formatToParts(date)
    const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value || '00'
    return `${getPart('month')}/${getPart('day')} ${getPart('hour')}:${getPart('minute')}`
  } catch {
    const shanghaiTime = new Date(date.getTime() + 8 * 60 * 60 * 1000)
    const pad = (part: number): string => String(part).padStart(2, '0')
    return `${pad(shanghaiTime.getUTCMonth() + 1)}/${pad(shanghaiTime.getUTCDate())} ${pad(shanghaiTime.getUTCHours())}:${pad(shanghaiTime.getUTCMinutes())}`
  }
}

function formatRemainingTime(expireTime: number | undefined): string {
  if (!expireTime) {
    return '-'
  }
  const remainingMs = expireTime - Date.now()
  const remainingHours = Math.max(0, remainingMs / (60 * 60 * 1000))
  if (remainingHours >= 48) {
    return `${(remainingHours / 24).toFixed(1).replace(/\.0$/, '')} 天`
  }
  return `${remainingHours.toFixed(1).replace(/\.0$/, '')} 小时`
}

function isBackpackRowInThreshold(row: BackpackGiftRow, thresholdHours: number): boolean {
  const count = Number(row.count || 0)
  const expireTime = Number(row.expireTime || 0)
  return count > 0 && Boolean(expireTime) && expireTime - Date.now() <= thresholdHours * 60 * 60 * 1000
}

export function buildBackpackDisplayRows(rows: BackpackGiftRow[], thresholdHours: number): BackpackDisplayRow[] {
  return rows.map((row, index) => ({
    count: Number(row.count || 0),
    expireText: formatTimestamp(row.expireTime),
    giftId: row.giftId,
    inThreshold: isBackpackRowInThreshold(row, thresholdHours),
    index: index + 1,
    intimacy: Number(row.intimacy || 0),
    name: row.name || '未知礼物',
    remainingText: formatRemainingTime(row.expireTime),
  }))
}
