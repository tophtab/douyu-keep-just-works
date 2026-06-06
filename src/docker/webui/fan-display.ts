import type { Fans } from '../../core/types'
import { formatOptionalNumber } from './task-shared'

export interface FanDisplayRow {
  index: number
  intimacy: string
  level: number | string
  name: string
  rank: number | string
  roomId: number
  today: number | string
}

export function buildFanDisplayRows<TFan extends Fans, TExtra extends object = Record<string, never>>(
  fans: TFan[],
  extra?: (fan: TFan, index: number) => TExtra,
): Array<FanDisplayRow & TExtra> {
  return fans.map((fan, index) => ({
    index: index + 1,
    intimacy: fan.intimacy || '-',
    level: formatOptionalNumber(fan.level),
    name: fan.name || '未知主播',
    rank: formatOptionalNumber(fan.rank),
    roomId: fan.roomId,
    today: formatOptionalNumber(fan.today),
    ...(extra?.(fan, index) || {} as TExtra),
  }))
}
