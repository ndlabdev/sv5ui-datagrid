import type { GridState } from '../../core/grid.svelte.js'
import { PIPELINE_ORDER } from '../../core/pipeline.svelte.js'
import type { ColumnFilter, FilterModel, GridFeature } from '../../core/types.js'
import { distinctValuesCached } from './distinct-values.js'
import { compileColumnFilters } from './filter-predicates.js'
import { quickFilterNodes } from './quick-filter.js'

export const FILTERING = 'filtering'

export interface FilteringOptions {
    initialQuick?: string
    initialColumns?: Record<string, ColumnFilter>
}

export class Filtering<TRow> {
    quick = $state('')
    columnFilters = $state.raw<Record<string, ColumnFilter>>({})
    filterFor = $state<string | null>(null)

    #grid: GridState<TRow>

    columnPredicate = $derived.by(() =>
        compileColumnFilters(this.#grid.columns.leafDefs, this.columnFilters)
    )
    activeCount = $derived(Object.keys(this.columnFilters).length)

    constructor(grid: GridState<TRow>, options: FilteringOptions) {
        this.#grid = grid
        this.quick = options.initialQuick ?? ''
        this.columnFilters = { ...(options.initialColumns ?? {}) }
    }

    get model(): FilterModel {
        return { quick: this.quick, columns: { ...this.columnFilters } }
    }

    #emit(): void {
        this.#grid.events.emit('filterChanged', { filter: this.model })
    }

    setQuickFilter = (query: string): void => {
        this.quick = query
        this.#emit()
    }

    setColumnFilter = (columnId: string, filter: ColumnFilter | null): void => {
        const next = { ...this.columnFilters }
        if (filter === null) delete next[columnId]
        else next[columnId] = filter
        this.columnFilters = next
        this.#emit()
    }

    clearColumnFilters = (): void => {
        this.columnFilters = {}
        this.#emit()
    }

    getFilterModel = (): FilterModel => this.model

    applyFilterModel = (model: FilterModel): void => {
        this.quick = model.quick ?? ''
        this.columnFilters = { ...(model.columns ?? {}) }
        this.#emit()
    }

    distinctFor(columnId: string) {
        const def = this.#grid.columns.leafDefs.find((candidate) => candidate.id === columnId)
        if (!def) return []
        return distinctValuesCached(this.#grid.sourceNodes, def)
    }
}

export function filtering<TRow>(options: FilteringOptions = {}): GridFeature<TRow> {
    return {
        id: FILTERING,
        createState: (grid) => new Filtering(grid, options),
        createApi: (grid) => {
            const state = getFiltering(grid)!
            return {
                setQuickFilter: state.setQuickFilter,
                setColumnFilter: state.setColumnFilter,
                clearColumnFilters: state.clearColumnFilters,
                getFilterModel: state.getFilterModel,
                applyFilterModel: state.applyFilterModel
            }
        },
        pipelineStage: {
            order: PIPELINE_ORDER.filter,
            transform: (nodes, grid) => {
                const state = getFiltering(grid)
                if (!state) return nodes
                const quickFiltered = quickFilterNodes(
                    nodes,
                    grid.columns.visible.map((column) => column.def),
                    state.quick
                )
                const predicate = state.columnPredicate
                return predicate ? quickFiltered.filter(predicate) : quickFiltered
            }
        }
    }
}

export function getFiltering<TRow>(grid: GridState<TRow>): Filtering<TRow> | undefined {
    return grid.feature<Filtering<TRow>>(FILTERING)
}
