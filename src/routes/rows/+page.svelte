<script lang="ts">
    import { Badge, Button, Container, Kbd, Link, ThemeModeButton } from 'sv5ui'
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        filtering,
        getRowPinning,
        PIPELINE_ORDER,
        rowPinning,
        sorting,
        virtualization,
        type ColumnDef,
        type DataGridCellContext,
        type DataGridFullWidthContext,
        type GridFeature,
        type RowNode
    } from '$lib/index.js'

    interface Order {
        id: number
        customer: string
        country: string
        status: 'paid' | 'pending' | 'refunded'
        total: number
        items: { sku: string; name: string; qty: number; price: number }[]
    }

    const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan', 'Fiona', 'George', 'Hana']
    const lastNames = ['Nguyen', 'Tran', 'Le', 'Pham', 'Vo', 'Dang', 'Ho', 'Bui']
    const countries = ['VN', 'US', 'DE', 'JP', 'SG', 'AU']
    const products = ['Keyboard', 'Mouse', 'Monitor', 'Dock', 'Headset', 'Webcam', 'Hub', 'Stand']
    const statuses: Order['status'][] = ['paid', 'pending', 'refunded']

    const ROWS = 10_000
    const orders: Order[] = Array.from({ length: ROWS }, (_, i) => {
        const items = Array.from({ length: (i % 4) + 1 }, (_, j) => ({
            sku: `SKU-${i + 1}-${j + 1}`,
            name: products[(i + j) % 8],
            qty: (j % 3) + 1,
            price: 20 + ((i + j) % 50) * 5
        }))
        return {
            id: i + 1,
            customer: `${firstNames[i % 8]} ${lastNames[Math.floor(i / 8) % 8]}`,
            country: countries[i % 6],
            status: statuses[i % 3],
            total: items.reduce((sum, item) => sum + item.qty * item.price, 0),
            items
        }
    })

    const money = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    })

    const statusColors = { paid: 'success', pending: 'warning', refunded: 'error' } as const

    const columns: ColumnDef<Order>[] = [
        { id: 'id', header: '#', sortable: true, align: 'right', width: 90 },
        { id: 'customer', header: 'Customer', sortable: true, flex: 1, minWidth: 200 },
        { id: 'country', header: 'Country', sortable: true, width: 110 },
        { id: 'status', header: 'Status', sortable: true, width: 130, cell: statusCell },
        {
            id: 'items',
            header: 'Items',
            align: 'right',
            width: 100,
            accessor: (order) => order.items.length
        },
        {
            id: 'total',
            header: 'Total',
            sortable: true,
            align: 'right',
            width: 130,
            cell: moneyCell
        }
    ]

    function expandableOrders(): GridFeature<Order> {
        return {
            id: 'demo-expand',
            createState: (grid) => {
                grid.expansion.enabled = true
                return {}
            },
            pipelineStage: {
                order: PIPELINE_ORDER.flatten,
                transform: (nodes, grid) =>
                    nodes.flatMap((node): RowNode<Order>[] => {
                        const parent = { ...node, meta: { expandable: true, level: 0 } }
                        if (!grid.expansion.isExpanded(node.id)) return [parent]
                        return [
                            parent,
                            {
                                id: `${node.id}:detail`,
                                row: node.row,
                                index: node.index,
                                meta: { fullWidth: true, level: 1 }
                            }
                        ]
                    })
            }
        }
    }

    const DETAIL_HEIGHT = 168

    const grid = createDataGrid<Order>({
        data: orders,
        columns,
        getRowId: (order) => String(order.id),
        features: [
            filtering(),
            sorting(),
            expandableOrders(),
            virtualization({
                getRowHeight: (node) => (node.meta?.fullWidth ? DETAIL_HEIGHT : 40)
            })
        ]
    })

    function expandAllVisible() {
        grid.expansion.expandAll(grid.preWindowNodes.map((node) => node.id))
    }

    interface Metric {
        id: number
        name: string
        value: number
        note: string
    }

    const metrics: Metric[] = [
        { id: 1, name: 'Grand total', value: 128_450, note: 'Aggregate of every region' },
        ...Array.from({ length: 40 }, (_, i) => ({
            id: i + 2,
            name: `Region ${String.fromCharCode(65 + (i % 26))}${i > 25 ? i : ''}`,
            value: 1000 + ((i * 517) % 9000),
            note: ['On track', 'Needs review', 'Ahead of plan'][i % 3]
        })),
        { id: 42, name: 'Average', value: 3210, note: 'Simple mean across regions' }
    ]

    const metricColumns: ColumnDef<Metric>[] = [
        { id: 'name', header: 'Name', sortable: true, flex: 1, minWidth: 160 },
        {
            id: 'value',
            header: 'Value',
            sortable: true,
            align: 'right',
            width: 140,
            cell: metricMoneyCell
        },
        { id: 'note', header: 'Note', flex: 1, minWidth: 180 }
    ]

    function valueHeatmap(): GridFeature<Metric> {
        const highest = Math.max(...metrics.map((metric) => metric.value))
        return {
            id: 'demo-heatmap',
            cellDecoration: ({ column, node }) =>
                column.id === 'value'
                    ? {
                          style: {
                              'background-color': `color-mix(in oklab, var(--color-primary) ${Math.round((node.row.value / highest) * 40)}%, transparent)`
                          }
                      }
                    : undefined
        }
    }

    const metricGrid = createDataGrid<Metric>({
        data: metrics,
        columns: metricColumns,
        getRowId: (metric) => String(metric.id),
        features: [
            filtering(),
            sorting(),
            columnOps(),
            valueHeatmap(),
            rowPinning({
                isRowPinned: (metric) =>
                    metric.name === 'Grand total'
                        ? 'top'
                        : metric.name === 'Average'
                          ? 'bottom'
                          : null
            }),
            virtualization({ rowHeight: 40 })
        ]
    })
    const metricPinning = getRowPinning(metricGrid)!
</script>

{#snippet statusCell({ value }: DataGridCellContext<Order>)}
    <Badge
        label={String(value)}
        color={statusColors[value as Order['status']] ?? 'surface'}
        size="sm"
    />
{/snippet}

{#snippet moneyCell({ value }: DataGridCellContext<Order>)}
    {money.format(Number(value))}
{/snippet}

{#snippet metricMoneyCell({ value }: DataGridCellContext<Metric>)}
    {money.format(Number(value))}
{/snippet}

{#snippet orderDetail({ row }: DataGridFullWidthContext<Order>)}
    <div class="flex h-full flex-col gap-2">
        <div class="flex items-center gap-2 text-sm font-medium text-on-surface">
            Order #{row.id} — {row.customer}
            <Badge label={row.country} size="xs" />
        </div>
        <table class="w-fit text-xs">
            <thead>
                <tr class="text-left text-on-surface-variant">
                    <th class="pr-6 font-medium">SKU</th>
                    <th class="pr-6 font-medium">Product</th>
                    <th class="pr-6 text-right font-medium">Qty</th>
                    <th class="pr-6 text-right font-medium">Price</th>
                    <th class="text-right font-medium">Subtotal</th>
                </tr>
            </thead>
            <tbody>
                {#each row.items as item (item.sku)}
                    <tr>
                        <td class="pr-6 font-mono">{item.sku}</td>
                        <td class="pr-6">{item.name}</td>
                        <td class="pr-6 text-right">{item.qty}</td>
                        <td class="pr-6 text-right">{money.format(item.price)}</td>
                        <td class="text-right">{money.format(item.qty * item.price)}</td>
                    </tr>
                {/each}
            </tbody>
        </table>
        <div class="text-xs text-on-surface-variant">
            Total {money.format(row.total)} · {row.items.length} line items
        </div>
    </div>
{/snippet}

<Container class="space-y-10 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Row structures — Phase 6</h1>
            <p class="text-sm text-on-surface-variant">
                Row-structure kernel (RowMeta · ExpansionModel · treegrid ARIA · full-width rows) +
                row pinning. Grouping/tree/master-detail hoàn chỉnh thuộc Pro — demo dưới dùng đúng
                extension points công khai mà Pro sẽ dùng.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <section class="space-y-3">
        <div class="space-y-1">
            <h2 class="text-lg font-medium text-on-surface">
                Expandable rows + virtualization ({ROWS.toLocaleString()} orders)
            </h2>
            <p class="text-xs text-on-surface-variant">
                Feature inline ~20 dòng qua pipeline stage <code>flatten</code> — detail full-width
                cao {DETAIL_HEIGHT}px, Fenwick variable heights.
            </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" label="Expand all" onclick={expandAllVisible} />
            <Button
                variant="outline"
                size="sm"
                label="Collapse all"
                onclick={grid.expansion.collapseAll}
            />
        </div>
        <DataGrid {grid} toolbar fullWidthRow={orderDetail} class="h-110" />
        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
            <span>Focus cột đầu rồi:</span>
            <span><Kbd size="sm">→</Kbd> mở</span>
            <span><Kbd size="sm">←</Kbd> đóng / nhảy về hàng cha</span>
            <span><Kbd size="sm">Enter</Kbd> toggle</span>
        </div>
    </section>

    <section class="space-y-3">
        <div class="space-y-1">
            <h2 class="text-lg font-medium text-on-surface">Row pinning</h2>
            <p class="text-xs text-on-surface-variant">
                Grand total pinned top · Average pinned bottom — pinned rows bỏ qua sort/filter.
                Chuột phải một hàng để pin/unpin.
            </p>
        </div>
        <DataGrid grid={metricGrid} toolbar class="h-90" />
        <div class="text-xs text-on-surface-variant">
            Pinned: {metricPinning.topNodes.length} top · {metricPinning.bottomNodes.length} bottom
        </div>
    </section>
</Container>
