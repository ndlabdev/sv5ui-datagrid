import type { RowNode } from '../../core/types/index.js'

/** Where a drag currently wants to drop, for the indicator to draw. */
export interface RowDragState {
    /** Id of the row being dragged. */
    sourceId: string
    /** Index within the rendered order the row would land at. */
    targetIndex: number
}

/**
 * Row reordering rewrites the `data` array. With a sort active the pipeline
 * re-sorts that array immediately, so a drag changes the stored order without
 * changing what is on screen — clear the sort before offering the grip, the
 * same constraint AG Grid documents for managed row drag.
 */
export interface RowReorderOptions<TRow> {
    /**
     * Renders the grip column that starts a drag.
     * @default true
     */
    handle?: boolean

    /**
     * Excludes rows from being dragged. An unexcluded row can still be
     * dropped next to one of these, which only refuse to move themselves.
     */
    isRowDraggable?: (row: TRow) => boolean

    /**
     * Called after a move, with the data array already in its new order.
     * Use it to persist. Leave it out and the reorder is client-only.
     */
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
