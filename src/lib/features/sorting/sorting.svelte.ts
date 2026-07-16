import type { GridState } from '../../core/grid.svelte.js'
import { PIPELINE_ORDER } from '../../core/pipeline.svelte.js'
import type { GridFeature, SortDirection, SortState } from '../../core/types.js'
import { sortNodes } from './sort.js'

export const SORTING = 'sorting'

export interface SortingOptions {
    initial?: SortState[]
}

export class Sorting<TRow> {
    sort = $state.raw<SortState[]>([])

    #grid: GridState<TRow>

    constructor(grid: GridState<TRow>, initial: SortState[]) {
        this.#grid = grid
        this.sort = initial
    }

    directionOf(columnId: string): SortDirection | undefined {
        return this.sort.find((entry) => entry.columnId === columnId)?.direction
    }

    toggleSort = (columnId: string): void => {
        const column = this.#grid.columns.get(columnId)
        if (!column?.def.sortable) return

        const current = this.sort.find((entry) => entry.columnId === columnId)
        if (!current) {
            this.setSort([{ columnId, direction: 'asc' }])
        } else if (current.direction === 'asc') {
            this.setSort([{ columnId, direction: 'desc' }])
        } else {
            this.setSort([])
        }
    }

    setSort = (sort: SortState[]): void => {
        this.sort = sort
        this.#grid.events.emit('sortChanged', { sort })
    }
}

export function sorting<TRow>(options: SortingOptions = {}): GridFeature<TRow> {
    return {
        id: SORTING,
        createState: (grid) => new Sorting(grid, options.initial ?? []),
        createApi: (grid) => {
            const state = getSorting(grid)!
            return { toggleSort: state.toggleSort, setSort: state.setSort }
        },
        pipelineStage: {
            order: PIPELINE_ORDER.sort,
            transform: (nodes, grid) => {
                const state = getSorting(grid)
                if (!state) return nodes
                return sortNodes(
                    nodes,
                    grid.columns.all.map((column) => column.def),
                    state.sort
                )
            }
        }
    }
}

export function getSorting<TRow>(grid: GridState<TRow>): Sorting<TRow> | undefined {
    return grid.feature<Sorting<TRow>>(SORTING)
}
