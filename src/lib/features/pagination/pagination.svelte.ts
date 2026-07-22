import type { GridState } from '../../core/grid.svelte.js'
import { PIPELINE_ORDER } from '../../core/pipeline.svelte.js'
import type { GridFeature } from '../../core/types.js'
import { paginateNodes } from './paginate.js'

export const PAGINATION = 'pagination'

export interface PaginationOptions {
    pageSize?: number
    page?: number
    /**
     * Total rows held by the server. Setting it switches to server-side
     * paging: `data` carries only the current page, so the pipeline stops
     * slicing and the page count comes from this number instead. Update it
     * through `setRowCount` as responses arrive.
     */
    rowCount?: number
}

export class Pagination<TRow> {
    page = $state(1)
    pageSize = $state<number | null>(null)
    rowCount = $state<number | null>(null)

    #grid: GridState<TRow>

    constructor(grid: GridState<TRow>, options: PaginationOptions) {
        this.#grid = grid
        this.page = options.page ?? 1
        this.pageSize = options.pageSize ?? null
        this.rowCount = options.rowCount ?? null

        grid.events.on('sortChanged', () => {
            this.page = 1
        })
        grid.events.on('filterChanged', () => {
            this.page = 1
        })
    }

    /** True when the server owns paging and `data` is a single page. */
    get server(): boolean {
        return this.rowCount !== null
    }

    /** Rows across every page — what the footer counts against. */
    get total(): number {
        return this.rowCount ?? this.#grid.totalRows
    }

    get pageCount(): number {
        if (!this.pageSize) return 1
        return Math.max(1, Math.ceil(this.total / this.pageSize))
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

    /**
     * Reports the server's total. Clamps the page when the total shrinks
     * under it — deleting the last row of the last page must not strand the
     * user on an empty page.
     */
    setRowCount = (rowCount: number | null): void => {
        this.rowCount = rowCount
        if (this.page > this.pageCount) this.setPage(this.pageCount)
    }
}

export function pagination<TRow>(options: PaginationOptions = {}): GridFeature<TRow> {
    return {
        id: PAGINATION,
        createState: (grid) => new Pagination(grid, options),
        createApi: (grid) => {
            const state = getPagination(grid)!
            return {
                setPage: state.setPage,
                setPageSize: state.setPageSize,
                setRowCount: state.setRowCount
            }
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
                // In server mode the data already is the page.
                if (!state || state.server) return nodes
                return paginateNodes(nodes, state.page, state.pageSize)
            }
        }
    }
}

export function getPagination<TRow>(grid: GridState<TRow>): Pagination<TRow> | undefined {
    return grid.feature<Pagination<TRow>>(PAGINATION)
}
