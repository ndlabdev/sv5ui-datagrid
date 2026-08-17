import type { ColumnDef } from '../../core/types/index.js'

/**
 * A column whose renderer changes the unit has to change it back before what
 * the user typed reaches a predicate.
 *
 * `percent` is the only built-in renderer that does: it holds a ratio and
 * draws a percentage, so the cell reading `5%` holds `0.05`, and a number
 * filter of `5` compiled against the row found nothing and said nothing about
 * why. Every other type draws the number it holds.
 *
 * The scaling lives at the panel, not in the model: what is stored, persisted
 * in a snapshot and sent to a server stays in the row's own units, so a filter
 * written by an older version still means what it meant.
 */
export function filterUnitScaleOf<TRow>(def: ColumnDef<TRow> | undefined): number {
    if (def?.type !== 'percent') return 1
    // `wholePercent` already holds what it draws.
    return def.typeOptions?.wholePercent ? 1 : 100
}

/** What the user typed, in the units the row holds. */
export function toModelUnit(value: number, scale: number): number {
    return scale === 1 ? value : value / scale
}

/**
 * What the row holds, in the units the user typed.
 *
 * Rounded before it is shown: `0.05 * 100` is `5.000000000000001` in binary
 * floating point, and reopening a panel to that is the kind of detail that
 * makes a user distrust the number they entered.
 */
export function toDisplayUnit(value: number, scale: number): number {
    if (scale === 1) return value
    return Number((value * scale).toPrecision(12))
}
