import { type GridState } from '../../core/grid/index.js'
import { slotClass } from '../../core/theme/index.js'
import type { CellDecoration, ColumnState, GridFeature, RowNode } from '../../core/types/index.js'
import FlashWatcher from './FlashWatcher.svelte'
import type { FlashCellsOptions, FlashMark, FlashWay } from './flash-cells.types.js'
import { cellKey, emptyMemo, flashesBetween, remember, type SeenCell } from './flash-memo.js'

const FLASH_CELLS = 'flashCells'
const DEFAULT_DURATION = 700

const TINT: Record<FlashWay, string> = {
    up: 'var(--color-success)',
    down: 'var(--color-error)',
    changed: 'var(--color-primary)'
}

export class FlashCells<TRow> {
    #grid: GridState<TRow>
    #options: FlashCellsOptions<TRow>
    #remembered = emptyMemo()
    #timer: ReturnType<typeof setTimeout> | undefined

    marks = $state.raw<Record<string, FlashMark>>({})

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
        const found = flashesBetween(this.#remembered, seen, this.directional)
        this.#remembered = remember(seen)

        if (found.length === 0) return

        const at = Date.now()
        const next = { ...this.marks }
        for (const one of found) {
            next[one.key] = { way: one.way, at, before: one.before, after: one.after }
        }
        this.marks = next

        this.#sweepExpiry()
    }

    get directional(): boolean {
        return this.#options.direction ?? true
    }

    #sweepExpiry(): void {
        if (this.#timer !== undefined) clearTimeout(this.#timer)
        this.#timer = undefined

        const now = Date.now()
        const live: Record<string, FlashMark> = {}
        let earliest = Infinity

        for (const [key, mark] of Object.entries(this.marks)) {
            const ends = mark.at + this.duration
            if (ends <= now) continue
            live[key] = mark
            if (ends < earliest) earliest = ends
        }

        if (Object.keys(live).length !== Object.keys(this.marks).length) this.marks = live
        if (earliest === Infinity) return

        this.#timer = setTimeout(
            () => {
                this.#timer = undefined
                this.#sweepExpiry()
            },
            Math.max(1, earliest - now)
        )
    }

    stop = (): void => {
        if (this.#timer !== undefined) clearTimeout(this.#timer)
        this.#timer = undefined
        this.marks = {}
        this.#remembered = emptyMemo()
    }

    decoration(node: RowNode<TRow>, column: ColumnState<TRow>): CellDecoration | undefined {
        const mark = this.marks[cellKey(node.id, column.id)]
        if (!mark) return undefined

        const own = this.#options.appearance?.({ ...mark, age: Date.now() - mark.at })
        if (own) return own

        const tint = TINT[mark.way]
        return {
            class: this.#class(),
            style: {
                'box-shadow': `inset 0 0 0 9999px color-mix(in oklab, ${tint} 22%, transparent)`,
                '--dg-flash-tint': tint,
                '--dg-flash-ms': `${this.duration}ms`
            }
        }
    }

    #class(): string {
        const own = this.#grid.ui?.flashCell
        return [slotClass('flashCell'), typeof own === 'string' ? own : '']
            .filter(Boolean)
            .join(' ')
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
