import { prefixSums } from '../../core/columns/column-sizing.js'
import { HEADER_ROW } from '../../core/interaction/focus-model.svelte.js'
import type { GridState } from '../../core/grid/grid.svelte.js'
import { parentGroupIdOf } from '../../core/columns/header-groups.js'
import { clamp } from '../../core/utils/math.js'
import {
    isSyntheticColumn,
    type GridFeature,
    type Keybinding,
    type PinnedSide
} from '../../core/types/index.js'
import { dropTargetIndex } from './drag.js'
import type { ColumnDragState, ColumnOpsOptions } from './column-ops.types.js'

export const COLUMN_OPS = 'columnOps'

export class ColumnOps<TRow> {
    element = $state<HTMLElement | null>(null)
    menuFor = $state<string | null>(null)
    drag = $state.raw<ColumnDragState | null>(null)

    readonly canResize: boolean
    readonly canReorder: boolean
    readonly canPin: boolean
    readonly canHide: boolean
    readonly resizeStep: number

    #grid: GridState<TRow>

    constructor(grid: GridState<TRow>, options: ColumnOpsOptions) {
        this.#grid = grid
        this.canResize = options.resize ?? true
        this.canReorder = options.reorder ?? true
        this.canPin = options.pin ?? true
        this.canHide = options.hide ?? true
        this.resizeStep = options.resizeStep ?? 16
    }

    currentWidth(id: string): number {
        const index = this.#grid.columns.indexOf(id)
        if (index < 0) return 0
        return this.#grid.columns.trackWidths[index]
    }

    #offsets(): number[] {
        return this.#grid.columns.offsets ?? prefixSums(this.#grid.columns.trackWidths)
    }

    #siblingRange(id: string): { start: number; end: number } {
        const { columns } = this.#grid
        const column = columns.get(id)
        if (!column) return { start: 0, end: columns.visible.length }

        const parent = parentGroupIdOf(columns.groupPaths, id)
        const indices = columns.visible.flatMap((candidate, index) =>
            !isSyntheticColumn(candidate.id) &&
            candidate.pinned === column.pinned &&
            parentGroupIdOf(columns.groupPaths, candidate.id) === parent
                ? [index]
                : []
        )
        if (indices.length === 0) return { start: 0, end: columns.visible.length }
        return { start: indices[0], end: indices[indices.length - 1] + 1 }
    }

    /** True when both the feature and the column itself allow resizing. */
    canResizeColumn = (id: string): boolean => {
        return this.canResize && this.#grid.columns.get(id)?.resizable !== false
    }

    setColumnWidth = (id: string, width: number): void => {
        if (!this.canResizeColumn(id)) return
        const applied = this.#grid.columns.setWidth(id, width)
        this.#grid.events.emit('columnResized', { columnId: id, width: applied })
    }

    resizeBy = (id: string, delta: number): void => {
        this.setColumnWidth(id, this.currentWidth(id) + delta)
    }

    autoSizeColumn = (id: string): void => {
        const width = this.#measureColumn(id)
        if (width !== null) this.setColumnWidth(id, width)
    }

    autoSizeColumns = (): void => {
        if (!this.canResize) return
        const widths: Record<string, number> = {}
        for (const column of this.#grid.columns.visible) {
            if (!column.resizable) continue
            const width = this.#measureColumn(column.id)
            if (width !== null) widths[column.id] = width
        }
        this.#grid.columns.setWidths(widths)
    }

    #measureColumn(id: string): number | null {
        const element = this.element
        const index = this.#grid.columns.indexOf(id)
        if (!element || index < 0) return null

        const cells = element.querySelectorAll<HTMLElement>(
            `[aria-colindex="${index + 1}"][role="gridcell"], [aria-colindex="${index + 1}"][role="columnheader"]:not([aria-colspan])`
        )
        const range = document.createRange()
        let contentWidth = 0
        let padding = 0
        for (const cell of cells) {
            if (padding === 0) {
                const style = getComputedStyle(cell)
                padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
            }
            if (cell.getAttribute('role') === 'columnheader') {
                contentWidth = Math.max(contentWidth, headerContentWidth(cell))
            } else {
                contentWidth = Math.max(contentWidth, bodyContentWidth(cell, range))
            }
        }
        if (contentWidth <= 0) return null

        // Sizing to a measurement taken at the current width feeds back on
        // itself: click autosize twice and the column creeps. Anything within a
        // couple of pixels of where it already is counts as already sized.
        const target = Math.ceil(contentWidth + padding) + 2
        const current = this.currentWidth(id)
        return Math.abs(target - current) <= AUTOSIZE_EPSILON ? null : target
    }

    moveColumn = (id: string, toVisibleIndex: number): number => {
        if (!this.canReorder || isSyntheticColumn(id)) return -1
        const { columns } = this.#grid
        const from = columns.indexOf(id)
        if (from < 0) return -1

        const range = this.#siblingRange(id)
        const target = clamp(toVisibleIndex, range.start, range.end - 1)
        if (target === from) return from

        const occupant = columns.visible[target]
        const allTarget = columns.all.findIndex((column) => column.id === occupant.id)
        columns.moveColumn(id, allTarget)
        this.#grid.events.emit('columnMoved', { columnId: id, toIndex: target })
        return target
    }

    #dragContext: { offsets: number[]; range: { start: number; end: number } } | null = null

    updateDrag = (sourceId: string, contentX: number): void => {
        if (!this.canReorder) return
        const sourceIndex = this.#grid.columns.indexOf(sourceId)
        if (sourceIndex < 0) return

        this.#dragContext ??= {
            offsets: this.#offsets(),
            range: this.#siblingRange(sourceId)
        }
        const { index, indicatorX } = dropTargetIndex(
            contentX,
            this.#dragContext.offsets,
            sourceIndex,
            this.#dragContext.range
        )
        this.drag = { sourceId, targetIndex: index, indicatorX }
    }

    commitDrag = (): void => {
        const drag = this.drag
        this.drag = null
        this.#dragContext = null
        if (!drag) return
        this.moveColumn(drag.sourceId, drag.targetIndex)
    }

    cancelDrag = (): void => {
        this.drag = null
        this.#dragContext = null
    }

    pinColumn = (id: string, side: PinnedSide | null): void => {
        if (!this.canPin || isSyntheticColumn(id)) return
        this.#grid.columns.setPinned(id, side)
        this.#grid.events.emit('columnPinned', { columnId: id, side })
    }

    setColumnHidden = (id: string, hidden: boolean): void => {
        if (!this.canHide || isSyntheticColumn(id)) return
        if (hidden && this.#grid.columns.visible.length <= 1) return
        this.#grid.columns.setHidden(id, hidden)
        this.#grid.focus.focusCell(this.#grid.focus.active)
        this.#grid.events.emit('columnVisibilityChanged', { columnId: id, hidden })
    }

    toggleHidden = (id: string): void => {
        const column = this.#grid.columns.get(id)
        if (column) this.setColumnHidden(id, !column.hidden)
    }
}

function activeColumnId<TRow>(grid: GridState<TRow>): string | null {
    return grid.columns.visible[grid.focus.active.col]?.id ?? null
}

function onHeaderRow<TRow>(grid: GridState<TRow>): boolean {
    return grid.focus.active.row === HEADER_ROW && getColumnOps(grid) !== undefined
}

function createKeybindings<TRow>(): Keybinding<TRow>[] {
    return [
        {
            key: 'Shift+ArrowRight',
            when: onHeaderRow,
            handler: (grid) => {
                const ops = getColumnOps(grid)!
                const id = activeColumnId(grid)
                if (id) ops.resizeBy(id, ops.resizeStep)
            }
        },
        {
            key: 'Shift+ArrowLeft',
            when: onHeaderRow,
            handler: (grid) => {
                const ops = getColumnOps(grid)!
                const id = activeColumnId(grid)
                if (id) ops.resizeBy(id, -ops.resizeStep)
            }
        },
        {
            key: 'Alt+ArrowRight',
            when: onHeaderRow,
            handler: (grid) => {
                const ops = getColumnOps(grid)!
                const id = activeColumnId(grid)
                if (!id) return
                const moved = ops.moveColumn(id, grid.focus.active.col + 1)
                if (moved >= 0) grid.focus.focusCell({ row: HEADER_ROW, col: moved })
            }
        },
        {
            key: 'Alt+ArrowLeft',
            when: onHeaderRow,
            handler: (grid) => {
                const ops = getColumnOps(grid)!
                const id = activeColumnId(grid)
                if (!id) return
                const moved = ops.moveColumn(id, grid.focus.active.col - 1)
                if (moved >= 0) grid.focus.focusCell({ row: HEADER_ROW, col: moved })
            }
        },
        {
            key: 'Alt+ArrowDown',
            when: onHeaderRow,
            handler: (grid) => {
                const ops = getColumnOps(grid)!
                ops.menuFor = activeColumnId(grid)
            }
        }
    ]
}

/** Below this, an autosize would only be re-stating the width already set. */
const AUTOSIZE_EPSILON = 3

/**
 * What a body cell needs to show its content in full.
 *
 * Content that stretches to the cell - a progress bar, anything on `w-full` -
 * measures as whatever the column happens to be right now, so sizing to it
 * would make every click drift the column wider. Such a cell contributes
 * nothing and the column sizes to its header and its other rows instead.
 */
function bodyContentWidth(cell: HTMLElement, range: Range): number {
    const available = cell.clientWidth
    let stretched = false

    for (const child of cell.children) {
        const width = (child as HTMLElement).getBoundingClientRect().width
        if (available > 0 && width >= available - 1) stretched = true
    }
    if (stretched && (cell.textContent ?? '').trim() === '') return 0

    range.selectNodeContents(cell)
    const measured = range.getBoundingClientRect().width
    // A stretched wrapper around real text still reports the cell width; the
    // text inside is what has to fit.
    return stretched ? Math.min(measured, textWidth(cell, range)) : measured
}

/** The width of the cell's text alone, ignoring boxes drawn around it. */
function textWidth(cell: HTMLElement, range: Range): number {
    let width = 0
    const walker = document.createTreeWalker(cell, NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
        if ((node.textContent ?? '').trim() !== '') {
            range.selectNode(node)
            width += range.getBoundingClientRect().width
        }
        node = walker.nextNode()
    }
    return width
}

/**
 * Everything a header cell has to fit: the label plus the sort, filter and
 * menu controls beside it. Measuring only the label used to autosize a column
 * down to the width of its text, and the controls then squeezed that text away
 * - worst on right-aligned columns, whose first child is a spacer of width
 * zero, which is what the old measurement read.
 */
function headerContentWidth(cell: HTMLElement): number {
    const style = getComputedStyle(cell)
    const gap = parseFloat(style.columnGap) || 0
    let width = 0
    let counted = 0

    for (const child of cell.children) {
        const element = child as HTMLElement
        // Spacers only push the controls to the edge; the resize handle and
        // any popup are positioned out of flow. Neither claims real width.
        if (element.dataset.dgSpacer !== undefined) continue
        if (getComputedStyle(element).position === 'absolute') continue
        width += Math.ceil(Math.max(element.scrollWidth, element.getBoundingClientRect().width))
        counted += 1
    }

    return counted > 0 ? width + (counted - 1) * gap : 0
}

export function columnOps<TRow>(options: ColumnOpsOptions = {}): GridFeature<TRow> {
    return {
        id: COLUMN_OPS,
        createState: (grid) => new ColumnOps(grid, options),
        createApi: (grid) => {
            const state = getColumnOps(grid)!
            return {
                setColumnWidth: state.setColumnWidth,
                autoSizeColumn: state.autoSizeColumn,
                autoSizeColumns: state.autoSizeColumns,
                moveColumn: state.moveColumn,
                pinColumn: state.pinColumn,
                setColumnHidden: state.setColumnHidden
            }
        },
        keybindings: createKeybindings<TRow>()
    }
}

export function getColumnOps<TRow>(grid: GridState<TRow>): ColumnOps<TRow> | undefined {
    return grid.feature<ColumnOps<TRow>>(COLUMN_OPS)
}
