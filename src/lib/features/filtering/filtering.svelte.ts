import type { GridState } from '../../core/grid.svelte.js'
import { PIPELINE_ORDER } from '../../core/pipeline.svelte.js'
import type { FilterModel, GridFeature } from '../../core/types.js'
import { quickFilterNodes } from './quick-filter.js'

export const FILTERING = 'filtering'

export interface FilteringOptions {
    initialQuick?: string
}

export class Filtering<TRow> {
    quick = $state('')

    #grid: GridState<TRow>

    constructor(grid: GridState<TRow>, initialQuick: string) {
        this.#grid = grid
        this.quick = initialQuick
    }

    get model(): FilterModel {
        return { quick: this.quick }
    }

    setQuickFilter = (query: string): void => {
        this.quick = query
        this.#grid.events.emit('filterChanged', { filter: this.model })
    }
}

export function filtering<TRow>(options: FilteringOptions = {}): GridFeature<TRow> {
    return {
        id: FILTERING,
        createState: (grid) => new Filtering(grid, options.initialQuick ?? ''),
        createApi: (grid) => {
            const state = getFiltering(grid)!
            return { setQuickFilter: state.setQuickFilter }
        },
        pipelineStage: {
            order: PIPELINE_ORDER.filter,
            transform: (nodes, grid) => {
                const state = getFiltering(grid)
                if (!state) return nodes
                return quickFilterNodes(
                    nodes,
                    grid.columns.visible.map((column) => column.def),
                    state.quick
                )
            }
        }
    }
}

export function getFiltering<TRow>(grid: GridState<TRow>): Filtering<TRow> | undefined {
    return grid.feature<Filtering<TRow>>(FILTERING)
}
