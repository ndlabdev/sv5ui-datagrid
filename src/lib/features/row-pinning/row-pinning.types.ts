import type { RowPinSide } from '../../core/types.js'

export interface RowPinningOptions<TRow> {
    /**
     * Initial pin side per row. Runtime `pinRow()` calls override it.
     * Pinned rows leave the scrolling flow and skip filter and sort.
     */
    isRowPinned?: (row: TRow) => RowPinSide | null
}
