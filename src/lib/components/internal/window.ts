import type { GridState } from '../../core/grid/grid.svelte.js'
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
    if (pagination?.pageSize) return (pagination.page - 1) * pagination.pageSize

    return 0
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

    if (!columnVirtualizer || !offsets) {
        return {
            windowed: false,
            renderColumns: visible.map((column, index) => ({ column, index })),
            rowWidth: undefined,
            has: () => true
        }
    }

    const leftCount = pinnedLeft.length
    const rightStart = visible.length - pinnedRight.length
    const range = columnVirtualizer.range
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
        rowWidth: `${offsets.at(-1)}px`,
        has: (index) =>
            index < leftCount || index >= rightStart || (index >= centerStart && index < centerEnd)
    }
}
