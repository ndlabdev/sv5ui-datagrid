import { flattenColumns } from '../../core/columns/index.js'
import type { ColumnDef, SortRequestEntry, SortState } from '../../core/types/index.js'

/**
 * The shape a server model sends, in priority order so it translates straight
 * into `ORDER BY`. A column travels as its `sortField`, or its id; sorts
 * naming a column the grid does not have are dropped rather than sent.
 *
 * Flattened here rather than at the call site: a sort only ever names a leaf,
 * so handing this the grid's own `columns.defs` has to work whether or not
 * those defs carry header groups.
 */
export function toSortRequest<TRow>(
    sort: SortState[],
    columns: ColumnDef<TRow>[]
): SortRequestEntry[] {
    const leaves = flattenColumns(columns)
    return sort.flatMap((entry) => {
        const column = leaves.find((candidate) => candidate.id === entry.columnId)
        if (!column) return []
        return [{ field: column.sortField ?? column.id, direction: entry.direction }]
    })
}
