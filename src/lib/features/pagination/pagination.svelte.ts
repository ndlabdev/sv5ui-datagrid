import type { GridState } from '../../core/grid/grid.svelte.js'
import { PIPELINE_ORDER } from '../../core/grid/pipeline.svelte.js'
import type { GridFeature } from '../../core/types/index.js'
import { mutator } from '../../core/utils/reactivity.js'
import { paginateNodes } from './paginate.js'

export const PAGINATION = 'pagination'

export interface PaginationOptions {
    pageSize?: number
    page?: number
    /** The server's total under `rowModel: 'server'`; set via `setRowCount`. */
    rowCount?: number
}

export class Pagination<TRow> {
    pageSize = $state<number | null>(null)
    rowCount = $state<number | null>(null)

    #page = $state(1)
    #grid: GridState<TRow>

    /** Clamped on read: rows can disappear without going through `setPage`,
     * and a page past the end would strand the user on empty rows. */
    get page(): number {
        return Math.min(this.#page, this.pageCount)
    }

    set page(value: number) {
        this.#page = value
    }

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
        return this.#grid.rowModel === 'server'
    }

    /** Rows across every page — what the footer counts against. */
    get total(): number {
        return this.rowCount ?? this.#grid.totalRows
    }

    get pageCount(): number {
        if (!this.pageSize) return 1
        return Math.max(1, Math.ceil(this.total / this.pageSize))
    }

    #emit(page: number): void {
        this.#grid.events.emit('pageChanged', { page, pageSize: this.pageSize })
    }

    // `mutator` throughout: `pageCount` reaches `grid.totalRows` and so the
    // whole pipeline, and a caller must not be subscribed to it. See its doc.
    setPage = mutator((page: number): void => {
        this.#page = Math.min(Math.max(1, page), this.pageCount)
        this.#emit(this.#page)
    })

    setPageSize = mutator((pageSize: number | null): void => {
        this.pageSize = pageSize
        this.#page = 1
        this.#emit(1)
    })

    /** The page clamps on read, so this only stores and announces. */
    setRowCount = mutator((rowCount: number | null): void => {
        this.rowCount = rowCount
        if (this.#page > this.pageCount) this.setPage(this.pageCount)
    })
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
                if (!state || state.server) return nodes
                return paginateNodes(nodes, state.page, state.pageSize)
            }
        }
    }
}

export function getPagination<TRow>(grid: GridState<TRow>): Pagination<TRow> | undefined {
    return grid.feature<Pagination<TRow>>(PAGINATION)
}
