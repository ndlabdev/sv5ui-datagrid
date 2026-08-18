import type { GridState } from '../../core/grid/index.js'
import type { ColumnState } from '../../core/types/index.js'
import { getPagination } from '../../features/pagination/index.js'
import { getVirtualization } from '../../features/virtualization/index.js'

export function pinLeftVar<TRow>(column: ColumnState<TRow>): string | undefined {
    return column.pinned === 'left' ? `var(${column.pinVar})` : undefined
}

export function pinRightVar<TRow>(column: ColumnState<TRow>): string | undefined {
    return column.pinned === 'right' ? `var(${column.pinVar})` : undefined
}

export function windowStartOf<TRow>(grid: GridState<TRow>): number {
    const virtualization = getVirtualization(grid)
    if (virtualization) return virtualization.virtualizer.range.start

    const pagination = getPagination(grid)
    // Row indexes address the nodes the grid holds. A client model holds the
    // whole set, so the page offsets into it; a server model holds one page,
    // and offsetting there points every lookup past the end of the array.
    if (pagination?.pageSize && !pagination.server) {
        return (pagination.page - 1) * pagination.pageSize
    }

    return 0
}

/**
 * What the rows the grid holds are numbered from for assistive technology.
 * A server model holds one page and indexes it from 0, but a screen reader is
 * told where in the whole set it stands, which only the server knows.
 */
export function rowIndexOffsetOf<TRow>(grid: GridState<TRow>): number {
    const pagination = getPagination(grid)
    if (!pagination?.server || !pagination.pageSize) return 0
    return (pagination.page - 1) * pagination.pageSize
}

/** The rows `aria-rowindex` counts against — the server's total, if it said. */
export function ariaRowCountOf<TRow>(grid: GridState<TRow>): number {
    const pagination = getPagination(grid)
    return pagination?.server ? pagination.total : grid.totalRows
}

export interface ColumnEntry<TRow> {
    column: ColumnState<TRow>
    index: number
}

export interface ColumnWindow<TRow> {
    windowed: boolean
    renderColumns: ColumnEntry<TRow>[]
    rowWidth: string | undefined
    has(index: number): boolean
}

export function columnWindowOf<TRow>(grid: GridState<TRow>): ColumnWindow<TRow> {
    const { visible, pinnedLeft, pinnedRight, offsets } = grid.columns
    const columnVirtualizer = getVirtualization(grid)?.columnVirtualizer

    if (!columnVirtualizer) {
        return {
            windowed: false,
            renderColumns: visible.map((column, index) => ({ column, index })),
            rowWidth: undefined,
            has: () => true
        }
    }

    const leftCount = pinnedLeft.length
    const rightStart = visible.length - pinnedRight.length
    // Widths are resolved against a container that has not been measured on the
    // first paint, so there are no offsets to window by yet. Rendering every
    // column until there are is what the row axis refuses to do with
    // `initialRows`, and it costs more here: every column of every rendered
    // row, before anything has been drawn.
    const range = offsets
        ? columnVirtualizer.range
        : { start: 0, end: Math.min(columnVirtualizer.initialColumns, visible.length) }
    const centerStart = Math.max(range.start, leftCount)
    const centerEnd = Math.min(range.end, rightStart)

    const renderColumns: ColumnEntry<TRow>[] = []
    for (let index = 0; index < leftCount; index++) {
        renderColumns.push({ column: visible[index], index })
    }
    for (let index = centerStart; index < centerEnd; index++) {
        renderColumns.push({ column: visible[index], index })
    }
    for (let index = rightStart; index < visible.length; index++) {
        renderColumns.push({ column: visible[index], index })
    }

    return {
        windowed: true,
        renderColumns,
        rowWidth: offsets ? `${offsets.at(-1)}px` : undefined,
        has: (index) =>
            index < leftCount || index >= rightStart || (index >= centerStart && index < centerEnd)
    }
}
