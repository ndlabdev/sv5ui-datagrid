import { flattenColumns } from '../../core/columns/index.js'
import type { ColumnDef, SortNulls, SortRequestEntry, SortState } from '../../core/types/index.js'

/**
 * The shape a server model sends, in priority order so it translates straight
 * into `ORDER BY`. A column travels as its `sortField`, or its id; sorts
 * naming a column the grid does not have are dropped rather than sent.
 *
 * `nulls` travels with each entry because a database will not guess it: the
 * grid puts blanks first by default and Postgres puts them last, so a grid
 * that moved to a server row model would quietly reorder itself.
 *
 * It is written as the side the blanks actually end up on, which is not always
 * the side the option names. On the client a blank sorts as the smallest
 * value, so `first` becomes last once the direction is descending, while SQL's
 * `NULLS FIRST` means first whichever way the sort runs. Resolving it here
 * keeps the ordering the same on both sides of the wire.
 *
 * Flattened here rather than at the call site: a sort only ever names a leaf,
 * so handing this the grid's own `columns.defs` has to work whether or not
 * those defs carry header groups.
 */
export function toSortRequest<TRow>(
    sort: SortState[],
    columns: ColumnDef<TRow>[],
    nulls: SortNulls = 'first'
): SortRequestEntry[] {
    const leaves = flattenColumns(columns)
    return sort.flatMap((entry) => {
        const column = leaves.find((candidate) => candidate.id === entry.columnId)
        if (!column) return []
        const holes = entry.direction === 'desc' ? flip(nulls) : nulls
        return [{ field: column.sortField ?? column.id, direction: entry.direction, nulls: holes }]
    })
}

function flip(nulls: SortNulls): SortNulls {
    return nulls === 'first' ? 'last' : 'first'
}

/**
 * A sort read back from a snapshot, keeping only the entries that name a
 * column and a direction. The same reasoning as the filter model: what came
 * through storage is not a `SortState[]` because it was cast to one, and a
 * null entry in that array threw while the pipeline was reading it.
 */
export function sanitizeSortState(slice: unknown): SortState[] | null {
    if (!Array.isArray(slice)) return null
    return slice.flatMap((entry) => {
        if (typeof entry !== 'object' || entry === null) return []
        const { columnId, direction } = entry as Record<string, unknown>
        if (typeof columnId !== 'string' || columnId === '') return []
        if (direction !== 'asc' && direction !== 'desc') return []
        return [{ columnId, direction }]
    })
}
