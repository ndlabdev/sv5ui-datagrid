<script lang="ts">
    import { onMount, tick, untrack } from 'svelte'
    import { Button, Container, Link, Select, ThemeModeButton } from 'sv5ui'
    import {
        createDataGrid,
        DataGrid,
        filtering,
        getFiltering,
        getPagination,
        getSorting,
        pagination,
        selection,
        sorting,
        type ColumnDef,
        type SortState
    } from '$lib/index.js'

    interface Order {
        id: number
        customer: string
        region: string
        status: string
        total: number
    }

    const regions = ['North', 'South', 'East', 'West', 'Central']
    const statuses = ['paid', 'pending', 'refunded']

    /**
     * The backend, generated on demand. Ten million rows never exist at once —
     * only the page asked for does, which is the point being measured: what
     * the grid costs is a function of the page, not of the set behind it.
     */
    function rowAt(index: number): Order {
        return {
            id: index + 1,
            customer: `Customer ${(index * 7919) % 1_000_003}`,
            region: regions[index % 5],
            status: statuses[index % 3],
            total: 50 + ((index * 37) % 9950)
        }
    }

    /** How far a filtered fetch will read before giving up, as an index would. */
    const SCAN_CAP = 250_000

    interface Fetched {
        rows: Order[]
        total: number
        serverMs: number
        scanned: number
    }

    /** The unfiltered path: a slice, which is all a real backend would do. */
    function fetchSlice(page: number, pageSize: number, total: number, descending: boolean) {
        const rows: Order[] = []
        const start = (page - 1) * pageSize
        for (let offset = 0; offset < pageSize && start + offset < total; offset++) {
            const index = start + offset
            rows.push(rowAt(descending ? total - 1 - index : index))
        }
        return rows
    }

    /**
     * The filtered path, with no index behind it: this is what a table scan
     * costs the server. The grid is not in it — it receives `pageSize` rows
     * either way, which is what the panel above the grid separates out.
     */
    function fetchScan(
        request: { page: number; pageSize: number; total: number },
        descending: boolean,
        query: string
    ) {
        const { page, pageSize, total } = request
        const rows: Order[] = []
        const skip = (page - 1) * pageSize
        let matched = 0
        let scanned = 0
        for (let index = 0; index < total && scanned < SCAN_CAP; index++) {
            scanned++
            const row = rowAt(descending ? total - 1 - index : index)
            if (!row.customer.toLowerCase().includes(query)) continue
            matched++
            if (matched > skip && rows.length < pageSize) rows.push(row)
        }
        const estimated = scanned >= SCAN_CAP ? matched * Math.ceil(total / scanned) : matched
        return { rows, total: estimated, scanned }
    }

    function fetchPage(request: {
        page: number
        pageSize: number
        sort: SortState[]
        quick: string
        total: number
    }): Fetched {
        const started = performance.now()
        const { page, pageSize, total } = request
        const descending = request.sort.some((entry) => entry.direction === 'desc')
        const query = request.quick.trim().toLowerCase()

        if (!query) {
            const rows = fetchSlice(page, pageSize, total, descending)
            return { rows, total, serverMs: performance.now() - started, scanned: rows.length }
        }

        const scan = fetchScan({ page, pageSize, total }, descending, query)
        return { ...scan, serverMs: performance.now() - started }
    }

    const columns: ColumnDef<Order>[] = [
        { id: 'id', header: '#', sortable: true, align: 'right', width: 110 },
        { id: 'customer', header: 'Customer', sortable: true, flex: 1, minWidth: 200 },
        { id: 'region', header: 'Region', width: 120 },
        { id: 'status', header: 'Status', width: 120 },
        { id: 'total', header: 'Total', sortable: true, align: 'right', width: 120 }
    ]

    const grid = createDataGrid<Order>({
        data: [],
        columns,
        getRowId: (order) => String(order.id),
        rowModel: 'server',
        features: [sorting(), filtering(), selection(), pagination({ pageSize: 50 })]
    })

    const paginationState = getPagination(grid)!
    const sortingState = getSorting(grid)!
    const filteringState = getFiltering(grid)!

    const totals = [
        { label: '100,000 rows', value: '100000' },
        { label: '1,000,000 rows', value: '1000000' },
        { label: '10,000,000 rows', value: '10000000' }
    ]
    const pageSizes = [
        { label: '10 / page', value: '10' },
        { label: '50 / page', value: '50' },
        { label: '200 / page', value: '200' },
        { label: '1000 / page', value: '1000' }
    ]

    const latencies = [
        { label: 'no latency', value: '0' },
        { label: '150ms', value: '150' },
        { label: '600ms', value: '600' }
    ]

    let totalChoice = $state('1000000')
    let pageSizeChoice = $state('50')
    let latency = $state('0')

    let loading = $state(true)
    let serverMs = $state(0)
    let scanned = $state(0)
    let applyMs = $state(0)
    let paintMs = $state(0)
    let domRows = $state(0)
    let samples = $state<number[]>([])
    let inFlight = 0

    const average = $derived(
        samples.length === 0 ? 0 : samples.reduce((sum, value) => sum + value, 0) / samples.length
    )

    async function load(): Promise<void> {
        const ticket = ++inFlight
        loading = true

        const result = fetchPage({
            page: paginationState.page,
            pageSize: paginationState.pageSize ?? 50,
            sort: sortingState.sort,
            quick: filteringState.quick,
            total: Number(totalChoice)
        })
        const wait = Number(latency)
        if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait))
        if (ticket !== inFlight) return

        // From handing the page over to the rows being in the DOM: the only
        // part of the round trip the grid is responsible for.
        const started = performance.now()
        grid.data = result.rows
        paginationState.setRowCount(result.total)
        loading = false
        await tick()
        applyMs = performance.now() - started
        requestAnimationFrame(() => {
            paintMs = performance.now() - started
            domRows = document.querySelectorAll('[role="row"][data-dg-row-id]').length
        })

        serverMs = result.serverMs
        scanned = result.scanned
        samples = [...samples, applyMs].slice(-20)
    }

    grid.events.on('pageChanged', () => void load())
    grid.events.on('sortChanged', () => void load())
    grid.events.on('filterChanged', () => void load())

    async function hammer(): Promise<void> {
        samples = []
        const pages = paginationState.pageCount
        for (let step = 0; step < 20; step++) {
            paginationState.setPage(1 + ((step * 977) % pages))
            await load()
        }
    }

    // The controls drive the grid, never the other way round: reading the
    // pagination state here would tie the effect to the row count `load` sets.
    $effect(() => {
        const size = Number(pageSizeChoice)
        untrack(() => {
            if (paginationState.pageSize !== size) paginationState.setPageSize(size)
        })
    })

    $effect(() => {
        void totalChoice
        untrack(() => {
            samples = []
            if (paginationState.page !== 1) paginationState.setPage(1)
            else void load()
        })
    })

    onMount(load)
</script>

<Container class="space-y-6 py-10">
    <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Server row model — big data</h1>
            <p class="text-sm text-on-surface-variant">
                Backend sinh dòng theo yêu cầu, tối đa 10 triệu dòng, nhưng grid không bao giờ giữ
                quá một trang. Số đo dưới đây tách phần của server ra khỏi phần của grid.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/server">← Server demo</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-end gap-3">
        <div class="w-48">
            <Select items={totals} bind:value={totalChoice} aria-label="Backend size" />
        </div>
        <div class="w-40">
            <Select items={pageSizes} bind:value={pageSizeChoice} aria-label="Page size" />
        </div>
        <div class="w-40">
            <Select items={latencies} bind:value={latency} aria-label="Latency" />
        </div>
        <Button variant="outline" size="sm" label="Turn 20 pages" onclick={hammer} />
        <Button
            variant="ghost"
            size="sm"
            label="Jump to the last page"
            onclick={() => paginationState.setPage(paginationState.pageCount)}
        />
    </div>

    <dl
        data-testid="metrics"
        class="grid grid-cols-2 gap-3 rounded-lg border border-outline-variant p-3 text-sm sm:grid-cols-3 lg:grid-cols-6"
    >
        <div>
            <dt class="text-xs text-on-surface-variant">server</dt>
            <dd class="font-mono text-on-surface">{serverMs.toFixed(1)} ms</dd>
        </div>
        <div>
            <dt class="text-xs text-on-surface-variant">rows scanned</dt>
            <dd class="font-mono text-on-surface">{scanned.toLocaleString()}</dd>
        </div>
        <div>
            <dt class="text-xs text-on-surface-variant">grid → DOM</dt>
            <dd class="font-mono text-on-surface">{applyMs.toFixed(1)} ms</dd>
        </div>
        <div>
            <dt class="text-xs text-on-surface-variant">→ next frame</dt>
            <dd class="font-mono text-on-surface">{paintMs.toFixed(1)} ms</dd>
        </div>
        <div>
            <dt class="text-xs text-on-surface-variant">rows in the DOM</dt>
            <dd class="font-mono text-on-surface">{domRows}</dd>
        </div>
        <div>
            <dt class="text-xs text-on-surface-variant">avg of {samples.length}</dt>
            <dd class="font-mono text-on-surface">{average.toFixed(1)} ms</dd>
        </div>
    </dl>

    <DataGrid {grid} toolbar {loading} />

    <p class="text-xs text-on-surface-variant">
        Đổi backend size từ 100k lên 10M: <strong>grid → DOM</strong> không đổi, vì grid vẫn nhận
        đúng <em>page size</em> dòng. Đổi page size mới là thứ làm nó tăng — 1000 dòng một trang là
        1000 dòng trong DOM, và đó là lúc cần
        <Link href="/server/infinite">virtualization thay cho phân trang</Link>. Ô tìm kiếm chạy
        quét bảng không index phía "server", giới hạn {SCAN_CAP.toLocaleString()} dòng: cột
        <em>server</em> tăng theo, còn hai cột của grid thì không.
    </p>
</Container>
