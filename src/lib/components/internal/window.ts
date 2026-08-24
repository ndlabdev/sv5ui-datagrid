import { prefixSums } from '../../core/columns/index.js'
import type { GridState } from '../../core/grid/index.js'
import { railGroupIdOf, type ColumnState } from '../../core/types/index.js'
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

export interface RailBand {
    id: string
    groupId: string
    header: string
    /** Where the drawer stands among the visible columns. */
    index: number
    start: number
    width: number
    /** The side it is pinned to, when the group it folded was pinned. */
    pinned: ColumnState<unknown>['pinned']
    /** The offset that pin is held at, as a CSS variable name. */
    pinVar: string
}

/**
 * Where to hang a drawer from. A drawer stands over a column, so a pinned
 * one has to stay with it: the cells do that with `sticky`, which an overlay
 * spanning every row cannot be, so it hangs off the same pin offset and the
 * scroll distance the viewport writes down as it goes. Both boxes it hangs
 * in are the width of a row, which is what the trailing edge is measured
 * back from.
 */
/**
 * Whether a drawer stands at this column. The cell before one draws no edge
 * of its own: a drawer draws both of its own, so the two would land on
 * neighbouring pixels and read as one thick line.
 */
export function isRailAt<TRow>(grid: GridState<TRow>, index: number): boolean {
    const id = grid.columns.visible[index]?.id
    return id !== undefined && railGroupIdOf(id) !== null
}

/**
 * Which of its own edges a drawer draws. A drawer is a surface of its own, so
 * it has to be closed on both sides wherever it stands; the cells beside it
 * give up the line they would have drawn, and the only edge it leaves to
 * something else is one the grid's own border is already standing on.
 *
 * That border is only there when the columns reach it: a grid whose columns
 * come up short of its width leaves the last of them in open ground, and a
 * drawer left open there is a drawer with one side.
 */
export function railEdgeClasses<TRow>(
    grid: GridState<TRow>,
    index: number,
    edges: { lead: string; trail: string }
): string {
    const columns = grid.columns
    // Until the grid has been measured, nothing is known about where its
    // border stands, and a drawer closed on both sides is the safer of the
    // two guesses: an extra line for one frame reads better than a side
    // missing for one.
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
    // A pinned cell holds its place with `sticky`, which travels only as far
    // as it has to: no further than the pin, and not at all while the grid
    // has nothing to scroll. The drawer is one element over every row, so it
    // cannot be sticky, and these say the same thing in arithmetic.
    if (rail.pinned === 'left') {
        return { start: `max(${track}, calc(${scrolled} + ${pin}))`, width }
    }
    if (rail.pinned === 'right') {
        const edge = `calc(${scrolled} + var(--dg-view-w, 0px) - ${pin} - ${width})`
        return { start: `min(${track}, ${edge})`, width }
    }
    return { start: track, width }
}

/**
 * Where a folded group's drawer stands, in the coordinates a row is laid out
 * in. The header and the body each draw their own piece of it, and both read
 * it from here so the two pieces line up to the pixel. Only the rails the
 * column window is drawing: one scrolled out of view has nothing to label.
 */
export function railsOf<TRow>(grid: GridState<TRow>, window: ColumnWindow<TRow>): RailBand[] {
    // Estimates until the grid has been measured, rather than nothing: a grid
    // that opens with a group already folded would otherwise paint a blank
    // column first and the drawer a frame later, and the server, which
    // measures nothing at all, would send the blank.
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
