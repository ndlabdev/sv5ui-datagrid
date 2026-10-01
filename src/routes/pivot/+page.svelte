<script lang="ts">
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        filtering,
        getGrouping,
        getPivot,
        getSorting,
        Grid,
        grouping,
        isPivotColumn,
        pivot,
        sorting,
        type RowNode
    } from '$lib/index.js'
    import { Badge, Button, Card, Container, Link, ThemeModeButton } from 'sv5ui'
    import { viVN } from '$lib/locales/index.js'
    import { columns, rowId, sales, salesWithQ4, type Sale } from './demo-data.js'

    type View = 'raw' | 'grouped' | 'pivot'

    const FIRST_DOWN = 'region'
    const FIRST_ACROSS = 'quarter'
    const FIELDS = ['region', 'quarter', 'product', 'shipped', 'size']
    const SIZE_ORDER = ['Small', 'Medium', 'Large']

    let view = $state<View>('raw')
    let grown = $state(false)
    let nested = $state(false)
    let ownKeys = $state(false)
    let drilled = $state<{ cell: string; rows: Sale[] } | null>(null)
    let saved = $state<unknown>(null)

    const data = $derived(grown ? salesWithQ4 : sales)

    const vietnamese = { locales: [viVN], locale: 'vi-VN' }

    const rawGrid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        ...vietnamese,
        features: [filtering(), sorting()]
    })

    const groupedGrid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        ...vietnamese,
        features: [
            sorting(),
            grouping<Sale>({
                by: [FIRST_DOWN],
                expandedByDefault: false,
                aggregations: { amount: 'sum' }
            })
        ]
    })

    const pivotGrid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        ...vietnamese,
        features: [
            columnOps(),
            sorting(),
            pivot<Sale>({
                rows: [FIRST_DOWN],
                columns: [FIRST_ACROSS],
                values: [{ field: 'amount', agg: 'sum' }],
                sortableColumns: true,
                get columnKeys() {
                    return ownKeys
                        ? (field: string) => (field === 'size' ? SIZE_ORDER : undefined)
                        : undefined
                }
            })
        ]
    })

    const grids = [rawGrid, groupedGrid, pivotGrid]

    $effect(() => {
        const rows = data
        for (const grid of grids) {
            if (grid.data !== rows) grid.data = rows
        }
    })

    const pivotState = () => getPivot(pivotGrid)!
    const down = $derived(getPivot(pivotGrid)?.rows[0] ?? '')
    const across = $derived(getPivot(pivotGrid)?.columns[0] ?? '')

    $effect(() => {
        groupedGrid.api.setGroupBy?.([down])
    })

    const setDown = (field: string) => pivotState().setRows([field])
    const setAcross = (field: string) =>
        pivotState().setColumns(nested ? [field, 'product'] : [field])
    const swap = () => {
        const [next, previous] = [across, down]
        pivotState().setRows([next])
        pivotState().setColumns([previous])
        nested = false
    }

    const toggleNested = () => {
        nested = !nested
        pivotState().setColumns(nested ? [across, 'product'] : [across])
    }

    const active = $derived(view === 'raw' ? rawGrid : view === 'grouped' ? groupedGrid : pivotGrid)

    const generated = $derived(pivotGrid.columns.visible.filter((c) => isPivotColumn(c.id)))

    const check = $derived.by(() => {
        const node = pivotGrid.preWindowNodes[0]
        const leaf = generated[0]
        const label = pivotGrid.columns.visible.find((c) => c.id === down)
        if (!node || !leaf || !label) return null

        const downKey = String(pivotGrid.getValue(node, label) ?? '')
        const acrossKey = String(leaf.def.header ?? '')
        const behind = data.filter(
            (sale) =>
                String(sale[down as 'region']) === downKey &&
                String(sale[across as 'quarter']) === acrossKey
        )
        if (behind.length === 0) return null

        return {
            downKey,
            acrossKey,
            count: behind.length,
            total: behind.reduce((sum, sale) => sum + sale.amount, 0)
        }
    })

    function columnAt(cell: Element): string | undefined {
        const at = Number(cell.getAttribute('data-dg-cell')?.split(':')[1])
        return Number.isInteger(at) ? pivotGrid.columns.visible[at]?.id : undefined
    }

    function onCellClick(event: MouseEvent) {
        const cell = (event.target as HTMLElement | null)?.closest('[data-dg-cell]')
        const nodeId = cell?.closest('[data-dg-row-id]')?.getAttribute('data-dg-row-id')
        if (!cell || !nodeId) return

        const columnId = columnAt(cell)
        if (!columnId || !isPivotColumn(columnId)) return

        const node = pivotGrid.preWindowNodes.find((candidate) => candidate.id === nodeId)
        if (node) drill(node, columnId)
    }

    function drill(node: RowNode<Sale>, columnId: string) {
        const behind = pivotState().rowsBehind(node, columnId)
        if (behind.length === 0) return

        const header = pivotGrid.columns.get(columnId)?.header ?? columnId
        drilled = { cell: String(header), rows: behind }
    }

    const views: { id: View; label: string; blurb: string }[] = [
        {
            id: 'raw',
            label: '1. Danh sách',
            blurb: 'Mỗi dòng một giao dịch. Đọc cả danh sách cũng không trả lời được câu hỏi nào, vì câu hỏi người ta có luôn là "cái gì theo cái gì".'
        },
        {
            id: 'grouped',
            label: '2. Gộp nhóm',
            blurb: 'grouping() gập danh sách theo một trường. Được một con số cho mỗi nhóm. Cột vẫn đúng những cột ứng dụng đã khai.'
        },
        {
            id: 'pivot',
            label: '3. Pivot',
            blurb: 'pivot() gập theo hai trường cùng lúc, một chạy dọc một chạy ngang. Cột ngang không có trong mã: lưới đọc dữ liệu rồi sinh ra chúng.'
        }
    ]

    const groups = [
        {
            name: 'Nền tảng',
            demos: [
                [
                    '/pivot/crossing',
                    'Phép giao',
                    'Hai trục và một measure, cột do lưới đọc dữ liệu mà sinh ra'
                ],
                ['/pivot/totals', 'Tổng đo từ dòng', 'Vì sao trung bình là 110 chứ không phải 120'],
                ['/pivot/total-row', 'Hàng tổng và cột tổng', 'Khép cả hai chiều về ô góc 1050']
            ]
        },
        {
            name: 'Trục cột',
            demos: [
                [
                    '/pivot/nested',
                    'Trục cột lồng nhau',
                    'Nhiều trường ngang, và tổng con từng nhánh'
                ],
                ['/pivot/folding', 'Gập nhánh cột', 'Gập về tổng con, hoặc về một dải hẹp'],
                ['/pivot/keys', 'Tự khai khoá cột', 'Thứ tự riêng, và cột chưa có dòng nào'],
                ['/pivot/ordering', 'Khoá xếp theo giá trị', 'Trục ngày chạy theo thời gian'],
                ['/pivot/max-columns', 'Trần số cột', 'Từ chối chứ không cắt bớt'],
                ['/pivot/order-columns', 'Sắp cột theo measure', 'Quý nào bán tốt nhất đứng trước']
            ]
        },
        {
            name: 'Measure',
            demos: [
                ['/pivot/measures', 'Nhiều measure', 'Mỗi phép giao tách thành nhiều lá'],
                ['/pivot/values-on-rows', 'Measure xếp dọc', 'Chặn trục cột nhân lên'],
                ['/pivot/shares', 'Đọc theo tỉ lệ', 'Phần trăm của hàng, của cột, của cả bảng'],
                ['/pivot/along-row', 'Đọc theo ô bên cạnh', 'Luỹ kế, chênh lệch, thứ hạng'],
                ['/pivot/ratio', 'Chia measure cho measure', 'Và vì sao không chia theo dòng']
            ]
        },
        {
            name: 'Người đọc làm gì với nó',
            demos: [
                [
                    '/pivot/keep-rows',
                    'Chỉ giữ hàng lớn nhất',
                    'Top N theo measure, tổng đo lại trên phần còn lại'
                ],
                ['/pivot/drill', 'Dòng sau một ô', 'Lối duy nhất đi xuống dữ liệu thô'],
                ['/pivot/panel', 'Bảng điều khiển', 'Tự dựng phép giao lúc đang chạy']
            ]
        }
    ]

    const activeView = $derived(views.find((entry) => entry.id === view)!)
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Pivot table</h1>
            <p class="text-sm text-on-surface-variant">
                Cùng {data.length} dòng ấy, xem ở ba dạng. Mười dòng để bạn cộng nhẩm kiểm lại được; với
                mười nghìn thì kết luận không đổi. Từng tính năng một nằm ở cuối trang.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/aggregate">Aggregation</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
        {#each views as entry (entry.id)}
            <Button
                variant={view === entry.id ? 'solid' : 'outline'}
                size="sm"
                label={entry.label}
                onclick={() => (view = entry.id)}
            />
        {/each}
    </div>

    <p
        class="rounded-lg border border-outline-variant bg-surface-container p-3 text-sm text-on-surface-variant"
    >
        {activeView.blurb}
    </p>

    {#if view === 'pivot'}
        <div class="flex flex-wrap items-center gap-3 text-sm">
            <span class="text-on-surface-variant">Chạy dọc:</span>
            {#each FIELDS as field (field)}
                <Button
                    variant={down === field ? 'solid' : 'outline'}
                    size="sm"
                    label={field}
                    disabled={across === field}
                    onclick={() => setDown(field)}
                />
            {/each}

            <Button variant="outline" size="sm" label="Đổi trục" onclick={swap} />

            <span class="text-on-surface-variant">Chạy ngang:</span>
            {#each FIELDS as field (field)}
                <Button
                    variant={across === field ? 'solid' : 'outline'}
                    size="sm"
                    label={field}
                    disabled={down === field}
                    onclick={() => setAcross(field)}
                />
            {/each}
        </div>

        <div class="flex flex-wrap items-center gap-2">
            <Button
                variant={nested ? 'solid' : 'outline'}
                size="sm"
                label="Lồng thêm Product ra ngang"
                onclick={toggleNested}
            />
            <Button
                variant={ownKeys ? 'solid' : 'outline'}
                size="sm"
                label="Tự khai khoá cho Size"
                disabled={across !== 'size'}
                onclick={() => (ownKeys = !ownKeys)}
            />
        </div>

        <Grid.PivotPanel grid={pivotGrid} />
    {/if}

    {#key view}
        {#if view === 'pivot'}
            <div ondblclick={onCellClick} role="presentation">
                <DataGrid grid={active} toolbar />
            </div>
        {:else}
            <DataGrid grid={active} toolbar />
        {/if}
    {/key}

    {#if view === 'pivot' && drilled}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4">
            <div class="flex items-center justify-between">
                <h2 class="text-sm font-medium text-on-surface">
                    {drilled.rows.length} dòng đứng sau ô {drilled.cell}
                </h2>
                <Button variant="ghost" size="sm" label="Đóng" onclick={() => (drilled = null)} />
            </div>
            <table class="w-full text-left text-xs" data-dg-drill>
                <tbody class="text-on-surface-variant">
                    {#each drilled.rows as row (row.id)}
                        <tr class="border-t border-outline-variant">
                            <td class="px-3 py-1">{row.region}</td>
                            <td class="px-3 py-1">{row.quarter}</td>
                            <td class="px-3 py-1">{row.product}</td>
                            <td class="px-3 py-1 text-right">{row.amount}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
            <p class="text-xs text-on-surface-variant">
                Bấm đúp một ô giao để mở những dòng đã đo thành con số ấy. Đây là câu hỏi đầu tiên
                người đọc đặt ra khi thấy một số lạ, và là lối duy nhất đi xuống dữ liệu thô: một
                hàng gom không mở ra được.
            </p>
        </div>
    {/if}

    {#if view === 'pivot'}
        <div class="space-y-3 rounded-lg border border-outline-variant p-4">
            <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-sm font-medium text-on-surface">Cột nào do dữ liệu sinh ra?</h2>
                <Button
                    variant={grown ? 'solid' : 'outline'}
                    size="sm"
                    label={grown ? 'Đã thêm dữ liệu Q4' : 'Thêm dữ liệu quý Q4'}
                    onclick={() => (grown = !grown)}
                />
            </div>

            <div class="flex flex-wrap gap-2 text-xs">
                <span class="text-on-surface-variant">Ứng dụng khai:</span>
                {#each columns as column (column.id)}
                    <Badge label={column.id} color="surface" size="sm" />
                {/each}
            </div>

            <div class="flex flex-wrap gap-2 text-xs">
                <span class="text-on-surface-variant">Lưới tự sinh:</span>
                {#each generated as column (column.id)}
                    <Badge label={String(column.def.header)} color="primary" size="sm" />
                {/each}
            </div>

            <p class="text-xs text-on-surface-variant">
                Hàng trên là danh sách cột trong mã, không đổi bao giờ. Hàng dưới là cột lưới tự tạo
                sau khi đọc {data.length} dòng. Bấm thêm dữ liệu Q4: hàng dưới mọc thêm một cột, hàng
                trên đứng yên. Đổi trục ngang sang <code>shipped</code> thì khoá xếp theo thời gian
                và vẽ qua bộ định dạng của cột nguồn; sang <code>size</code> thì mặc định là A tới Z,
                và nút tự khai khoá lấy lại thứ tự Small, Medium, Large.
            </p>
        </div>

        {#if check}
            <div class="space-y-2 rounded-lg border border-outline-variant p-4">
                <h2 class="text-sm font-medium text-on-surface">Cộng tay để đối chiếu</h2>
                <p class="text-xs text-on-surface-variant">
                    Ô đầu tiên, <code>{check.downKey}</code> giao <code>{check.acrossKey}</code>,
                    gom
                    <strong class="text-on-surface">{check.count}</strong> dòng và cộng thành
                    <strong class="text-on-surface">{check.total}</strong>. Con số này cộng thẳng từ
                    dữ liệu gốc, không đi qua lưới, nên nó lệch thì là thư viện sai.
                </p>
            </div>
        {/if}

        <div class="space-y-3 rounded-lg border border-outline-variant p-4">
            <h2 class="text-sm font-medium text-on-surface">Điều khiển lúc đang chạy</h2>
            <div class="flex flex-wrap items-center gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    label="Tắt pivot"
                    disabled={!pivotGrid.api.isPivoting?.()}
                    onclick={() => pivotGrid.api.clearPivot?.()}
                />
                <Button
                    variant="outline"
                    size="sm"
                    label="Bật lại"
                    disabled={pivotGrid.api.isPivoting?.()}
                    onclick={() => {
                        pivotGrid.api.setPivotRows?.([FIRST_DOWN])
                        pivotGrid.api.setPivotColumns?.([FIRST_ACROSS])
                    }}
                />
                <span class="w-4"></span>
                <Button
                    variant="outline"
                    size="sm"
                    label="Lưu view"
                    onclick={() => (saved = pivotGrid.api.getState?.())}
                />
                <Button
                    variant="outline"
                    size="sm"
                    label="Nạp lại view đã lưu"
                    disabled={saved === null}
                    onclick={() => {
                        if (saved !== null) pivotGrid.api.setState?.(saved as never)
                    }}
                />
            </div>
            <p class="text-xs text-on-surface-variant">
                Gỡ trường cuối cùng khỏi một trục thì phép giao tắt và lưới trở về danh sách phẳng,
                đó là hành vi đúng chứ không phải lỗi. Toàn bộ cấu hình đi vào ảnh chụp trạng thái,
                nên nạp lại view là dựng đúng bảng cũ.
            </p>
        </div>
    {/if}

    {#if view === 'grouped'}
        <div class="flex flex-wrap items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                label="Mở hết nhóm"
                onclick={() => getGrouping(groupedGrid)?.expandAllGroups()}
            />
            <Button
                variant="outline"
                size="sm"
                label="Gập hết"
                onclick={() => getGrouping(groupedGrid)?.collapseAllGroups()}
            />
            <Button
                variant="outline"
                size="sm"
                label="Bỏ sắp xếp"
                onclick={() => getSorting(groupedGrid)?.setSort([])}
            />
        </div>
        <p
            class="rounded-lg border border-outline-variant bg-surface-container p-3 text-xs text-on-surface-variant"
        >
            Mở hết nhóm ra và đếm: muốn biết mỗi vùng bán bao nhiêu ở từng quý, bạn phải gập thêm
            một tầng nữa rồi đọc từng dòng xếp dọc. So "North Q1" với "South Q1" thì phải cuộn đi
            tìm. Pivot xếp chúng thành một cột, đọc thẳng xuống.
        </p>
    {/if}
    <div class="space-y-4 border-t border-outline-variant pt-6">
        <div class="space-y-1">
            <h2 class="text-lg font-semibold text-on-surface">Từng tính năng một</h2>
            <p class="text-sm text-on-surface-variant">
                Mỗi trang dưới đây chỉ làm một việc và nói rõ việc ấy là gì. Tất cả dùng chung đúng
                {data.length} dòng trên kia, nên con số nào cũng cộng nhẩm kiểm lại được.
            </p>
        </div>

        {#each groups as group (group.name)}
            <section class="space-y-2">
                <h3 class="text-sm font-medium text-on-surface-variant">{group.name}</h3>
                <div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {#each group.demos as [href, title, what] (href)}
                        <Card class="space-y-0.5 p-3">
                            <Link {href} class="text-sm font-medium">{title}</Link>
                            <p class="text-xs text-on-surface-variant">{what}</p>
                        </Card>
                    {/each}
                </div>
            </section>
        {/each}
    </div>
</Container>
