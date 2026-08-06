import type { RowPinSide } from '../../core/types/index.js'

export interface RowPinningOptions<TRow> {
    /** Initial pin side; pinned rows leave the flow and skip filter and sort. */
    isRowPinned?: (row: TRow) => RowPinSide | null
}
