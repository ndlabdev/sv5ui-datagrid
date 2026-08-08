import type { ColumnDef, RowNode, SortState } from '../../core/types/index.js'
import { isBlank, sortValueGetter } from '../../core/utils/value.js'

/**
 * Where the holes land. Blank is null, undefined or the empty string — the same
 * set the `blank` filter operator matches and the renderers show as empty.
 */
export type SortNulls = 'first' | 'last'

export function sortNodes<TRow>(
    nodes: RowNode<TRow>[],
    columns: ColumnDef<TRow>[],
    sort: SortState[],
    nulls: SortNulls = 'first'
): RowNode<TRow>[] {
    if (sort.length === 0) return nodes

    const nullSign = nulls === 'last' ? 1 : -1
    const comparators = sort.flatMap((entry) => {
        const column = columns.find((c) => c.id === entry.columnId)
        if (!column) return []

        const factor = entry.direction === 'asc' ? 1 : -1
        // Resolved once per sort, not once per comparison: this runs on the
        // order of n log n times for 100k rows, so the branch belongs here.
        const valueOf = sortValueGetter(column)
        const compare =
            column.sortFn ?? ((a: TRow, b: TRow) => compareValues(valueOf(a), valueOf(b), nullSign))

        return [(a: RowNode<TRow>, b: RowNode<TRow>) => compare(a.row, b.row) * factor]
    })
    if (comparators.length === 0) return nodes

    return nodes.toSorted((a, b) => {
        for (const compare of comparators) {
            const result = compare(a, b)
            if (result !== 0) return result
        }
        return 0
    })
}

const collator = new Intl.Collator(undefined, { numeric: true })

function compareValues(a: unknown, b: unknown, nullSign: number): number {
    if (isBlank(a)) return isBlank(b) ? 0 : nullSign
    if (isBlank(b)) return -nullSign
    if (typeof a === 'number' && typeof b === 'number') return a - b
    if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
    return collator.compare(String(a), String(b))
}
