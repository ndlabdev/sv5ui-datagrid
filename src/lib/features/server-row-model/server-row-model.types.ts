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

    /**
     * The crossing the grid is being asked to show, when `pivot()` is
     * registered. The server answers it; the client never crosses a server
     * grid for itself, because a table measured over the blocks this client
     * happens to hold looks exactly like a correct one.
     *
     * `agg` carries only the named reductions, the strings `grouping()`
     * accepts. A function or a parameterised aggregation cannot cross the
     * wire, so the grid sends no pivot at all rather than one missing a
     * measure, and says so once in the console.
     *
     * A backend that does not read it returns its rows unpivoted, and the grid
     * draws them: `getPivot(grid).serverHandled` is what a UI reads to know
     * which of the two it is looking at.
     */
    pivot?: PivotRequest
}

/** The crossing `pivot()` asks a server for. */
export interface PivotRequest {
    /** Column ids gathered down the page, outermost first. */
    rows: string[]
    /** Column ids gathered across the page, outermost first. */
    columns: string[]
    /**
     * What each cell holds, in the order the grid will draw the measures.
     *
     * `per` names a second column to divide by, under the same reduction, so
     * `{ field: 'profit', agg: 'sum', per: 'revenue' }` asks for a margin. It
     * is the reductions that divide, not the rows.
     */
    values: { field: string; agg: string; per?: string }[]

    /**
     * Order the gathered rows by what a crossing measured, outermost sort
     * first. `keys` names the crossing the way `pivotColumns` does, and an
     * empty `keys` is the total column. Absent when the user has sorted by
     * nothing, or by a column that is not a crossing.
     */
    sort?: { keys: string[]; measure: number; direction: 'asc' | 'desc' }[]
}

export interface GetRowsResult<TRow> {
    rows: TRow[]
    /**
     * Total rows matching the request, ignoring the row window. Omit while the
     * total is unknown - infinite scroll keeps loading until a short block
     * tells it where the end is.
     */
    rowCount?: number

    /**
     * The crossings the server used, one key path per generated column, each
     * path holding one key per entry of `pivot.columns` and outermost first.
     * A single column field therefore sends single-element paths.
     *
     * Required to draw a pivot on a server grid: the client holds only the
     * blocks it has loaded, so it cannot learn the column axis from the data
     * the way it does on a client grid. Answer the same paths for every block
     * of one crossing, or the columns will move under the user as they scroll.
     *
     * Each returned row carries its crossings under a `pivot` property, nested
     * one level per column field and bottoming out in an array holding one
     * entry per measure, in the order `pivot.values` asked for them:
     *
     * ```
     * { region: 'North', pivot: { Q1: [180, 2], Q2: [150, 1] } }
     * ```
     *
     * Nested rather than keyed by a joined path, so a key containing the
     * separator cannot be read as two. A crossing the row has nothing for is
     * left out, and the cell draws empty.
     *
     * A `totalColumn` reads `pivotTotal` instead, one entry per measure, and
     * draws empty until the server answers it. It is a separate property
     * because the total is measured over the row's own data rather than over
     * any crossing, so it is not the sum of what sits beside it.
     */
    pivotColumns?: string[][]
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
