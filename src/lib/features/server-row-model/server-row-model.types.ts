import type { FilterGroup } from '../advanced-filter/index.js'
import {
    type FilterRequest,
    type RowMeta,
    type RowNode,
    type SortState
} from '../../core/types/index.js'

/**
 * What the grid asks the server for. Matches PLAN §3.3: one descriptor covers
 * paging, infinite scroll and group expansion, so a data source has a single
 * entry point to implement.
 */
export interface GetRowsRequest {
    /** First row index wanted, inclusive. */
    startRow: number
    /** Last row index wanted, exclusive. */
    endRow: number
    sortModel: SortState[]
    /**
     * The filter in its normalized wire shape: every column is a list of
     * conditions and a join, whichever shorthand the grid held internally. A
     * server implementation therefore handles exactly one shape, and keeps
     * doing so as the client-side model grows.
     */
    filterModel: FilterRequest
    /**
     * Values identifying the group being expanded, outermost first. Empty at
     * the top level.
     */
    groupKeys: unknown[]
    /** Columns being grouped by, outermost first. Empty when not grouping. */
    groupBy: string[]
    /**
     * The advanced filter's tree, when the grid has one and it is not empty.
     *
     * Separate from `filterModel` because it is a different shape: nested
     * groups with a join per level and a `not` flag, which the per-column wire
     * format cannot express. A backend that does not read it simply ignores
     * it, and the grid says the filter is unapplied rather than pretending.
     */
    advancedFilter?: FilterGroup
}

export interface GetRowsResult<TRow> {
    rows: TRow[]
    /**
     * Total rows matching the request, ignoring the row window. Omit while the
     * total is unknown - infinite scroll keeps loading until a short block
     * tells it where the end is.
     */
    rowCount?: number
}

export interface DataSource<TRow> {
    getRows(request: GetRowsRequest): Promise<GetRowsResult<TRow>>
}

export type ServerMode = 'paged' | 'infinite'

export interface ServerRowModelOptions<TRow> {
    /**
     * `'paged'` fetches one page per request and pairs with `pagination()`.
     * `'infinite'` fetches fixed-size blocks as the viewport moves and pairs
     * with `virtualization()`.
     *
     * @default 'paged'
     */
    mode?: ServerMode

    /**
     * Rows per request in infinite mode. Larger blocks mean fewer requests and
     * more rows discarded on a jump.
     *
     * @default 100
     */
    blockSize?: number

    /**
     * Blocks kept in memory in infinite mode. The oldest are evicted first, so
     * scrolling through a million rows does not accumulate them all.
     *
     * @default 20
     */
    maxBlocks?: number

    /**
     * Builds the placeholder shown while a row is still loading. Receives the
     * absolute row index.
     */
    placeholder?: (index: number) => TRow

    /** Columns the server is grouping by, outermost first. */
    groupBy?: string[]

    /**
     * Marks which rows are group rows and at what depth, so the kernel renders
     * the chevron, the indent and treegrid ARIA. Rows arrive already grouped
     * from the server, so nothing is grouped locally.
     */
    getRowMeta?: (row: TRow) => RowMeta | undefined

    /**
     * The group keys identifying a group row, outermost first, for a server
     * that fetches a group's children on demand. Given, expanding a group row
     * asks the source for its children instead of assuming they are loaded.
     */
    groupKeysOf?: (node: RowNode<TRow>) => unknown[]

    /**
     * Which loaded rows belong to a group row, so collapsing it can drop them.
     * Read only when `groupKeysOf` is given.
     */
    isChildOf?: (node: RowNode<TRow>) => (row: TRow) => boolean

    /** Called when a request rejects, for logging or a toast. */
    onError?: (error: unknown, request: GetRowsRequest) => void
}

export interface FetchAllOptions {
    /**
     * Rows per request while walking the whole set. Deliberately independent of
     * the page size the user is browsing at: a 25-row page over 50 000 rows
     * would otherwise mean two thousand round trips.
     *
     * @default 5000
     */
    batchSize?: number

    /**
     * Called after each batch. `total` is `null` until the source reports a
     * `rowCount`, which infinite sources may never do.
     */
    onProgress?: (loaded: number, total: number | null) => void
}
