import type { AllocationMode, Fans, GiftAllocationConfig } from '../../core/types'
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
  roomAllocations?: Record<string, { weight?: number; count?: number }>
}

export function allocationModeToModel(mode: unknown, defaultMode: AllocationMode): AllocationTaskModel {
  const normalized = mode === 'weighted' || mode === 'fixed' ? mode : defaultMode
  return normalized === 'weighted' ? 1 : 2
}

export function modelToAllocationMode(model: AllocationTaskModel): AllocationMode {
  return model === 1 ? 'weighted' : 'fixed'
}

export function buildAllocationFanRows<TFan extends Fans, TExtra extends object = Record<string, never>>(
  fans: TFan[],
  options: BuildAllocationFanRowsOptions<TFan, TExtra>,
): Array<AllocationFanRow & TExtra> {
  return buildFanDisplayRows<TFan, { value: number } & TExtra>(fans, (fan, index) => {
    const allocation = options.roomAllocations?.[String(fan.roomId)]
    const value = allocation
      ? getAllocationValue(allocation, options.model)
      : options.defaultValue(fan, index, options.model)

    return {
      value,
      ...(options.extra?.(fan, index, options.model) || {} as TExtra),
    }
  })
}

export function buildAllocationConfig(rows: AllocationFanRow[], model: AllocationTaskModel): GiftAllocationConfig {
  if (model === 2) {
    return {
      allocationMode: 'fixed',
      roomAllocations: Object.fromEntries(rows.map(row => [String(row.roomId), { count: Number(row.value || 0) }])),
    }
  }
  return {
    allocationMode: 'weighted',
    roomAllocations: Object.fromEntries(rows.map(row => [String(row.roomId), { weight: Number(row.value || 0) }])),
  }
}

export function buildParticipatingRoomIds(rows: Array<AllocationFanRow & { enabled?: boolean }>): number[] {
  return rows.filter(row => row.enabled).map(row => row.roomId)
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

function getAllocationValue(allocation: { weight?: number; count?: number }, model: AllocationTaskModel): number {
  return model === 2 ? Number(allocation.count || 0) : Number(allocation.weight || 0)
}
