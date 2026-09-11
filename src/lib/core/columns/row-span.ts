import type { GridState } from '../grid/grid.svelte.js'
import type { ColumnState, RowNode } from '../types/index.js'

interface ColumnRowSpans {
    owner: number[]
    span: number[]
}

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

export function opensRowSpanGroup(
    columns: readonly { id: string }[],
    colIndex: number,
    spanning: ReadonlyMap<string, unknown>
): boolean {
    const column = columns[colIndex]
    if (!column || !spanning.has(column.id)) return false
    const previous = columns[colIndex - 1]
    return previous !== undefined && !spanning.has(previous.id)
}

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
            rowIndex,
            column
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
