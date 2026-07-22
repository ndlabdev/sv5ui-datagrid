import type { ColumnDef, RowNode, SortState } from '../../core/types.js'
import { getCellValue, isNullish } from '../../core/utils/value.js'

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
        const compare =
            column.sortFn ??
            ((a: TRow, b: TRow) =>
                compareValues(getCellValue(a, column), getCellValue(b, column), nullSign))

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
    if (isNullish(a)) return isNullish(b) ? 0 : nullSign
    if (isNullish(b)) return -nullSign
    if (typeof a === 'number' && typeof b === 'number') return a - b
    if (typeof a === 'boolean' && typeof b === 'boolean') return Number(a) - Number(b)
    if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime()
    return collator.compare(String(a), String(b))
}
