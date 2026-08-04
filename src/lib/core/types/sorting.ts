/** Sort model: the shape a column sort takes and how it is ordered. */

export type SortDirection = 'asc' | 'desc'

export interface SortState {
    /** The id of the column being sorted. */
    columnId: string
    /** The active sort direction. */
    direction: SortDirection
}

/**
 * One sort as it leaves the grid for a server. Deliberately separate from
 * `SortState`: this shape crosses the network into code the grid does not own,
 * so it carries the column's `sortField` rather than an id that is a UI
 * concern. Build a list with `toSortRequest`.
 */
export interface SortRequestEntry {
    /** The column's `sortField`, or its id when it names none. */
    field: string
    direction: SortDirection
}
