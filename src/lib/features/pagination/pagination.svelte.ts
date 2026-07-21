import type { GridState } from '../../core/grid.svelte.js'
import { PIPELINE_ORDER } from '../../core/pipeline.svelte.js'
import type { GridFeature } from '../../core/types.js'
import { paginateNodes } from './paginate.js'

export const PAGINATION = 'pagination'

export interface PaginationOptions {
    pageSize?: number
    page?: number
}

export class Pagination<TRow> {
    page = $state(1)
    pageSize = $state<number | null>(null)

    #grid: GridState<TRow>

    constructor(grid: GridState<TRow>, options: PaginationOptions) {
        this.#grid = grid
        this.page = options.page ?? 1
        this.pageSize = options.pageSize ?? null

        grid.events.on('sortChanged', () => {
            this.page = 1
        })
        grid.events.on('filterChanged', () => {
            this.page = 1
        })
    }

    get pageCount(): number {
        if (!this.pageSize) return 1
        return Math.max(1, Math.ceil(this.#grid.totalRows / this.pageSize))
    }

    setPage = (page: number): void => {
        this.page = Math.min(Math.max(1, page), this.pageCount)
        this.#grid.events.emit('pageChanged', { page: this.page, pageSize: this.pageSize })
    }

    setPageSize = (pageSize: number | null): void => {
        this.pageSize = pageSize
        this.page = 1
        this.#grid.events.emit('pageChanged', { page: this.page, pageSize })
    }
}

export function pagination<TRow>(options: PaginationOptions = {}): GridFeature<TRow> {
    return {
        id: PAGINATION,
        createState: (grid) => new Pagination(grid, options),
        createApi: (grid) => {
            const state = getPagination(grid)!
            return { setPage: state.setPage, setPageSize: state.setPageSize }
        },
        // Page size is a preference; the page number is not — restoring page 7
        // of a list the user has since filtered lands them nowhere.
        serialize: (grid) => getPagination(grid)?.pageSize ?? undefined,
        hydrate: (slice, grid) => {
            if (typeof slice === 'number') getPagination(grid)?.setPageSize(slice)
        },
        pipelineStage: {
            order: PIPELINE_ORDER.window,
            transform: (nodes, grid) => {
                const state = getPagination(grid)
                if (!state) return nodes
                return paginateNodes(nodes, state.page, state.pageSize)
            }
        }
    }
}

export function getPagination<TRow>(grid: GridState<TRow>): Pagination<TRow> | undefined {
    return grid.feature<Pagination<TRow>>(PAGINATION)
}
