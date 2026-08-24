import { rowColSpans, type RowSpans } from '../columns/col-span.js'
import { clamp } from '../utils/math.js'
import type { GridState } from '../grid/grid.svelte.js'
import type { Keybinding, RowNode } from '../types/index.js'

/** `row` is a `preWindowNodes` index only in the `body` section. */
export type GridSection = 'top' | 'body' | 'bottom'

export interface CellPosition {
    row: number
    col: number
    /** @default 'body' */
    section?: GridSection
}

export const HEADER_ROW = -1

/**
 * The floating filter row: a second navigable line above the body, drawn only
 * when `filtering({ floatingRow: true })` asked for one. Negative like the
 * header so a body index stays what it always was.
 */
export const FILTER_ROW = -2

export class FocusModel<TRow> {
    // Body positions carry no `section` at all, so `active` keeps the exact
    // shape it had before pinned rows became focusable.
    active = $state.raw<CellPosition>({ row: HEADER_ROW, col: 0 })

    #grid: GridState<TRow>
    #bindings: Keybinding<TRow>[]

    constructor(grid: GridState<TRow>, featureBindings: Keybinding<TRow>[]) {
        this.#grid = grid
        this.#bindings = [...featureBindings, ...createDefaultBindings<TRow>()]
    }

    get maxRow(): number {
        return this.#grid.totalRows - 1
    }

    get maxCol(): number {
        return this.#grid.columns.visible.length - 1
    }

    /**
     * Navigable lines above the body: the leaf header row, and the filter row
     * when one is drawn. Group header levels are not among them — nothing in
     * them takes focus, so movement steps straight past.
     */
    get headerLines(): number {
        const filtering = this.#grid.state['filtering'] as { floatingRow?: boolean } | undefined
        return filtering?.floatingRow ? 2 : 1
    }

    /** The topmost row focus may reach, which the filter row lowers by one. */
    get minRow(): number {
        return this.headerLines > 1 ? FILTER_ROW : HEADER_ROW
    }

    /** Pinned rows live outside the pipeline, so they are counted separately. */
    rowsIn(section: GridSection): number {
        if (section === 'body') return this.#grid.totalRows
        const pinning = this.#grid.state['rowPinning'] as
            { topNodes?: unknown[]; bottomNodes?: unknown[] } | undefined
        const nodes = section === 'top' ? pinning?.topNodes : pinning?.bottomNodes
        return nodes?.length ?? 0
    }

    /** Header, pinned top, body, pinned bottom — flattened so movement is
     * arithmetic rather than a special case per boundary. */
    #toLinear(position: CellPosition): number {
        const section = position.section ?? 'body'
        const lines = this.headerLines
        const top = this.rowsIn('top')
        if (section === 'top') return lines + position.row
        if (section === 'bottom') return lines + top + this.#grid.totalRows + position.row
        if (position.row === HEADER_ROW) return 0
        // Last of the header lines, so it is undrawn rather than out of reach
        // when there is no filter row.
        if (position.row === FILTER_ROW) return lines - 1
        return lines + top + position.row
    }

    #fromLinear(index: number): CellPosition {
        const lines = this.headerLines
        const top = this.rowsIn('top')
        const body = this.#grid.totalRows
        if (index <= 0) return { row: HEADER_ROW, col: 0 }
        if (index < lines) return { row: FILTER_ROW, col: 0 }
        if (index < lines + top) return { row: index - lines, col: 0, section: 'top' }
        if (index < lines + top + body) return { row: index - lines - top, col: 0 }
        return { row: index - lines - top - body, col: 0, section: 'bottom' }
    }

    /** Column spans of a body row, so focus can land on the covering cell. */
    #bodySpans(row: number): RowSpans | null {
        if (row < 0) return null
        const node = this.#grid.preWindowNodes[row]
        if (!node || node.meta?.fullWidth) return null
        return rowColSpans(this.#grid, node, row)
    }

    focusCell = (position: CellPosition): void => {
        if (this.maxCol < 0) return
        const section = position.section ?? 'body'
        const col = clamp(position.col, 0, this.maxCol)

        if (section !== 'body') {
            const max = this.rowsIn(section) - 1
            if (max < 0) return
            this.active = { row: clamp(position.row, 0, max), col, section }
            return
        }

        const min = this.minRow
        const row = clamp(position.row, min, Math.max(min, this.maxRow))
        const fullWidth = row >= 0 && this.#grid.preWindowNodes[row]?.meta?.fullWidth
        if (fullWidth) {
            this.active = { row, col: 0 }
            return
        }
        // A covered column snaps to the cell that spans over it, so focus never
        // lands on a position no cell renders.
        const spans = this.#bodySpans(row)
        this.active = { row, col: spans ? spans.owner[col] : col }
    }

    /** Steps one column, skipping the columns a span covers. */
    #stepCol(cols: number): number {
        const active = this.active
        if (active.section || active.row < 0 || Math.abs(cols) !== 1) return active.col + cols
        const spans = this.#bodySpans(active.row)
        if (!spans) return active.col + cols
        const start = spans.owner[active.col]
        return cols > 0 ? start + spans.span[start] : start - 1
    }

    moveBy = (rows: number, cols: number): void => {
        if (rows === 0) {
            this.focusCell({ ...this.active, col: this.#stepCol(cols) })
            return
        }
        const col = this.active.col + cols

        const last =
            this.headerLines - 1 + this.rowsIn('top') + this.#grid.totalRows + this.rowsIn('bottom')
        const target = clamp(this.#toLinear(this.active) + rows, 0, last)
        // Spreading the linear result, not `active`, so crossing back into the
        // body drops the section rather than carrying a stale one.
        this.focusCell({ ...this.#fromLinear(target), col })
    }

    pageStep(): number {
        const virtualization = this.#grid.state['virtualization'] as
            { virtualizer?: { viewportHeight: number; visibleCount: () => number } } | undefined
        const virtualizer = virtualization?.virtualizer
        if (virtualizer && virtualizer.viewportHeight > 0) {
            return virtualizer.visibleCount()
        }

        const pagination = this.#grid.state['pagination'] as
            { pageSize?: number | null } | undefined
        if (pagination?.pageSize) return pagination.pageSize

        return 10
    }

    handleKeydown = (event: KeyboardEvent): boolean => {
        if (targetsInteractiveElement(event)) return false
        const descriptor = describeKey(event)
        const binding = this.#bindings.find(
            (candidate) => candidate.key === descriptor && (candidate.when?.(this.#grid) ?? true)
        )
        if (!binding) return false

        event.preventDefault()
        binding.handler(this.#grid, event)
        return true
    }
}

function targetsInteractiveElement(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null
    if (!target?.closest || target.hasAttribute('data-dg-cell')) return false
    return (
        target.closest(
            'input, textarea, select, button, [contenteditable="true"], [role="dialog"], [role="menu"]'
        ) !== null
    )
}

function describeKey(event: KeyboardEvent): string {
    let descriptor = ''
    if (event.ctrlKey || event.metaKey) descriptor += 'Ctrl+'
    if (event.altKey) descriptor += 'Alt+'
    if (event.shiftKey) descriptor += 'Shift+'
    return descriptor + event.key
}

function activeNode<TRow>(grid: GridState<TRow>): RowNode<TRow> | undefined {
    const { row, col } = grid.focus.active
    if (row < 0 || col !== 0) return undefined
    return grid.preWindowNodes[row]
}

function focusParentRow<TRow>(grid: GridState<TRow>, level: number): void {
    for (let row = grid.focus.active.row - 1; row >= 0; row--) {
        if ((grid.preWindowNodes[row].meta?.level ?? 0) < level) {
            grid.focus.focusCell({ row, col: 0 })
            return
        }
    }
}

function createTreegridBindings<TRow>(): Keybinding<TRow>[] {
    return [
        {
            key: 'ArrowRight',
            when: (grid) => {
                const node = activeNode(grid)
                return Boolean(node?.meta?.expandable && !grid.expansion.isExpanded(node.id))
            },
            handler: (grid) => grid.expansion.expand(activeNode(grid)!.id)
        },
        {
            key: 'ArrowLeft',
            when: (grid) => {
                const node = activeNode(grid)
                return Boolean(node?.meta?.expandable && grid.expansion.isExpanded(node.id))
            },
            handler: (grid) => grid.expansion.collapse(activeNode(grid)!.id)
        },
        {
            key: 'ArrowLeft',
            when: (grid) => (activeNode(grid)?.meta?.level ?? 0) > 0,
            handler: (grid) => focusParentRow(grid, activeNode(grid)!.meta!.level!)
        },
        {
            key: 'Enter',
            when: (grid) => Boolean(activeNode(grid)?.meta?.expandable),
            handler: (grid) => grid.expansion.toggle(activeNode(grid)!.id)
        }
    ]
}

function createDefaultBindings<TRow>(): Keybinding<TRow>[] {
    return [
        ...createTreegridBindings<TRow>(),
        { key: 'ArrowDown', handler: (grid) => grid.focus.moveBy(1, 0) },
        { key: 'ArrowUp', handler: (grid) => grid.focus.moveBy(-1, 0) },
        { key: 'ArrowLeft', handler: (grid) => grid.focus.moveBy(0, -1) },
        { key: 'ArrowRight', handler: (grid) => grid.focus.moveBy(0, 1) },
        {
            key: 'Home',
            handler: (grid) => grid.focus.focusCell({ row: grid.focus.active.row, col: 0 })
        },
        {
            key: 'End',
            handler: (grid) =>
                grid.focus.focusCell({ row: grid.focus.active.row, col: grid.focus.maxCol })
        },
        { key: 'Ctrl+Home', handler: (grid) => grid.focus.focusCell({ row: 0, col: 0 }) },
        {
            key: 'Ctrl+End',
            handler: (grid) =>
                grid.focus.focusCell({ row: grid.focus.maxRow, col: grid.focus.maxCol })
        },
        { key: 'PageDown', handler: (grid) => grid.focus.moveBy(grid.focus.pageStep(), 0) },
        { key: 'PageUp', handler: (grid) => grid.focus.moveBy(-grid.focus.pageStep(), 0) },
        {
            key: 'Enter',
            handler: (grid) => {
                const { row, col } = grid.focus.active
                if (row !== HEADER_ROW) return
                const column = grid.columns.visible[col]
                const toggleSort = grid.api['toggleSort'] as ((id: string) => void) | undefined
                if (column && toggleSort) toggleSort(column.id)
            }
        }
    ]
}
