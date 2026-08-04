import type { GridState } from '../grid/grid.svelte.js'
import type { ColumnState, RowNode } from '../types/index.js'

/**
 * The vertical spans of one column. `owner[i]` is the row whose cell covers
 * row `i` — `i` itself for a normal or span-starting cell, an earlier row for
 * a covered one. `span[i]` is how many rows the cell starting at `i` covers.
 *
 * Indices are into the pre-window row list, the same numbering `data-dg-cell`
 * uses, so a span survives paging and scrolling.
 */
export interface ColumnRowSpans {
    owner: number[]
    span: number[]
}

/**
 * Resolves every `rowSpan` column against the whole row list — not just the
 * rendered window, because a span reaching into view may start above it.
 *
 * The cost is one pass per column that declares `rowSpan`, and the caller is
 * expected to hold the result until the rows change. A grid whose columns
 * declare none gets an empty map and pays nothing.
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

/**
 * What the column asks for at this row. A full-width row renders one cell
 * across every column, so nothing can span out of it.
 */
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
