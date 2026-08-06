import type { GridState } from '../grid/grid.svelte.js'
import type { ColumnState, RowNode } from '../types/index.js'

/**
 * One row's horizontal spans. `owner[i]` is the column drawing the cell that
 * covers column `i`; `span[i]` is how many columns the cell at `i` covers.
 */
export interface RowSpans {
    owner: number[]
    span: number[]
}

function pinSection<TRow>(column: ColumnState<TRow>): string {
    return column.pinned ?? 'center'
}

/** Cheap identity spans, so a grid with no `colSpan` pays nothing per row. */
function identitySpans(count: number): RowSpans {
    const owner = new Array<number>(count)
    const span = new Array<number>(count)
    for (let i = 0; i < count; i++) {
        owner[i] = i
        span[i] = 1
    }
    return { owner, span }
}

export function rowColSpans<TRow>(
    grid: GridState<TRow>,
    node: RowNode<TRow>,
    rowIndex: number
): RowSpans {
    const columns = grid.columns.visible
    if (!columns.some((column) => column.def.colSpan)) return identitySpans(columns.length)

    const { owner, span } = identitySpans(columns.length)
    let i = 0
    while (i < columns.length) {
        const column = columns[i]
        const requested =
            column.def.colSpan?.({
                node,
                row: node.row,
                value: grid.getValue(node, column),
                rowIndex
            }) ?? 1

        // Grow the span up to the request, but never across a pin boundary —
        // pinned cells are individually sticky, so a span cannot straddle them.
        const section = pinSection(column)
        let n = 1
        while (n < requested && i + n < columns.length && pinSection(columns[i + n]) === section) {
            n++
        }

        span[i] = n
        for (let k = 1; k < n; k++) owner[i + k] = i
        i += n
    }
    return { owner, span }
}
