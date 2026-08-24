import type {
    ColumnFilter,
    ColumnFilterEntry,
    FilterType,
    SetFilterValue
} from '../../core/types/index.js'
import { emptyCondition, isPresenceOp } from './filter-draft.js'
import { toDisplayUnit } from './filter-units.js'

/**
 * What one cell of the filter row can offer for a column.
 *
 * The row holds one condition, in the column's own operator: a field for the
 * three that are typed, a choice for a boolean, a list of ticks for a set.
 * Everything it cannot hold that way — two conditions joined, a range, an
 * operator with no value at all — reads back as a summary and is handed to
 * the panel, which is the whole of the difference between the two surfaces.
 */
export type FloatingCell =
    | { kind: 'none' }
    | { kind: 'input'; op: string; value: string; caseSensitive: boolean }
    | { kind: 'boolean'; value: '' | 'true' | 'false' }
    | { kind: 'set'; values: SetFilterValue[] }
    | { kind: 'summary' }

/** A condition the row can put in one field. */
function simple(filter: ColumnFilter, scale: number): FloatingCell | null {
    if (filter.kind === 'text') {
        return {
            kind: 'input',
            op: filter.op,
            value: filter.value,
            caseSensitive: filter.caseSensitive === true
        }
    }
    if (filter.kind === 'number') {
        if (filter.value === undefined) return null
        const shown = toDisplayUnit(filter.value, scale)
        return { kind: 'input', op: filter.op, value: String(shown), caseSensitive: false }
    }
    if (filter.kind === 'date') {
        return { kind: 'input', op: filter.op, value: filter.value ?? '', caseSensitive: false }
    }
    return null
}

/** The choice a boolean column offers, or none when it has no filter. */
function booleanCell(entry: ColumnFilterEntry | undefined): FloatingCell {
    if (entry?.kind !== 'boolean') return { kind: 'boolean', value: '' }
    return { kind: 'boolean', value: entry.value ? 'true' : 'false' }
}

/** The values a set column has ticked, and the panel for anything else. */
function setCell(entry: ColumnFilterEntry | undefined): FloatingCell {
    // One condition still, however many values are ticked. Anything else on a
    // set column was not written by this grid, so the panel keeps it.
    if (entry === undefined) return { kind: 'set', values: [] }
    return entry.kind === 'set' ? { kind: 'set', values: entry.values } : { kind: 'summary' }
}

/**
 * True for what one field cannot hold, so the panel keeps it: a range that
 * needs two bounds, and an operator with no value at all, which an empty field
 * would report as no filter. Two conditions joined is the other such case, and
 * is tested where it also narrows the type.
 */
function panelOnly(filter: ColumnFilter): boolean {
    return 'op' in filter && (filter.op === 'between' || isPresenceOp(filter.op))
}

export function floatingCellOf(
    type: FilterType | null,
    entry: ColumnFilterEntry | undefined,
    scale = 1
): FloatingCell {
    if (type === null) return { kind: 'none' }
    if (type === 'set') return setCell(entry)
    if (type === 'boolean') return booleanCell(entry)

    if (entry === undefined) {
        return { kind: 'input', op: emptyCondition(type).op, value: '', caseSensitive: false }
    }
    if (entry.kind === 'group' || panelOnly(entry)) return { kind: 'summary' }
    return simple(entry, scale) ?? { kind: 'summary' }
}
