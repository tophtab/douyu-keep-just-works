import type { Fans, SendGift } from '../../core/types'
import { formatOptionalNumber } from './task-shared'

export type AllocationTaskModel = 1 | 2

export interface AllocationFanRow {
  index: number
  intimacy: string
  level: number | string
  name: string
  rank: number | string
  roomId: number
  today: number | string
  value: number
}

interface AllocationConfig {
  model?: unknown
  send?: Record<string, SendGift>
}

interface BuildAllocationFanRowsOptions<TFan extends Fans, TExtra extends object> {
  defaultValue: (fan: TFan, index: number, model: AllocationTaskModel) => number
  extra?: (fan: TFan, index: number, model: AllocationTaskModel) => TExtra
  model: AllocationTaskModel
  send?: Record<string, SendGift>
}

export function normalizeAllocationModel(model: unknown, defaultModel: AllocationTaskModel): AllocationTaskModel {
  const parsed = Number(model)
  return parsed === 1 || parsed === 2 ? parsed : defaultModel
}

export function getAllocationModel(config: AllocationConfig, defaultModel: AllocationTaskModel): AllocationTaskModel {
  return normalizeAllocationModel(config.model, defaultModel)
}

export function buildAllocationFanRows<TFan extends Fans, TExtra extends object = Record<string, never>>(
  fans: TFan[],
  options: BuildAllocationFanRowsOptions<TFan, TExtra>,
): Array<AllocationFanRow & TExtra> {
  return fans.map((fan, index) => {
    const key = String(fan.roomId)
    const sendItem = options.send?.[key]
    const value = sendItem
      ? getSendValue(sendItem, options.model)
      : options.defaultValue(fan, index, options.model)

    return {
      index: index + 1,
      intimacy: fan.intimacy || '-',
      level: formatOptionalNumber(fan.level),
      name: fan.name || '未知主播',
      rank: formatOptionalNumber(fan.rank),
      roomId: fan.roomId,
      today: formatOptionalNumber(fan.today),
      value,
      ...(options.extra?.(fan, index, options.model) || {} as TExtra),
    }
  })
}

export function buildAllocationSendMap(rows: AllocationFanRow[], model: AllocationTaskModel): Record<string, SendGift> {
  const send: Record<string, SendGift> = {}
  for (const row of rows) {
    const value = Number(row.value || 0)
    send[String(row.roomId)] = {
      roomId: row.roomId,
      giftId: 268,
      number: model === 2 ? value : 0,
      weight: model === 1 ? value : 0,
      count: 0,
    }
  }
  return send
}

export function buildEnabledRoomMap(rows: Array<AllocationFanRow & { enabled?: boolean }>): Record<string, boolean> {
  const enabled: Record<string, boolean> = {}
  for (const row of rows) {
    enabled[String(row.roomId)] = Boolean(row.enabled)
  }
  return enabled
}

export function formatRatioPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${rounded.toFixed(1).replace(/\.0$/, '')}%`
}

function getSendValue(sendItem: SendGift, model: AllocationTaskModel): number {
  return model === 2 ? Number(sendItem.number || 0) : Number(sendItem.weight || 0)
}
