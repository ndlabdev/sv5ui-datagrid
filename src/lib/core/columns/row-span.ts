import type { GridState } from '../grid/grid.svelte.js'
import type { ColumnState, RowNode } from '../types/index.js'

/**
 * One column's vertical spans. `owner[i]` is the row drawing the cell that
 * covers row `i`; `span[i]` is how many rows the cell at `i` covers. Indices
 * are into the pre-window list, so a span survives paging and scrolling.
 */
export interface ColumnRowSpans {
    owner: number[]
    span: number[]
}

/**
 * Resolved against the whole row list, because a span reaching into view may
 * start above it. One pass per spanning column; hold the result until the
 * rows change. A grid declaring none pays nothing.
 */
export function rowSpansOf<TRow>(
    grid: GridState<TRow>,
    nodes: RowNode<TRow>[]
): Map<string, ColumnRowSpans> {
    const spanning = grid.columns.visible.filter((column) => column.def.rowSpan)
    const result = new Map<string, ColumnRowSpans>()
    if (spanning.length === 0) return result

    for (const column of spanning) {
        result.set(column.id, columnRowSpans(grid, column, nodes))
    }
    return result
}

/** A full-width row draws one cell, so nothing can span out of it. */
function requestedSpan<TRow>(
    grid: GridState<TRow>,
    column: ColumnState<TRow>,
    node: RowNode<TRow>,
    rowIndex: number
): number {
    if (node.meta?.fullWidth) return 1
    return (
        column.def.rowSpan?.({
            node,
            row: node.row,
            value: grid.getValue(node, column),
            rowIndex
        }) ?? 1
    )
}

function columnRowSpans<TRow>(
    grid: GridState<TRow>,
    column: ColumnState<TRow>,
    nodes: RowNode<TRow>[]
): ColumnRowSpans {
    const count = nodes.length
    const owner = new Array<number>(count)
    const span = new Array<number>(count)

    let i = 0
    while (i < count) {
        const requested = requestedSpan(grid, column, nodes[i], i)
        // Grown up to the request, but never into a full-width row or past the
        // end of the list.
        let n = 1
        while (n < requested && i + n < count && !nodes[i + n].meta?.fullWidth) n++

        span[i] = n
        owner[i] = i
        for (let k = 1; k < n; k++) {
            owner[i + k] = i
            span[i + k] = 1
        }
        i += n
    }
    return { owner, span }
}
