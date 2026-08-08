import type { GridState } from '../../core/grid/grid.svelte.js'
import type { GridFeature, Keybinding, RowNode } from '../../core/types/index.js'
import { mutator } from '../../core/utils/reactivity.js'
import type { RowDragState, RowReorderOptions } from './row-reorder.types.js'

export const ROW_REORDER = 'rowReorder'

export class RowReorder<TRow> {
    /** Set while a pointer drag is in flight; drives the drop indicator. */
    drag = $state.raw<RowDragState | null>(null)

    readonly handle: boolean

    #grid: GridState<TRow>
    #isRowDraggable: (row: TRow) => boolean
    #onReorder: RowReorderOptions<TRow>['onReorder']

    constructor(grid: GridState<TRow>, options: RowReorderOptions<TRow>) {
        this.#grid = grid
        this.handle = options.handle ?? true
        this.#isRowDraggable = options.isRowDraggable ?? (() => true)
        this.#onReorder = options.onReorder
    }

    canDrag = (node: RowNode<TRow>): boolean => {
        // A full-width row is a group header or a detail panel: it has no place
        // of its own in `data` to move.
        return !node.meta?.fullWidth && this.#isRowDraggable(node.row)
    }

    /** Position of a row within the rendered order, or -1. */
    #renderedIndexOf(id: string): number {
        return this.#grid.preWindowNodes.findIndex((node) => node.id === id)
    }

    #dataIndexOf(id: string): number {
        return this.#grid.data.findIndex((row) => this.#grid.getRowId(row) === id)
    }

    startDrag = (id: string): void => {
        const index = this.#renderedIndexOf(id)
        if (index < 0) return
        this.drag = { sourceId: id, targetIndex: index }
    }

    updateDrag = (targetIndex: number): void => {
        const current = this.drag
        if (!current || current.targetIndex === targetIndex) return
        this.drag = { ...current, targetIndex }
    }

    cancelDrag = (): void => {
        this.drag = null
    }

    commitDrag = (): void => {
        const current = this.drag
        this.drag = null
        if (!current) return
        this.moveRow(current.sourceId, current.targetIndex)
    }

    /**
     * Moves a row in the rendered order, rewriting `data` so it survives a
     * re-render — hence translating the target back through the node dropped
     * onto, since a sort makes rendered and data positions differ.
     *
     * `mutator`: it reads the rendered nodes and rewrites `grid.data`, the very
     * top of the pipeline that produced them. See its doc.
     */
    moveRow = mutator((id: string, toRenderedIndex: number): void => {
        const nodes = this.#grid.preWindowNodes
        const from = this.#renderedIndexOf(id)
        if (from < 0) return

        const node = nodes[from]
        if (!this.canDrag(node)) return

        const bounded = Math.max(0, Math.min(toRenderedIndex, nodes.length - 1))
        if (bounded === from) return

        const dataFrom = this.#dataIndexOf(id)
        const anchorId = nodes[bounded]?.id
        if (dataFrom < 0 || anchorId === undefined) return

        const next = [...this.#grid.data]
        const [moved] = next.splice(dataFrom, 1)
        // Re-read the anchor after the removal so the index still points at the
        // row the user aimed at rather than at its neighbour.
        const anchor = next.findIndex((row) => this.#grid.getRowId(row) === anchorId)
        const dataTo = anchor < 0 ? next.length : bounded > from ? anchor + 1 : anchor
        next.splice(dataTo, 0, moved)

        this.#grid.data = next
        this.#grid.events.emit('rowMoved', { id, from: dataFrom, to: dataTo })
        this.#onReorder?.({ node, from: dataFrom, to: dataTo, data: next })
    })

    /** Moves the row by one position, for the keyboard bindings. */
    nudge = mutator((id: string, delta: number): void => {
        const from = this.#renderedIndexOf(id)
        if (from < 0) return
        this.moveRow(id, from + delta)
    })
}

function activeNode<TRow>(grid: GridState<TRow>): RowNode<TRow> | undefined {
    return grid.preWindowNodes[grid.focus.active.row]
}

function createKeybindings<TRow>(): Keybinding<TRow>[] {
    const nudge = (grid: GridState<TRow>, delta: number) => {
        const node = activeNode(grid)
        if (node) getRowReorder(grid)?.nudge(node.id, delta)
    }
    // Alt keeps the arrows free for navigation, and matches the modifier used
    // for the column-reorder bindings.
    return [
        {
            key: 'Alt+ArrowUp',
            when: (grid) => getRowReorder(grid) !== undefined && grid.focus.active.row >= 0,
            handler: (grid) => nudge(grid, -1)
        },
        {
            key: 'Alt+ArrowDown',
            when: (grid) => getRowReorder(grid) !== undefined && grid.focus.active.row >= 0,
            handler: (grid) => nudge(grid, 1)
        }
    ]
}

export function rowReorder<TRow>(options: RowReorderOptions<TRow> = {}): GridFeature<TRow> {
    return {
        id: ROW_REORDER,
        createState: (grid) => {
            const state = new RowReorder(grid, options)
            if (state.handle) grid.columns.rowHandleColumn = true
            return state
        },
        createApi: (grid) => {
            const state = getRowReorder(grid)!
            return { moveRow: state.moveRow }
        },
        keybindings: createKeybindings<TRow>()
    }
}

export function getRowReorder<TRow>(grid: GridState<TRow>): RowReorder<TRow> | undefined {
    return grid.feature<RowReorder<TRow>>(ROW_REORDER)
}

declare module '../../core/types/api.js' {
    interface GridApi {
        moveRow?: (id: string, toRenderedIndex: number) => void
    }
}
