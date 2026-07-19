import { HEADER_ROW } from '../../core/focus-model.svelte.js'
import type { GridState } from '../../core/grid.svelte.js'
import { PIPELINE_ORDER } from '../../core/pipeline.svelte.js'
import type { GridFeature, Keybinding, SortDirection, SortState } from '../../core/types.js'
import { sortNodes, type SortNulls } from './sort.js'

export const SORTING = 'sorting'

export interface SortingOptions {
    initial?: SortState[]
    nulls?: SortNulls
}

export interface ToggleSortOptions {
    append?: boolean
}

export class Sorting<TRow> {
    sort = $state.raw<SortState[]>([])

    readonly nulls: SortNulls

    #grid: GridState<TRow>

    constructor(grid: GridState<TRow>, options: SortingOptions) {
        this.#grid = grid
        this.sort = options.initial ?? []
        this.nulls = options.nulls ?? 'first'
    }

    toggleSort = (columnId: string, options: ToggleSortOptions = {}): void => {
        const column = this.#grid.columns.get(columnId)
        if (!column?.def.sortable) return

        const existing = this.sort.find((entry) => entry.columnId === columnId)
        let next: SortState[]

        if (!existing) {
            const added: SortState = { columnId, direction: 'asc' }
            next = options.append ? [...this.sort, added] : [added]
        } else if (existing.direction === 'asc') {
            const flipped: SortState = { columnId, direction: 'desc' }
            next = options.append
                ? this.sort.map((entry) => (entry.columnId === columnId ? flipped : entry))
                : [flipped]
        } else {
            next = options.append ? this.sort.filter((entry) => entry.columnId !== columnId) : []
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
        pipelineStage: {
            order: PIPELINE_ORDER.sort,
            transform: (nodes, grid) => {
                const state = getSorting(grid)
                if (!state) return nodes
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
