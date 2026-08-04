import type { ColumnDef, SortRequestEntry, SortState } from '../../core/types/index.js'

/**
 * Collapses the sort model into the shape a server row model sends, in the
 * order the user built it — priority is the list's own order, so a server can
 * translate it straight into `ORDER BY`.
 *
 * A column names its wire field with `sortField`; without one its id travels,
 * which is right whenever the id is already the data's own field name. Sorts
 * naming a column the grid does not have are dropped rather than sent, since
 * the server has no more chance of resolving them than the grid did.
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
