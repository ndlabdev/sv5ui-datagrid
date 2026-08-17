import type { ColumnDef } from '../../core/types/index.js'

/**
 * A column whose renderer changes the unit has to change it back before what
 * the user typed reaches a predicate. `percent` is the only one that does: it
 * holds a ratio and draws a percentage.
 *
 * The scaling lives at the panel, so what is stored, persisted and sent to a
 * server stays in the row's own units.
 */
export function filterUnitScaleOf<TRow>(def: ColumnDef<TRow> | undefined): number {
    if (def?.type !== 'percent') return 1
    // `wholePercent` already holds what it draws.
    return def.typeOptions?.wholePercent ? 1 : 100
}

export function toModelUnit(value: number, scale: number): number {
    return scale === 1 ? value : value / scale
}

/** Rounded: `0.05 * 100` is `5.000000000000001`, and a panel must not say so. */
export function toDisplayUnit(value: number, scale: number): number {
    if (scale === 1) return value
    return Number((value * scale).toPrecision(12))
}
