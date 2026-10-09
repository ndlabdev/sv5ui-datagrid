import { type GridState } from '../../core/grid/index.js'
import type { CellDecoration, ColumnState, GridFeature, RowNode } from '../../core/types/index.js'
import FlashWatcher from './FlashWatcher.svelte'
import type { FlashCellsOptions, FlashWay } from './flash-cells.types.js'
import { cellKey, emptyMemo, flashesBetween, remember, type SeenCell } from './flash-memo.js'

const FLASH_CELLS = 'flashCells'
const DEFAULT_DURATION = 700

const TINT: Record<FlashWay, string> = {
    up: 'var(--color-success)',
    down: 'var(--color-error)',
    changed: 'var(--color-primary)'
}

const stillOf = (way: FlashWay): CellDecoration => ({
    style: {
        outline: `2px solid ${TINT[way]}`,
        'outline-offset': '-2px'
    }
})

export class FlashCells<TRow> {
    #grid: GridState<TRow>
    #options: FlashCellsOptions<TRow>
    #remembered = emptyMemo()
    #timer: ReturnType<typeof setTimeout> | undefined

    ways = $state.raw<Record<string, FlashWay>>({})

    constructor(grid: GridState<TRow>, options: FlashCellsOptions<TRow>) {
        this.#grid = grid
        this.#options = options
    }

    get duration(): number {
        return this.#options.duration ?? DEFAULT_DURATION
    }

    get muted(): boolean {
        if (typeof window === 'undefined' || !window.matchMedia) return false
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    }

    #watched(): ColumnState<TRow>[] {
        const wanted = this.#options.columns
        const visible = this.#grid.columns.visible

        if (!wanted) return visible
        if (typeof wanted === 'function') return visible.filter(wanted)
        return visible.filter((column) => wanted.includes(column.id))
    }

    #onScreen(): SeenCell[] {
        const columns = this.#watched()
        if (columns.length === 0) return []

        const seen: SeenCell[] = []
        for (const node of this.#grid.nodes) {
            for (const column of columns) {
                seen.push({
                    key: cellKey(node.id, column.id),
                    value: this.#grid.getValue(node, column)
                })
            }
        }

        return seen
    }

    sweep = (): void => {
        const seen = this.#onScreen()
        const found = this.muted ? [] : flashesBetween(this.#remembered, seen, this.directional)
        this.#remembered = remember(seen)

        if (found.length === 0) return

        const next = { ...this.ways }
        for (const one of found) next[one.key] = one.way
        this.ways = next

        this.#restart()
    }

    get directional(): boolean {
        return this.#options.direction ?? true
    }

    #restart(): void {
        if (this.#timer !== undefined) clearTimeout(this.#timer)
        this.#timer = setTimeout(() => {
            this.#timer = undefined
            this.ways = {}
        }, this.duration)
    }

    stop = (): void => {
        if (this.#timer !== undefined) clearTimeout(this.#timer)
        this.#timer = undefined
        this.ways = {}
        this.#remembered = emptyMemo()
    }

    decoration(node: RowNode<TRow>, column: ColumnState<TRow>): CellDecoration | undefined {
        const way = this.ways[cellKey(node.id, column.id)]
        return way ? stillOf(way) : undefined
    }
}

export function flashCells<TRow>(options: FlashCellsOptions<TRow> = {}): GridFeature<TRow> {
    return {
        id: FLASH_CELLS,
        createState: (grid) => new FlashCells(grid, options),
        component: FlashWatcher,
        cellDecoration: ({ grid, node, column }) => getFlashCells(grid)?.decoration(node, column)
    }
}

export function getFlashCells<TRow>(grid: GridState<TRow>): FlashCells<TRow> | undefined {
    return grid.feature<FlashCells<TRow>>(FLASH_CELLS)
}
