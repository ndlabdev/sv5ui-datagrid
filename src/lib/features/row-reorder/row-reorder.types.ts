import type { RowNode } from '../../core/types/index.js'

/** Where a drag currently wants to drop, for the indicator to draw. */
export interface RowDragState {
    /** Id of the row being dragged. */
    sourceId: string
    /** Index within the rendered order the row would land at. */
    targetIndex: number
}

/**
 * Reordering rewrites `data`, which an active sort immediately re-sorts: the
 * stored order changes and the screen does not. Clear the sort first.
 */
export interface RowReorderOptions<TRow> {
    /**
     * Renders the grip column that starts a drag.
     * @default true
     */
    handle?: boolean

    /** These refuse to move themselves; others can still land beside them. */
    isRowDraggable?: (row: TRow) => boolean

    /** After a move, with `data` already reordered. Omit for client-only. */
    onReorder?: (context: {
        /** The row that moved. */
        node: RowNode<TRow>
        /** Its index in `data` before the move. */
        from: number
        /** Its index in `data` after the move. */
        to: number
        /** The reordered data array — the same one now on the grid. */
        data: TRow[]
    }) => void
}
