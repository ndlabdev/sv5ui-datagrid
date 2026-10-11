import { prefixSums } from '../../core/columns/index.js'
import type { GridState } from '../../core/grid/index.js'
import { railGroupIdOf, type ColumnState, type RowNode } from '../../core/types/index.js'
import { Virtualizer } from '../../core/virtual/index.js'
import { getFiltering } from '../../features/filtering/index.js'
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
    if (pagination?.pageSize && !pagination.server) {
        return (pagination.page - 1) * pagination.pageSize
    }

    return 0
}

export function rowIndexOffsetOf<TRow>(grid: GridState<TRow>): number {
    const pagination = getPagination(grid)
    if (!pagination?.server || !pagination.pageSize) return 0
    return (pagination.page - 1) * pagination.pageSize
}

export function headerRowsOf<TRow>(grid: GridState<TRow>): number {
    return grid.columns.headerRowCount + (getFiltering(grid)?.floatingRow ? 1 : 0)
}

export function headerOffsetOf<TRow>(grid: GridState<TRow>, extraRows = 0): string {
    const tiers = grid.columns.headerRowCount - 1
    const rows = (getFiltering(grid)?.floatingRow ? 1 : 0) + extraRows

    const parts = ['var(--dg-header-h)']
    if (tiers > 0) parts.push(`var(--dg-group-header-h) * ${tiers}`)
    if (rows > 0) parts.push(`var(--dg-row-h) * ${rows}`)

    return `calc(${parts.join(' + ')})`
}

export function stuckGroupsOf<TRow>(grid: GridState<TRow>): RowNode<TRow>[] {
    if (!grid.stickyGroups) return []

    const virtualization = getVirtualization(grid)
    if (!virtualization) return []

    const nodes = grid.preWindowNodes
    const first = firstBelowTheFold(virtualization.virtualizer, nodes.length)
    if (first < 0) return []

    return ancestorsAbove(nodes, first)
}

function levelAt<TRow>(nodes: RowNode<TRow>[], at: number): number {
    return nodes[at]?.meta?.level ?? 0
}

function bottomOf(virtualizer: Virtualizer, at: number): number {
    return virtualizer.indexToOffset(at) + virtualizer.sizeOf(at)
}

function firstBelowTheFold(virtualizer: Virtualizer, count: number): number {
    const top = virtualizer.scrollTop
    for (let at = Math.max(0, virtualizer.range.start); at < count; at++) {
        if (bottomOf(virtualizer, at) > top) return at
    }
    return -1
}

function ancestorsAbove<TRow>(nodes: RowNode<TRow>[], first: number): RowNode<TRow>[] {
    const stuck: RowNode<TRow>[] = []
    let wanted = levelAt(nodes, first) - 1

    for (let at = first - 1; at >= 0 && wanted >= 0; at--) {
        if (levelAt(nodes, at) !== wanted) continue
        wanted -= 1
        stuck.unshift(nodes[at]!)
    }

    return stuck
}

export function ariaRowCountOf<TRow>(grid: GridState<TRow>): number {
    const pagination = getPagination(grid)
    return pagination?.server ? pagination.total : grid.totalRows
}

interface ColumnEntry<TRow> {
    column: ColumnState<TRow>
    index: number
}

interface ColumnWindow<TRow> {
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

export interface RailBand {
    id: string
    groupId: string
    header: string
    index: number
    start: number
    width: number
    pinned: ColumnState<unknown>['pinned']
    pinVar: string
}

export function isRailAt<TRow>(grid: GridState<TRow>, index: number): boolean {
    const id = grid.columns.visible[index]?.id
    return id !== undefined && railGroupIdOf(id) !== null
}

export function railEdgeClasses<TRow>(
    grid: GridState<TRow>,
    index: number,
    edges: { lead: string; trail: string }
): string {
    const columns = grid.columns
    const filled =
        columns.containerWidth > 0 && (columns.offsets?.at(-1) ?? 0) >= columns.containerWidth
    const leading = index === 0 && filled ? '' : edges.lead
    const lastColumn = index === columns.visible.length - 1
    const trailing = (lastColumn && filled) || isRailAt(grid, index + 1) ? '' : ` ${edges.trail}`
    return `${leading}${trailing}`
}

export function railInset(rail: RailBand): {
    start: string
    width: string
} {
    const track = `${rail.start}px`
    const width = `${rail.width}px`
    const scrolled = 'var(--dg-scroll-x, 0px)'
    const pin = `var(${rail.pinVar})`
    if (rail.pinned === 'left') {
        return { start: `max(${track}, calc(${scrolled} + ${pin}))`, width }
    }
    if (rail.pinned === 'right') {
        const edge = `calc(${scrolled} + var(--dg-view-w, 0px) - ${pin} - ${width})`
        return { start: `min(${track}, ${edge})`, width }
    }
    return { start: track, width }
}

export function railsOf<TRow>(grid: GridState<TRow>, window: ColumnWindow<TRow>): RailBand[] {
    const offsets = grid.columns.offsets ?? prefixSums(grid.columns.trackWidths)
    return window.renderColumns.flatMap(({ column, index }) => {
        const groupId = railGroupIdOf(column.id)
        if (!groupId) return []
        const start = offsets[index]
        const width = grid.columns.trackWidths[index]
        if (start === undefined || width === undefined) return []
        return [
            {
                id: column.id,
                groupId,
                header: column.header,
                index,
                start,
                width,
                pinned: column.pinned,
                pinVar: column.pinVar
            }
        ]
    })
}
