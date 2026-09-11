import type { ColumnDef } from '../../core/types/index.js'

export function filterUnitScaleOf<TRow>(def: ColumnDef<TRow> | undefined): number {
    if (def?.type !== 'percent') return 1
    return def.typeOptions?.wholePercent ? 1 : 100
}

export function toModelUnit(value: number, scale: number): number {
    return scale === 1 ? value : value / scale
}

export function toDisplayUnit(value: number, scale: number): number {
    if (scale === 1) return value
    return Number((value * scale).toPrecision(12))
}
