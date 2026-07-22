/** Sort model: the shape a column sort takes and how it is ordered. */

export type SortDirection = 'asc' | 'desc'

export interface SortState {
    /** The id of the column being sorted. */
    columnId: string
    /** The active sort direction. */
    direction: SortDirection
}
