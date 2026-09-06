<script lang="ts">
    import {
        createDataGrid,
        filtering,
        sorting,
        type ColumnDef,
        type DataGridCellContext,
        type DataGridFullWidthContext,
        type GridState
    } from '$lib/index.js'
    import { Button, Container, Icon, Link, ThemeModeButton } from 'sv5ui'
    import { DataGrid, getMasterDetail, masterDetail, tree } from '$lib/index.js'
    import { downloadGridXlsx } from '$lib/xlsx.js'

    interface Entry {
        id: string
        name: string
        parent: string | null
        kind: 'folder' | 'file'
        size: number
        owner: string
    }

    const entries: Entry[] = [
        { id: 'src', name: 'src', parent: null, kind: 'folder', size: 0, owner: 'core' },
        { id: 'lib', name: 'lib', parent: 'src', kind: 'folder', size: 0, owner: 'core' },
        { id: 'core', name: 'core', parent: 'lib', kind: 'folder', size: 0, owner: 'core' },
        {
            id: 'grid',
            name: 'grid.svelte.ts',
            parent: 'core',
            kind: 'file',
            size: 12,
            owner: 'core'
        },
        {
            id: 'pipeline',
            name: 'pipeline.svelte.ts',
            parent: 'core',
            kind: 'file',
            size: 3,
            owner: 'core'
        },
        {
            id: 'features',
            name: 'features',
            parent: 'lib',
            kind: 'folder',
            size: 0,
            owner: 'features'
        },
        {
            id: 'tree',
            name: 'tree',
            parent: 'features',
            kind: 'folder',
            size: 0,
            owner: 'features'
        },
        {
            id: 'treeNodes',
            name: 'tree-nodes.ts',
            parent: 'tree',
            kind: 'file',
            size: 4,
            owner: 'features'
        },
        {
            id: 'md',
            name: 'master-detail',
            parent: 'features',
            kind: 'folder',
            size: 0,
            owner: 'features'
        },
        {
            id: 'detailNodes',
            name: 'detail-nodes.ts',
            parent: 'md',
            kind: 'file',
            size: 2,
            owner: 'features'
        },
        { id: 'tests', name: 'tests', parent: null, kind: 'folder', size: 0, owner: 'core' },
        { id: 'axe', name: 'axe.test.ts', parent: 'tests', kind: 'file', size: 6, owner: 'core' }
    ]

    const treeColumns: ColumnDef<Entry>[] = [
        { id: 'name', header: 'Name', width: 300, filter: 'text', cell: nameCell },
        { id: 'owner', header: 'Owner', type: 'badge', flex: 1, minWidth: 120 },
        {
            id: 'size',
            header: 'Size',
            align: 'right',
            width: 110,
            sortable: true,
            cell: sizeCell
        }
    ]

    const treeGrid: GridState<Entry> = createDataGrid<Entry>({
        columns: treeColumns,
        data: entries,
        getRowId: (entry) => entry.id,
        features: [
            sorting(),
            filtering(),
            tree({ getParentId: (entry) => entry.parent, defaultExpandedDepth: 1 })
        ]
    })

    interface Line {
        sku: string
        qty: number
        price: number
    }

    interface Order {
        id: number
        customer: string
        placedAt: string
        status: string
        lines: Line[]
    }

    const skus = ['DG-100', 'DG-220', 'MX-9', 'MX-31', 'KIT-4']
    const orders: Order[] = Array.from({ length: 8 }, (_, i) => ({
        id: 1000 + i,
        customer: ['Alice', 'Bob', 'Charlie', 'Diana'][i % 4]!,
        placedAt: new Date(Date.UTC(2026, 5, i + 1)).toISOString(),
        status: ['paid', 'pending', 'shipped'][i % 3]!,
        lines:
            i % 4 === 1
                ? []
                : Array.from({ length: (i % 3) + 1 }, (_, j) => ({
                      sku: skus[(i + j) % 5]!,
                      qty: ((i + j) % 4) + 1,
                      price: 40 + ((i * 17 + j * 9) % 260)
                  }))
    }))

    const orderColumns: ColumnDef<Order>[] = [
        { id: 'id', header: 'Order', align: 'right', width: 110 },
        { id: 'customer', header: 'Customer', flex: 1, minWidth: 180 },
        { id: 'status', header: 'Status', type: 'badge', width: 130 },
        { id: 'placedAt', header: 'Placed', type: 'date', width: 150 },
        {
            id: 'total',
            header: 'Total',
            type: 'currency',
            align: 'right',
            width: 130,
            accessor: totalOf
        }
    ]

    function totalOf(order: Order): number {
        return order.lines.reduce((sum, line) => sum + line.qty * line.price, 0)
    }

    const orderGrid: GridState<Order> = createDataGrid<Order>({
        columns: orderColumns,
        data: orders,
        getRowId: (order) => String(order.id),
        features: [sorting(), masterDetail({ hasDetail: (order) => order.lines.length > 0 })]
    })

    const singleGrid: GridState<Order> = createDataGrid<Order>({
        columns: orderColumns,
        data: orders,
        getRowId: (order) => String(order.id),
        features: [
            sorting(),
            masterDetail({ hasDetail: (order) => order.lines.length > 0, single: true })
        ]
    })

    const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
</script>

{#snippet nameCell({ row }: DataGridCellContext<Entry>)}
    <Icon
        name={row.kind === 'folder' ? 'lucide:folder' : 'lucide:file'}
        class="me-1.5 size-4 shrink-0 text-on-surface-variant"
    />
    <span class="truncate">{row.name}</span>
{/snippet}

{#snippet sizeCell({ row }: DataGridCellContext<Entry>)}
    {row.kind === 'folder' ? '-' : `${row.size} KB`}
{/snippet}

{#snippet lineItems({ row }: DataGridFullWidthContext<Order>)}
    <div class="space-y-2">
        <p class="text-xs font-medium text-on-surface-variant">
            {row.lines.length} dòng hàng | đơn {row.id}
        </p>
        <table class="w-full max-w-160 text-xs">
            <thead class="text-on-surface-variant">
                <tr>
                    <th class="py-1 text-start font-medium">SKU</th>
                    <th class="py-1 text-end font-medium">SL</th>
                    <th class="py-1 text-end font-medium">Đơn giá</th>
                    <th class="py-1 text-end font-medium">Thành tiền</th>
                </tr>
            </thead>
            <tbody>
                {#each row.lines as line (line.sku)}
                    <tr class="border-t border-outline-variant/60">
                        <td class="py-1 font-mono">{line.sku}</td>
                        <td class="py-1 text-end">{line.qty}</td>
                        <td class="py-1 text-end">{money.format(line.price)}</td>
                        <td class="py-1 text-end font-medium text-on-surface">
                            {money.format(line.qty * line.price)}
                        </td>
                    </tr>
                {/each}
            </tbody>
        </table>
    </div>
{/snippet}

<Container class="space-y-8 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">
                Tree data & master/detail - @sv5ui/datagrid
            </h1>
            <p class="text-sm text-on-surface-variant">
                Cả hai dựng trên đúng kernel row-structure của Community: chevron, thụt lề và ARIA
                <code>treegrid</code> đến từ <code>RowMeta</code>, không có mã render riêng.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <section class="space-y-3">
        <h2 class="text-lg font-medium text-on-surface">1. Tree data</h2>
        <p class="text-sm text-on-surface-variant">
            Dữ liệu là danh sách <em>phẳng</em> nối bằng <code>parentId</code>. Lọc "tree-nodes" rồi
            xem: dòng khớp vẫn hiện dù thư mục cha đã bị loại - con mồ côi được đôn lên gốc chứ
            không biến mất theo cha.
        </p>
        <div class="flex flex-wrap gap-2">
            <Button
                variant="outline"
                size="sm"
                label="Mở tất cả"
                onclick={() => (treeGrid.api.expandAllRows as () => void)()}
            />
            <Button
                variant="outline"
                size="sm"
                label="Thu tất cả"
                onclick={() => (treeGrid.api.collapseAllRows as () => void)()}
            />
        </div>
        <DataGrid grid={treeGrid} toolbar />
    </section>

    <section class="space-y-3">
        <h2 class="text-lg font-medium text-on-surface">2. Master / detail</h2>
        <p class="text-sm text-on-surface-variant">
            Panel là một hàng <code>fullWidth</code> bình thường, nên nó nằm trong luồng cuộn và trong
            ma trận bàn phím. Đơn không có dòng hàng thì không có chevron.
        </p>
        <div class="flex flex-wrap gap-2">
            <Button
                variant="outline"
                size="sm"
                label="Xuất XLSX"
                onclick={() =>
                    downloadGridXlsx(orderGrid, { filename: 'orders', sheetName: 'Orders' })}
            />
            <span class="text-xs text-on-surface-variant">
                Cột <code>currency</code> và <code>date</code> sang Excel đúng kiểu - mở ra sort và lọc
                được như số và ngày, không phải chữ.
            </span>
        </div>
        <DataGrid grid={orderGrid} fullWidthRow={lineItems} />
    </section>

    <section class="space-y-3">
        <div class="flex items-center justify-between">
            <h2 class="text-lg font-medium text-on-surface">3. Chỉ mở một panel</h2>
            <Button
                variant="outline"
                size="xs"
                label="Đóng hết"
                onclick={() => getMasterDetail(singleGrid)?.closeAll()}
            />
        </div>
        <p class="text-sm text-on-surface-variant">
            <code>single: true</code> - mở panel mới thì panel cũ tự đóng.
        </p>
        <DataGrid grid={singleGrid} fullWidthRow={lineItems} />
        <p class="text-xs text-on-surface-variant">
            Bấm chevron ở hai đơn khác nhau để thấy panel trước tự đóng.
        </p>
    </section>
</Container>
