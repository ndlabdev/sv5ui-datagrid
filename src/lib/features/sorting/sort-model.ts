import type { ColumnDef, SortRequestEntry, SortState } from '../../core/types/index.js'

/**
 * The shape a server model sends, in priority order so it translates straight
 * into `ORDER BY`. A column travels as its `sortField`, or its id; sorts
 * naming a column the grid does not have are dropped rather than sent.
 */
export function toSortRequest<TRow>(
    sort: SortState[],
    columns: ColumnDef<TRow>[]
): SortRequestEntry[] {
    return sort.flatMap((entry) => {
        const column = columns.find((candidate) => candidate.id === entry.columnId)
        if (!column) return []
        return [{ field: column.sortField ?? column.id, direction: entry.direction }]
    })
}
