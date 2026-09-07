import ServerRows from './ServerRows.svelte'
import { type GridState, LOADING_KEY, PIPELINE_ORDER } from '../../core/grid/index.js'
import { type GridFeature, type RowNode } from '../../core/types/index.js'
import { getFiltering, toFilterRequest } from '../../features/filtering/index.js'
import { getPagination } from '../../features/pagination/index.js'
import { getSorting } from '../../features/sorting/index.js'
import { getAdvancedFilter } from '../advanced-filter/index.js'
import { blockBounds, blocksFor, blocksIn, blocksToEvict, totalFromShortBlock } from './blocks.js'
import { createLoadedBlocks } from './loaded-blocks.js'
import type {
    DataSource,
    GetRowsRequest,
    FetchAllOptions,
    ServerMode,
    ServerRowModelOptions
} from './server-row-model.types.js'

const SERVER_ROW_MODEL = 'serverRowModel'

const DEFAULT_BLOCK_SIZE = 100
const DEFAULT_MAX_BLOCKS = 20
const DEFAULT_FETCH_ALL_BATCH = 5_000

export class ServerRowModel<TRow> {
    loading = $state(false)
    answered = $state(false)
    error = $state<string | null>(null)

    rowCount = $state<number | null>(null)

    readonly mode: ServerMode
    readonly blockSize: number
    readonly maxBlocks: number

    #grid: GridState<TRow>
    #source: DataSource<TRow>
    #options: ServerRowModelOptions<TRow>

    readonly groupKeysOf: ServerRowModelOptions<TRow>['groupKeysOf']
    readonly isChildOf: ServerRowModelOptions<TRow>['isChildOf']
    #blocks = createLoadedBlocks()

    #generation = 0
    #inFlight = 0

    constructor(
        grid: GridState<TRow>,
        source: DataSource<TRow>,
        options: ServerRowModelOptions<TRow>
    ) {
        this.#grid = grid
        this.#source = source
        this.#options = options
        this.groupKeysOf = options.groupKeysOf
        this.isChildOf = options.isChildOf
        this.mode = options.mode ?? 'paged'
        this.blockSize = options.blockSize ?? DEFAULT_BLOCK_SIZE
        this.maxBlocks = options.maxBlocks ?? DEFAULT_MAX_BLOCKS

        if (grid.rowModel !== 'server') {
            throw new Error(
                "serverRowModel needs createDataGrid({ rowModel: 'server' }): without it " +
                    'the grid filters and sorts the page again on the client, over rows ' +
                    'the server already filtered and sorted.'
            )
        }

        if (this.mode === 'infinite' && !options.placeholder) {
            throw new Error(
                'serverRowModel({ mode: "infinite" }) needs a placeholder option: ' +
                    'it builds the rows shown while a block loads, and getRowId must ' +
                    'return a unique id for them.'
            )
        }

        for (const event of ['sortChanged', 'filterChanged'] as const) {
            grid.events.on(event, () => this.refresh())
        }
        if (this.mode === 'paged') {
            grid.events.on('pageChanged', () => void this.#loadPage())
        }
    }

    #request(startRow: number, endRow: number, groupKeys: unknown[] = []): GetRowsRequest {
        const filtering = getFiltering(this.#grid)
        const tree = getAdvancedFilter(this.#grid)?.model

        return {
            ...(tree && tree.children.length > 0 ? { advancedFilter: tree } : {}),
            startRow,
            endRow,
            sortModel: getSorting(this.#grid)?.sort ?? [],
            filterModel: toFilterRequest(
                filtering?.model ?? { quick: '', columns: {} },
                this.#grid.columns.visible.map((column) => column.id)
            ),
            groupKeys,
            groupBy: this.#options.groupBy ?? []
        }
    }

    async #fetch(request: GetRowsRequest, generation: number) {
        this.#inFlight += 1
        this.loading = true
        try {
            const result = await this.#source.getRows(request)

            return generation === this.#generation ? result : null
        } catch (error) {
            if (generation === this.#generation) {
                this.error = error instanceof Error ? error.message : String(error)
                this.#options.onError?.(error, request)
            }
            return null
        } finally {
            this.#inFlight -= 1
            if (this.#inFlight === 0) {
                this.loading = false
                this.answered = true
            }
        }
    }

    refresh = (): void => {
        this.#generation += 1
        this.#blocks.clear()
        this.error = null
        this.answered = false
        this.rowCount = null
        this.#grid.data = []

        const pagination = getPagination(this.#grid)
        if (this.mode === 'paged') {
            if (pagination) pagination.setRowCount(null)
            void this.#loadPage()
            return
        }
        void this.#loadBlock(0)
    }

    async #loadPage(): Promise<void> {
        const pagination = getPagination(this.#grid)
        const pageSize = pagination?.pageSize ?? this.blockSize
        const page = pagination?.page ?? 1
        const startRow = (page - 1) * pageSize

        const generation = ++this.#generation
        const result = await this.#fetch(this.#request(startRow, startRow + pageSize), generation)
        if (!result) return

        this.#grid.data = result.rows
        if (result.rowCount !== undefined) {
            this.rowCount = result.rowCount
            pagination?.setRowCount(result.rowCount)
        }
    }

    async #loadBlock(block: number): Promise<void> {
        if (this.#blocks.has(block)) return
        this.#blocks.add(block)

        const { start, end } = blockBounds(block, this.blockSize)
        const generation = this.#generation
        const result = await this.#fetch(this.#request(start, end), generation)
        if (!result) {
            this.#blocks.remove(block)
            return
        }

        const discovered = totalFromShortBlock(block, result.rows.length, this.blockSize)
        const before = this.rowCount
        if (result.rowCount !== undefined) this.rowCount = result.rowCount
        else if (discovered !== null) this.rowCount = discovered

        if (this.rowCount !== null && this.rowCount !== before) {
            this.#grid.events.emit('rowCountChanged', { total: this.rowCount })
        }

        this.#writeBlock(start, result.rows)
    }

    #writeBlock(start: number, rows: TRow[]): void {
        const total = this.rowCount ?? start + rows.length
        const next = this.#grid.data.slice()
        next.length = total

        for (let i = 0; i < rows.length && start + i < total; i++) next[start + i] = rows[i]!
        for (let i = 0; i < total; i++) {
            if (next[i] === undefined) next[i] = this.#placeholder(i)
        }
        this.#grid.data = next
    }

    #placeholder(index: number): TRow {
        return { ...this.#options.placeholder!(index), [LOADING_KEY]: true }
    }

    #lastPage(received: number, pageSize: number, loaded: number, total: number | null): boolean {
        if (received < pageSize) return true
        return total !== null && loaded >= total
    }

    fetchAll = async (options: FetchAllOptions = {}): Promise<TRow[]> => {
        const { onProgress } = options
        const pageSize = Math.max(1, options.batchSize ?? DEFAULT_FETCH_ALL_BATCH)
        const generation = this.#generation
        const all: TRow[] = []

        for (;;) {
            const result = await this.#fetch(
                this.#request(all.length, all.length + pageSize),
                generation
            )
            if (!result) break

            for (const row of result.rows) all.push(row)
            const total = result.rowCount ?? this.rowCount
            onProgress?.(all.length, total)

            if (this.#lastPage(result.rows.length, pageSize, all.length, total)) break
        }

        return all
    }

    ensureRange = (startRow: number, endRow: number): void => {
        if (this.mode !== 'infinite') return

        const range = blocksFor(startRow, endRow, this.blockSize)
        for (const block of blocksIn(range)) void this.#loadBlock(block)

        const evicted = blocksToEvict(this.#blocks.list(), range, this.maxBlocks)
        if (evicted.length === 0) return

        const next = this.#grid.data.slice()
        for (const block of evicted) {
            this.#blocks.remove(block)
            const { start, end } = blockBounds(block, this.blockSize)
            for (let i = start; i < Math.min(end, next.length); i++) {
                next[i] = this.#placeholder(i)
            }
        }
        this.#grid.data = next
    }

    start = (): void => {
        if (this.#grid.data.length > 0 || this.#blocks.list().length > 0) return
        this.refresh()
    }

    expandGroup = async (node: RowNode<TRow>, groupKeys: unknown[]): Promise<void> => {
        const generation = this.#generation
        const result = await this.#fetch(this.#request(0, this.blockSize, groupKeys), generation)
        if (!result) return

        const index = this.#grid.data.findIndex((row) => this.#grid.getRowId(row) === node.id)
        if (index < 0) return

        const next = this.#grid.data.slice()
        next.splice(index + 1, 0, ...result.rows)
        this.#grid.data = next
    }

    collapseGroup = (node: RowNode<TRow>, isChild: (row: TRow) => boolean): void => {
        const index = this.#grid.data.findIndex((row) => this.#grid.getRowId(row) === node.id)
        if (index < 0) return

        let end = index + 1
        while (end < this.#grid.data.length && isChild(this.#grid.data[end]!)) end++
        if (end === index + 1) return

        const next = this.#grid.data.slice()
        next.splice(index + 1, end - index - 1)
        this.#grid.data = next
    }
}

export function serverRowModel<TRow>(
    source: DataSource<TRow>,
    options: ServerRowModelOptions<TRow> = {}
): GridFeature<TRow> {
    return {
        id: SERVER_ROW_MODEL,
        component: ServerRows,
        createState: (grid) => new ServerRowModel(grid, source, options),
        createApi: (grid) => {
            const state = getServerRowModel(grid)!
            return {
                refreshServerRows: state.refresh,
                ensureServerRange: state.ensureRange,
                fetchAllServerRows: state.fetchAll
            }
        },
        pipelineStage: options.getRowMeta
            ? {
                  order: PIPELINE_ORDER.group,
                  transform: (nodes) =>
                      nodes.map((node) => {
                          const meta = options.getRowMeta!(node.row)
                          return meta ? { ...node, meta } : node
                      })
              }
            : undefined
    }
}

export function getServerRowModel<TRow>(grid: GridState<TRow>): ServerRowModel<TRow> | undefined {
    return grid.feature<ServerRowModel<TRow>>(SERVER_ROW_MODEL)
}

declare module '../../core/types/api.js' {
    interface GridApi {
        refreshServerRows?: () => void
        ensureServerRange?: (startRow: number, endRow: number) => void
        fetchAllServerRows?: (options?: FetchAllOptions) => Promise<unknown[]>
    }
}
