import type { GridState } from '../core/grid.svelte.js'
import type { ColumnState } from '../core/types.js'
import { getPagination } from '../features/pagination/index.js'
import { getVirtualization } from '../features/virtualization/index.js'

export function windowStartOf<TRow>(grid: GridState<TRow>): number {
    const virtualization = getVirtualization(grid)
    if (virtualization) return virtualization.virtualizer.range.start

    const pagination = getPagination(grid)
    if (pagination?.pageSize) return (pagination.page - 1) * pagination.pageSize

    return 0
}

export interface ColumnWindow<TRow> {
    windowed: boolean
    colStart: number
    renderColumns: ColumnState<TRow>[]
    rowWidth: string | undefined
}

export function columnWindowOf<TRow>(grid: GridState<TRow>): ColumnWindow<TRow> {
    const columnVirtualizer = getVirtualization(grid)?.columnVirtualizer
    const offsets = grid.columns.offsets
    if (!columnVirtualizer || !offsets) {
        return {
            windowed: false,
            colStart: 0,
            renderColumns: grid.columns.visible,
            rowWidth: undefined
        }
    }

    const { start, end } = columnVirtualizer.range
    return {
        windowed: true,
        colStart: start,
        renderColumns: grid.columns.visible.slice(start, end),
        rowWidth: `${offsets.at(-1)}px`
    }
}
