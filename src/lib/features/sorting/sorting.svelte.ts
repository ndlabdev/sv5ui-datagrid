import { HEADER_ROW } from '../../core/interaction/focus-model.svelte.js'
import type { GridState } from '../../core/grid/grid.svelte.js'
import { PIPELINE_ORDER } from '../../core/grid/pipeline.svelte.js'
import type { GridFeature, Keybinding, SortDirection, SortState } from '../../core/types/index.js'
import { sortNodes, type SortNulls } from './sort.js'

export const SORTING = 'sorting'

/**
 * The states a header click walks through, in order. `null` is the unsorted
 * state; reaching it drops the column from the sort. A cycle with no `null`
 * (e.g. `['asc', 'desc']`) never clears — clicking always flips.
 */
export type SortCycle = (SortDirection | null)[]

const DEFAULT_CYCLE: SortCycle = ['asc', 'desc', null]

export interface SortingOptions {
    initial?: SortState[]
    nulls?: SortNulls
    /** Order a header click cycles through. @default ['asc', 'desc', null] */
    cycle?: SortCycle
}

export interface ToggleSortOptions {
    append?: boolean
}

export class Sorting<TRow> {
    sort = $state.raw<SortState[]>([])

    readonly nulls: SortNulls
    readonly cycle: SortCycle

    #grid: GridState<TRow>

    constructor(grid: GridState<TRow>, options: SortingOptions) {
        this.#grid = grid
        this.sort = options.initial ?? []
        this.nulls = options.nulls ?? 'first'
        // A cycle needs at least one direction to be usable; fall back otherwise.
        this.cycle =
            options.cycle?.some((state) => state !== null) === true ? options.cycle : DEFAULT_CYCLE
    }

    /** The state a column moves to on the next click, per the configured cycle. */
    #nextState(current: SortDirection | null): SortDirection | null {
        const index = this.cycle.indexOf(current)
        return this.cycle[(index + 1) % this.cycle.length]
    }

    toggleSort = (columnId: string, options: ToggleSortOptions = {}): void => {
        const column = this.#grid.columns.get(columnId)
        if (!column?.def.sortable) return

        const current = this.directionOf(columnId) ?? null
        const target = this.#nextState(current)

        let next: SortState[]
        if (!options.append) {
            next = target ? [{ columnId, direction: target }] : []
        } else if (target === null) {
            next = this.sort.filter((entry) => entry.columnId !== columnId)
        } else if (current === null) {
            next = [...this.sort, { columnId, direction: target }]
        } else {
            next = this.sort.map((entry) =>
                entry.columnId === columnId ? { columnId, direction: target } : entry
            )
        }

        this.sort = next
        this.#grid.events.emit('sortChanged', { sort: next })
    }

    setSort = (sort: SortState[]): void => {
        this.sort = sort
        this.#grid.events.emit('sortChanged', { sort })
    }

    directionOf(columnId: string): SortDirection | undefined {
        return this.sort.find((entry) => entry.columnId === columnId)?.direction
    }

    priorityOf(columnId: string): number | null {
        if (this.sort.length < 2) return null
        const index = this.sort.findIndex((entry) => entry.columnId === columnId)
        return index >= 0 ? index + 1 : null
    }
}

function createKeybindings<TRow>(): Keybinding<TRow>[] {
    return [
        {
            key: 'Shift+Enter',
            when: (grid) => grid.focus.active.row === HEADER_ROW && getSorting(grid) !== undefined,
            handler: (grid) => {
                const column = grid.columns.visible[grid.focus.active.col]
                if (column) getSorting(grid)!.toggleSort(column.id, { append: true })
            }
        }
    ]
}

export function sorting<TRow>(options: SortingOptions = {}): GridFeature<TRow> {
    return {
        id: SORTING,
        createState: (grid) => new Sorting(grid, options),
        createApi: (grid) => {
            const state = getSorting(grid)!
            return { toggleSort: state.toggleSort, setSort: state.setSort }
        },
        keybindings: createKeybindings<TRow>(),
        serialize: (grid) => {
            const sort = getSorting(grid)?.sort ?? []
            return sort.length > 0 ? sort : undefined
        },
        hydrate: (slice, grid) => {
            if (Array.isArray(slice)) getSorting(grid)?.setSort(slice as SortState[])
        },
        pipelineStage: {
            order: PIPELINE_ORDER.sort,
            transform: (nodes, grid) => {
                const state = getSorting(grid)
                // Server mode: the rows arrived sorted, and re-sorting the page
                // in isolation would reorder it against the rest of the set.
                if (!state || grid.rowModel === 'server') return nodes
                return sortNodes(
                    nodes,
                    grid.columns.all.map((column) => column.def),
                    state.sort,
                    state.nulls
                )
            }
        }
    }
}

export function getSorting<TRow>(grid: GridState<TRow>): Sorting<TRow> | undefined {
    return grid.feature<Sorting<TRow>>(SORTING)
}
