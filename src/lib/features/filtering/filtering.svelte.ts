import { type GridState, PIPELINE_ORDER } from '../../core/grid/index.js'
import type { ColumnFilterEntry, FilterModel, GridFeature } from '../../core/types/index.js'
import { mutator } from '../../core/utils/index.js'
import { distinctValuesCached } from './distinct-values.js'
import { compileColumnFilters } from './filter-predicates.js'
import { quickFilterNodes } from './quick-filter.js'

export const FILTERING = 'filtering'

export interface FilteringOptions {
    initialQuick?: string
    initialColumns?: Record<string, ColumnFilterEntry>
}

export class Filtering<TRow> {
    quick = $state('')
    columnFilters = $state.raw<Record<string, ColumnFilterEntry>>({})
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

    setQuickFilter = mutator((query: string): void => {
        this.quick = query
        this.#emit()
    })

    setColumnFilter = mutator((columnId: string, filter: ColumnFilterEntry | null): void => {
        const next = { ...this.columnFilters }
        if (filter === null) delete next[columnId]
        else next[columnId] = filter
        this.columnFilters = next
        this.#emit()
    })

    clearColumnFilters = mutator((): void => {
        this.columnFilters = {}
        this.#emit()
    })

    getFilterModel = (): FilterModel => this.model

    applyFilterModel = mutator((model: FilterModel): void => {
        this.quick = model.quick ?? ''
        this.columnFilters = { ...(model.columns ?? {}) }
        this.#emit()
    })

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
        serialize: (grid) => {
            const model = getFiltering(grid)?.model
            if (!model) return undefined
            const active = model.quick !== '' || Object.keys(model.columns).length > 0
            return active ? model : undefined
        },
        hydrate: (slice, grid) => {
            if (slice && typeof slice === 'object') {
                getFiltering(grid)?.applyFilterModel(slice as FilterModel)
            }
        },
        pipelineStage: {
            order: PIPELINE_ORDER.filter,
            transform: (nodes, grid) => {
                const state = getFiltering(grid)
                // Server mode: the rows arrived filtered; filtering again would
                // drop rows the server deliberately returned.
                if (!state || grid.rowModel === 'server') return nodes
                const quickFiltered = quickFilterNodes(
                    nodes,
                    grid.columns.visible.map((column) => column.def),
                    state.quick,
                    // The same locale the cells are drawn with, or the search
                    // would be against text nobody is looking at.
                    grid.locale
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

declare module '../../core/types/api.js' {
    interface GridApi {
        setQuickFilter?: (query: string) => void
        setColumnFilter?: (columnId: string, filter: ColumnFilterEntry | null) => void
        clearColumnFilters?: () => void
        getFilterModel?: () => FilterModel
        applyFilterModel?: (model: FilterModel) => void
    }
}
