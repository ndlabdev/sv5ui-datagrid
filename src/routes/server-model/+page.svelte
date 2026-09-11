<script lang="ts">
    import {
        createDataGrid,
        DataGrid,
        editing,
        filtering,
        getPagination,
        pagination,
        sorting,
        virtualization,
        type ColumnDef,
        type DataGridCellContext,
        type GridState
    } from '$lib/index.js'
    import { Button, Container, Link, Skeleton, ThemeModeButton } from 'sv5ui'
    import {
        getServerRowModel,
        Grid,
        isLoadingRow,
        rangeSelection,
        serverRowModel,
        type DataSource,
        type GetRowsRequest
    } from '$lib/index.js'
    import { buildGridXlsx, buildGridXlsxAsync } from '$lib/xlsx.js'

    interface Order {
        id: number
        customer: string
        region: string
        total: number
        placedAt: string
        level?: number
    }

    const regions = ['North', 'South', 'East', 'West']
    const names = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan', 'Fiona', 'George', 'Hana']

    const table: Order[] = Array.from({ length: 50_000 }, (_, i) => ({
        id: i + 1,
        customer: `${names[i % 8]} ${1000 + (i % 900)}`,
        region: regions[i % 4]!,
        total: 120 + ((i * 37) % 9_000),
        placedAt: new Date(Date.UTC(2025, i % 12, (i % 27) + 1)).toISOString()
    }))

    let latency = $state(180)
    let requestLog = $state<string[]>([])

    function log(request: GetRowsRequest, rows: number) {
        const scope = request.groupKeys.length > 0 ? ` group=${request.groupKeys.join('/')}` : ''
        requestLog = [
            `${request.startRow}-${request.endRow}${scope} | sort=${request.sortModel.length} | q="${request.filterModel.quick}" → ${rows} rows`,
            ...requestLog
        ].slice(0, 6)
    }

    function applyQuery(rows: Order[], request: GetRowsRequest): Order[] {
        const quick = request.filterModel.quick.trim().toLowerCase()
        let result = quick
            ? rows.filter(
                  (row) =>
                      row.customer.toLowerCase().includes(quick) ||
                      row.region.toLowerCase().includes(quick)
              )
            : rows

        for (const { columnId, direction } of [...request.sortModel].reverse()) {
            const sign = direction === 'asc' ? 1 : -1
            result = [...result].sort((a, b) => {
                const left = a[columnId as keyof Order]
                const right = b[columnId as keyof Order]
                if (left === right) return 0
                return (left! < right! ? -1 : 1) * sign
            })
        }
        return result
    }

    function createSource(): DataSource<Order> {
        return {
            async getRows(request) {
                await new Promise((resolve) => setTimeout(resolve, latency))
                const matched = applyQuery(table, request)
                const rows = matched.slice(request.startRow, request.endRow)
                log(request, rows.length)
                return { rows, rowCount: matched.length }
            }
        }
    }

    const columns: ColumnDef<Order>[] = [
        { id: 'id', header: '#', sortable: true, align: 'right', width: 90 },
        { id: 'customer', header: 'Customer', sortable: true, width: 200 },
        { id: 'region', header: 'Region', sortable: true, type: 'badge', width: 130 },
        {
            id: 'total',
            header: 'Total',
            sortable: true,
            type: 'currency',
            align: 'right',
            width: 130
        },
        { id: 'placedAt', header: 'Placed', sortable: true, type: 'date', width: 150 }
    ]

    const editableColumns: ColumnDef<Order>[] = columns.map((column) =>
        column.id === 'customer' || column.id === 'total'
            ? {
                  ...column,
                  editable: true,
                  parse: (input: unknown) =>
                      column.id === 'total'
                          ? input === null || input === ''
                              ? null
                              : Number(input)
                          : input
              }
            : column
    )

    const pagedGrid: GridState<Order> = createDataGrid<Order>({
        columns: editableColumns,
        data: [],
        getRowId: (order) => String(order.id),
        rowModel: 'server',
        features: [
            sorting(),
            filtering(),
            pagination({ pageSize: 25 }),
            editing(),
            serverRowModel(createSource(), { mode: 'paged' }),
            rangeSelection()
        ]
    })

    const infiniteColumns: ColumnDef<Order>[] = editableColumns.map((column) => ({
        ...column,
        cell: loadingAwareCell
    }))

    const infiniteGrid: GridState<Order> = createDataGrid<Order>({
        columns: infiniteColumns,
        data: [],
        getRowId: (order) => String(order.id),
        rowModel: 'server',
        features: [
            sorting(),
            virtualization({ rowHeight: 40, overscan: 6 }),
            editing(),
            serverRowModel(createSource(), {
                mode: 'infinite',
                blockSize: 200,
                placeholder: (index) => ({ id: -(index + 1) }) as Order
            }),
            rangeSelection()
        ]
    })

    let exporting = $state(false)
    let exportProgress = $state(0)
    let exportNote = $state('')

    async function exportAll() {
        exporting = true
        exportProgress = 0
        exportNote = ''
        const started = performance.now()
        try {
            const bytes = await buildGridXlsxAsync(pagedGrid, {
                onProgress: (loaded, total) => {
                    exportProgress = total ? loaded / total : 0
                }
            })
            exportNote =
                `cả bộ: ${(bytes.byteLength / 1024).toFixed(0)} KB | ` +
                `${(performance.now() - started).toFixed(0)} ms`
        } finally {
            exporting = false
        }
    }

    function exportPage() {
        const bytes = buildGridXlsx(pagedGrid, { loadedOnly: true })
        exportNote = `chỉ trang: ${(bytes.byteLength / 1024).toFixed(0)} KB`
    }

    function exportSync() {
        try {
            buildGridXlsx(pagedGrid)
            exportNote = 'không ném lỗi - sai, hãy ghi vào KNOWN-ISSUES'
        } catch (error) {
            exportNote = `ném lỗi đúng như mong đợi: ${(error as Error).message.slice(0, 60)}...`
        }
    }

    const pagedModel = $derived(getServerRowModel(pagedGrid))
    const infiniteModel = $derived(getServerRowModel(infiniteGrid))
    const pageState = $derived(getPagination(pagedGrid))

    interface GroupRow extends Order {
        level: number
        count?: number
    }

    const groupSource: DataSource<Order> = {
        async getRows(request) {
            await new Promise((resolve) => setTimeout(resolve, latency))

            if (request.groupKeys.length === 0) {
                const rows = regions.map((region, index) => ({
                    id: -(index + 1),
                    customer: region,
                    region,
                    total: table
                        .filter((order) => order.region === region)
                        .reduce((sum, order) => sum + order.total, 0),
                    placedAt: '',
                    level: 0
                })) as GroupRow[]
                log(request, rows.length)
                return { rows, rowCount: rows.length }
            }

            const region = String(request.groupKeys[0])
            const rows = table
                .filter((order) => order.region === region)
                .slice(0, 20)
                .map((order) => ({ ...order, level: 1 }))
            log(request, rows.length)
            return { rows }
        }
    }

    const groupColumns: ColumnDef<Order>[] = [
        { id: 'customer', header: 'Region / Customer', width: 260 },
        { id: 'total', header: 'Total', type: 'currency', align: 'right', width: 150 },
        { id: 'placedAt', header: 'Placed', type: 'date', width: 150 }
    ]

    const groupGrid: GridState<Order> = createDataGrid<Order>({
        columns: groupColumns,
        data: [],
        getRowId: (order) => String(order.id),
        rowModel: 'server',
        features: [
            serverRowModel(groupSource, {
                groupBy: ['region'],
                getRowMeta: (order) =>
                    (order as GroupRow).level === 0 ? { level: 0, expandable: true } : { level: 1 },
                groupKeysOf: (node) => [node.row.region],
                isChildOf: () => (row) => (row as GroupRow).level === 1
            })
        ]
    })
</script>

{#snippet loadingAwareCell({ row, value }: DataGridCellContext<Order>)}
    {#if isLoadingRow(row)}
        <Skeleton class="h-3 w-16 rounded" />
    {:else}
        <span class="truncate">{value ?? ''}</span>
    {/if}
{/snippet}

<Container class="space-y-8 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">
                Server row model - @sv5ui/datagrid
            </h1>
            <p class="text-sm text-on-surface-variant">
                50 000 dòng nằm ở "server". Grid không lọc, không sắp xếp, không cắt trang - nó gửi <code
                    >GetRowsRequest</code
                > và render đúng cái nhận về.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2 text-xs">
        <span class="text-on-surface-variant">Độ trễ giả lập:</span>
        {#each [0, 180, 800] as ms (ms)}
            <Button
                variant={latency === ms ? 'solid' : 'outline'}
                size="xs"
                label={`${ms}ms`}
                onclick={() => (latency = ms)}
            />
        {/each}
        <Button
            variant="outline"
            size="xs"
            label="Refresh cả hai"
            onclick={() => {
                pagedModel?.refresh()
                infiniteModel?.refresh()
            }}
        />
    </div>

    <section class="space-y-3">
        <h2 class="text-lg font-medium text-on-surface">1. Phân trang phía server</h2>
        <p class="text-sm text-on-surface-variant">
            Đổi trang, sort hay gõ vào ô tìm kiếm đều sinh đúng một request. Tổng số dòng đến từ
            <code>rowCount</code>, nên footer biết có bao nhiêu trang mà không cần tải hết.
        </p>
        <DataGrid
            grid={pagedGrid}
            toolbar
            loading={pagedModel?.loading && pagedGrid.data.length === 0}
            error={pagedModel?.error}
            onRetry={() => pagedModel?.refresh()}
        />
        <Grid.RangeStatusBar grid={pagedGrid} />
        <p class="text-xs text-on-surface-variant">
            Chọn một vùng rồi <strong>Ctrl+X</strong>, đổi trang, và dán: lệnh cắt bị huỷ chứ không
            ghi vào những dòng khác đang nằm ở đúng vị trí đó. Vùng chọn đánh theo chỉ số hiển thị,
            nên sau khi đổi trang nó nằm trên dữ liệu khác - một lệnh cắt thì nhớ chính xác những
            dòng nó đã cắt, và từ chối khi chúng không còn ở đó.
        </p>
        <p class="text-xs text-on-surface-variant">
            {pageState?.total.toLocaleString() ?? 0} dòng trên server | trang {pageState?.page} / {pageState?.pageCount}
        </p>
    </section>

    <section class="space-y-3">
        <h2 class="text-lg font-medium text-on-surface">1b. Xuất file từ grid server</h2>
        <p class="text-sm text-on-surface-variant">
            Grid chỉ đang giữ một trang. <strong>Cả bộ</strong> phân trang qua đúng
            <code>getRows</code> ở trên - xem nhật ký request bên dưới dài ra trong lúc chạy.
        </p>
        <div class="flex flex-wrap items-center gap-2">
            <Button
                size="sm"
                variant="solid"
                icon="lucide:download"
                label="Tải cả bộ"
                disabled={exporting}
                onclick={exportAll}
            />
            <Button
                size="sm"
                variant="outline"
                label="Chỉ trang đang xem"
                disabled={exporting}
                onclick={exportPage}
            />
            <Button
                size="sm"
                variant="outline"
                label="Thử đường đồng bộ"
                disabled={exporting}
                onclick={exportSync}
            />
            {#if exportNote}
                <span class="text-xs text-on-surface-variant">{exportNote}</span>
            {/if}
        </div>
        {#if exporting}
            <div class="h-1 w-full overflow-hidden rounded-full bg-surface-container">
                <div
                    class="h-full rounded-full bg-primary transition-[width]"
                    style="width: {Math.round(exportProgress * 100)}%"
                ></div>
            </div>
        {/if}
    </section>

    <section class="space-y-3">
        <h2 class="text-lg font-medium text-on-surface">2. Infinite scroll theo block</h2>
        <p class="text-sm text-on-surface-variant">
            Cuộn nhanh xuống giữa danh sách: các dòng chưa tải hiện placeholder, block chứa chúng
            được yêu cầu, và block ở xa bị loại khỏi bộ nhớ.
        </p>
        <DataGrid grid={infiniteGrid} class="h-120" />
        <Grid.RangeStatusBar grid={infiniteGrid} />
        <p class="text-xs text-on-surface-variant">
            Chọn một vùng vắt qua mép đang tải rồi thử: copy ra ô trống chứ không ra số 0 của
            placeholder, và cut/move từ chối cả khi nguồn lẫn khi đích là dòng chưa tải. Một dòng
            chưa về thì không có giá trị để dời, và cũng không có chỗ để nhận.
        </p>
        <p class="text-xs text-on-surface-variant">
            {infiniteModel?.rowCount?.toLocaleString() ?? '?'} dòng | block 200 | đang tải: {infiniteModel?.loading
                ? 'có'
                : 'không'}
        </p>
    </section>

    <section class="space-y-3">
        <h2 class="text-lg font-medium text-on-surface">3. Mở nhóm phía server</h2>
        <p class="text-sm text-on-surface-variant">
            Server trả về hàng nhóm trước. Bấm chevron để lấy con của nhóm đó:
            <code>groupKeys</code> đi kèm request, và chỉ nhóm được mở mới tốn một chuyến đi.
        </p>
        <DataGrid grid={groupGrid} />
    </section>

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Nhật ký request</h2>
        <ul class="space-y-1 font-mono text-xs text-on-surface-variant">
            {#each requestLog as entry, i (`${i}-${entry}`)}
                <li>{entry}</li>
            {:else}
                <li>chưa có request nào</li>
            {/each}
        </ul>
    </section>
</Container>
