/** Sort model: the shape a column sort takes and how it is ordered. */

export type SortDirection = 'asc' | 'desc'

/**
 * Where blanks land. Blank is null, undefined or the empty string, the same
 * set the `blank` filter operator matches and the renderers draw as empty.
 */
export type SortNulls = 'first' | 'last'

export interface SortState {
    /** The id of the column being sorted. */
    columnId: string
    /** The active sort direction. */
    direction: SortDirection
}

/**
 * One sort as it leaves for a server: the column's `sortField` rather than an
 * id that is a UI concern. Built by `toSortRequest`.
 */
export interface SortRequestEntry {
    /** The column's `sortField`, or its id when it names none. */
    field: string
    direction: SortDirection
    /**
     * Where the grid puts blanks, which SQL will not guess: Postgres orders
     * ascending with nulls last, and this grid defaults to first. Written on
     * every entry so the ordering a reader sees does not change with the row
     * model.
     */
    nulls: SortNulls
}
