import { kindsFor } from './kinds.js'
import type { FilterKind } from './operators.js'
import {
    type CellRead,
    gateReader,
    type GridState,
    isDataRow,
    PIPELINE_ORDER
} from '../../core/grid/index.js'
import { type ColumnDef, type GridFeature, type RowNode } from '../../core/types/index.js'
import { getFiltering } from '../../features/filtering/index.js'
import {
    countActive,
    countConditions,
    isEmptyModel,
    matchesNode,
    resolveColumns,
    sanitizeModel
} from './evaluate.js'
import type { AdvancedFilterOptions, FilterGroup, FilterNode } from './advanced-filter.types.js'

const ADVANCED_FILTER = 'advancedFilter'

const emptyModel = (): FilterGroup => ({ kind: 'group', join: 'and', children: [] })

const SERVER_REFUSAL =
    'advancedFilter() does not filter a grid on rowModel: "server": it could only test the ' +
    'rows already loaded, and the row count would keep counting the rest. The tree is still ' +
    'held and still serialized - read getAdvancedFilter(grid).model and send it to the server, ' +
    'which is the only side that can answer it.'

export class AdvancedFilter<TRow> {
    model = $state.raw<FilterGroup>(emptyModel())

    #grid: GridState<TRow>
    #onChange?: (model: FilterGroup) => void
    #alwaysKeep?: (node: RowNode<TRow>) => boolean
    #warned = false

    constructor(grid: GridState<TRow>, options: AdvancedFilterOptions<TRow>) {
        this.#grid = grid
        this.#onChange = options.onChange
        this.#alwaysKeep = options.alwaysKeep
        if (options.model) this.model = options.model
    }

    get isActive(): boolean {
        return !isEmptyModel(this.model)
    }

    get isApplied(): boolean {
        return this.isActive && this.#grid.rowModel !== 'server'
    }

    get conditionCount(): number {
        return countConditions(this.model)
    }

    get activeCount(): number {
        return countActive(this.model)
    }

    setModel = (model: FilterGroup): void => {
        this.model = sanitizeModel(model) ?? emptyModel()
        this.#grid.events.emit('filterChanged', {
            filter: getFiltering(this.#grid)?.model ?? { quick: '', columns: {} }
        })
        this.#onChange?.(this.model)
    }

    restore = (model: unknown): void => {
        this.model = sanitizeModel(model) ?? emptyModel()
    }

    clear = (): void => {
        this.setModel(emptyModel())
    }

    #defsForModel(): Map<string, ColumnDef<TRow>> {
        return resolveColumns(this.model, (columnId) => this.#grid.columns.get(columnId)?.def)
    }

    #matchesWith(
        node: RowNode<TRow>,
        defs: Map<string, ColumnDef<TRow>>,
        read: CellRead<TRow>,
        kinds: Map<string, FilterKind>
    ): boolean {
        if (this.#alwaysKeep?.(node) === true) return true
        if (!isDataRow(node)) return true

        return matchesNode(
            this.model,
            (columnId) => {
                const def = defs.get(columnId)
                return def ? read(node, def) : undefined
            },
            (columnId) => kinds.get(columnId) ?? 'text'
        )
    }

    matches = (node: RowNode<TRow>): boolean => {
        const defs = this.#defsForModel()
        const read = gateReader(this.#grid, 'search')
        const sample = this.#grid.preWindowNodes
        return this.#matchesWith(node, defs, read, kindsFor(sample, defs, read))
    }

    #refuseOnServer(): boolean {
        if (this.#grid.rowModel !== 'server') return false
        if (!this.#warned) {
            this.#warned = true
            // eslint-disable-next-line no-console
            console.warn(SERVER_REFUSAL)
        }
        return true
    }

    apply = (nodes: RowNode<TRow>[]): RowNode<TRow>[] => {
        if (!this.isActive || this.#refuseOnServer()) return nodes

        const defs = this.#defsForModel()
        const read = gateReader(this.#grid, 'search')
        const kinds = kindsFor(nodes, defs, read)
        return nodes.filter((node) => this.#matchesWith(node, defs, read, kinds))
    }
}

export function advancedFilter<TRow>(options: AdvancedFilterOptions<TRow> = {}): GridFeature<TRow> {
    return {
        id: ADVANCED_FILTER,
        createState: (grid) => new AdvancedFilter(grid, options),
        pipelineStage: {
            order: PIPELINE_ORDER.filter + 1,
            transform: (nodes, grid) => getAdvancedFilter(grid)?.apply(nodes) ?? nodes
        },
        createApi: (grid) => {
            const state = getAdvancedFilter(grid)!
            return {
                setAdvancedFilter: (model: unknown) => state.setModel(model as FilterGroup),
                getAdvancedFilter: () => state.model,
                isAdvancedFilterApplied: () => state.isApplied,
                clearAdvancedFilter: state.clear
            }
        },
        serialize: (grid) => {
            const state = getAdvancedFilter(grid)
            return state ? { model: state.model } : undefined
        },
        hydrate: (slice, grid) => {
            getAdvancedFilter(grid)?.restore((slice as { model?: unknown } | undefined)?.model)
        }
    }
}

export function getAdvancedFilter<TRow>(grid: GridState<TRow>): AdvancedFilter<TRow> | undefined {
    return grid.feature<AdvancedFilter<TRow>>(ADVANCED_FILTER)
}

declare module '../../core/types/api.js' {
    interface GridApi {
        setAdvancedFilter?: (model: unknown) => void
        getAdvancedFilter?: () => unknown
        isAdvancedFilterApplied?: () => boolean
        clearAdvancedFilter?: () => void
    }
}

export type { FilterNode }
