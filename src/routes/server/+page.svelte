<script lang="ts">
    import { onMount } from 'svelte'
    import { Badge, Button, Container, Kbd, Link, ThemeModeButton } from 'sv5ui'
    import {
        createDataGrid,
        DataGrid,
        filtering,
        getFiltering,
        getPagination,
        getSelection,
        getSorting,
        pagination,
        selection,
        sorting,
        type ColumnDef,
        type DataGridCellContext,
        type SortState
    } from '$lib/index.js'

    interface Order {
        id: number
        customer: string
        status: string
        total: number
    }

    const customers = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan', 'Fiona', 'George', 'Hana']
    const statuses = ['paid', 'pending', 'refunded']

    const database: Order[] = Array.from({ length: 137 }, (_, i) => ({
        id: i + 1,
        customer: `${customers[i % 8]} #${i + 1}`,
        status: statuses[i % 3],
        total: 50 + ((i * 37) % 950)
    }))

    /**
     * Stands in for the API. It sorts, filters and slices, and hands back one
     * page — the grid never sees the other 127 rows.
     */
    async function fetchPage(request: {
        page: number
        pageSize: number
        sort: SortState[]
        quick: string
    }): Promise<{ rows: Order[]; total: number }> {
        await new Promise((resolve) => setTimeout(resolve, 250))

        const query = request.quick.trim().toLowerCase()
        let rows = query
            ? database.filter((order) =>
                  `${order.id} ${order.customer} ${order.status}`.toLowerCase().includes(query)
              )
            : database
        for (const entry of [...request.sort].reverse()) {
            const key = entry.columnId as keyof Order
            const sign = entry.direction === 'desc' ? -1 : 1
            rows = [...rows].sort((a, b) => (a[key] > b[key] ? sign : a[key] < b[key] ? -sign : 0))
        }

        const start = (request.page - 1) * request.pageSize
        return { rows: rows.slice(start, start + request.pageSize), total: rows.length }
    }

    const columns: ColumnDef<Order>[] = [
        { id: 'id', header: '#', sortable: true, align: 'right', width: 80 },
        { id: 'customer', header: 'Customer', sortable: true, flex: 1, minWidth: 180 },
        { id: 'status', header: 'Status', sortable: true, width: 130, cell: statusCell },
        {
            id: 'total',
            header: 'Total',
            sortable: true,
            align: 'right',
            width: 120,
            cell: moneyCell
        }
    ]

    const grid = createDataGrid<Order>({
        data: [],
        columns,
        getRowId: (order) => String(order.id),
        rowModel: 'server',
        features: [
            sorting(),
            filtering(),
            selection(),
            pagination({ pageSize: 10, rowCount: database.length })
        ]
    })

    const paginationState = getPagination(grid)!
    const selectionState = getSelection(grid)!
    const sortingState = getSorting(grid)!
    const filteringState = getFiltering(grid)!

    const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })

    // True from the first frame: the page renders on the server with no rows
    // and a request already owed, so an empty grid would tell the user there
    // is no data for as long as that request takes.
    let loading = $state(true)
    let fetches = $state(0)
    let inFlight = 0

    /**
     * Driven by events, not by an effect: `pagination.page` clamps against the
     * row count on read, so an effect reading it and then calling
     * `setRowCount` would feed itself. The events fire after the feature has
     * settled — `pageChanged` reports the page the grid actually moved to, and
     * pagination resets to page 1 on a sort or filter before this runs.
     */
    async function load(): Promise<void> {
        const ticket = ++inFlight
        loading = true
        fetches += 1

        const { rows, total } = await fetchPage({
            page: paginationState.page,
            pageSize: paginationState.pageSize ?? 10,
            sort: sortingState.sort,
            quick: filteringState.quick
        })
        // A page the user has already navigated away from must not land.
        if (ticket !== inFlight) return
        grid.data = rows
        paginationState.setRowCount(total)
        loading = false
    }

    let eventLog = $state<string[]>([])

    function log(entry: string) {
        eventLog = [entry, ...eventLog].slice(0, 8)
    }

    grid.events.on('pageChanged', ({ page }) => {
        log(`pageChanged { page: ${page} }`)
        void load()
    })
    grid.events.on('sortChanged', ({ sort }) => {
        const entries = sort.map((entry) => `${entry.columnId} ${entry.direction}`)
        log(`sortChanged { ${entries.join(', ') || 'none'} }`)
        void load()
    })
    grid.events.on('filterChanged', ({ filter }) => {
        log(`filterChanged { "${filter.quick}" }`)
        void load()
    })
    grid.events.on('selectionChanged', ({ selectedIds }) =>
        log(`selectionChanged { ${selectedIds.length} ids }`)
    )

    onMount(load)
</script>

{#snippet statusCell({ value }: DataGridCellContext<Order>)}
    <Badge
        label={String(value)}
        color={value === 'paid' ? 'success' : value === 'pending' ? 'warning' : 'error'}
        size="sm"
    />
{/snippet}

{#snippet moneyCell({ value }: DataGridCellContext<Order>)}
    {money.format(Number(value))}
{/snippet}

<Container class="space-y-6 py-10">
    <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Server row model + selection</h1>
            <p class="text-sm text-on-surface-variant">
                <code>rowModel: 'server'</code> — grid chỉ giữ đúng một trang, sort/filter/paging do "API"
                giả lập (250ms) làm. Chọn hàng ở trang 2 rồi sang trang khác: selection theo row id nên
                vẫn còn.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/server/big">Big data →</Link>
            <Link href="/server/infinite">Infinite scroll →</Link>
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
        <Button
            variant="outline"
            size="sm"
            label="Go to page 2"
            onclick={() => paginationState.setPage(2)}
        />
        <Button
            variant="outline"
            size="sm"
            label="Go to page 5"
            onclick={() => paginationState.setPage(5)}
        />
        <Button
            variant="ghost"
            size="sm"
            label="Clear selection"
            disabled={selectionState.count === 0}
            onclick={selectionState.clear}
        />
        <span data-testid="server-state" class="text-xs text-on-surface-variant">
            page {paginationState.page}/{paginationState.pageCount} · {grid.nodes.length} rows loaded
            · {paginationState.total} total · {selectionState.count} selected · {fetches} fetches
        </span>
    </div>

    <DataGrid {grid} toolbar {loading} />

    <div class="rounded-lg border border-outline-variant p-3">
        <p class="mb-1 text-xs font-medium text-on-surface-variant">grid.events</p>
        {#if eventLog.length === 0}
            <p class="text-xs text-on-surface-variant">Chưa có event nào.</p>
        {:else}
            <ul class="space-y-0.5 font-mono text-xs text-on-surface">
                {#each eventLog as entry, index (index)}
                    <li>{entry}</li>
                {/each}
            </ul>
        {/if}
    </div>

    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
        <span>Kiểm tra:</span>
        <span>Sang trang 2 rồi bấm một ô bất kỳ — trang phải đứng yên, không nhảy về 1</span>
        <span><Kbd size="sm">↓</Kbd> hết trang cũng không đổi trang (server tự phân trang)</span>
        <span>Bấm vào khoảng trống trong cột checkbox vẫn chọn được hàng</span>
    </div>
</Container>
