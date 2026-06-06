import type { Fans, SendGift } from '../../core/types'
import { DEFAULT_GIFT_ID } from '../../core/task-defaults'
import type { FanDisplayRow } from './fan-display'
import { buildFanDisplayRows } from './fan-display'

export type AllocationTaskModel = 1 | 2

export interface AllocationFanRow extends FanDisplayRow {
  value: number
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

export function buildAllocationFanRows<TFan extends Fans, TExtra extends object = Record<string, never>>(
  fans: TFan[],
  options: BuildAllocationFanRowsOptions<TFan, TExtra>,
): Array<AllocationFanRow & TExtra> {
  return buildFanDisplayRows<TFan, { value: number } & TExtra>(fans, (fan, index) => {
    const key = String(fan.roomId)
    const sendItem = options.send?.[key]
    const value = sendItem
      ? getSendValue(sendItem, options.model)
      : options.defaultValue(fan, index, options.model)

    return {
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
      giftId: DEFAULT_GIFT_ID,
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

export function updateAllocationRowEnabled<T extends { enabled?: boolean }>(row: T, value: boolean): void {
  row.enabled = value
}

export function updateAllocationRowValue<T extends { value: number }>(row: T, value: number): void {
  row.value = value
}

export function formatRatioPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10
  return `${rounded.toFixed(1).replace(/\.0$/, '')}%`
}

function getSendValue(sendItem: SendGift, model: AllocationTaskModel): number {
  return model === 2 ? Number(sendItem.number || 0) : Number(sendItem.weight || 0)
}
