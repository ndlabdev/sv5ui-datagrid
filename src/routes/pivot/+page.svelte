<script lang="ts">
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        filtering,
        getGrouping,
        getPivot,
        getSorting,
        grouping,
        isPivotColumn,
        pivot,
        sorting,
        type ColumnDef
    } from '$lib/index.js'
    import { Badge, Button, Container, Link, ThemeModeButton } from 'sv5ui'

    interface Sale {
        id: number
        region: string
        quarter: string
        product: string
        shipped: Date
        size: string
        amount: number
    }

    const regions = ['North', 'South', 'East', 'West']
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
    const products = ['Widget', 'Gadget', 'Doohickey']
    const sizes = ['Small', 'Medium', 'Large']
    const quarterMonth: Record<string, number> = { Q1: 0, Q2: 3, Q3: 6, Q4: 9, Q5: 11 }

    function makeSales(withQ5: boolean): Sale[] {
        const out: Sale[] = []
        let id = 1
        const periods = withQ5 ? [...quarters, 'Q5'] : quarters

        for (let index = 0; index < 600; index++) {
            const region = regions[index % 4]!
            const quarter = periods[Math.floor(index / 4) % periods.length]!
            const product = products[index % 3]!

            if (region === 'West' && quarter === 'Q4') continue
            if (product === 'Doohickey' && quarter !== 'Q1') continue

            out.push({
                id: id++,
                region,
                quarter,
                product,
                shipped: new Date(Date.UTC(2026, quarterMonth[quarter] ?? 0, 10)),
                size: sizes[index % 3]!,
                amount: 40 + ((index * 37) % 260)
            })
        }
        return out
    }

    const money = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    })

    const columns: ColumnDef<Sale>[] = [
        { id: 'region', header: 'Region', width: 130, filter: 'text' },
        { id: 'quarter', header: 'Quarter', width: 120, filter: 'text' },
        { id: 'product', header: 'Product', width: 150, filter: 'text' },
        { id: 'shipped', header: 'Shipped', type: 'date', width: 150 },
        { id: 'size', header: 'Size', width: 120, filter: 'text' },
        { id: 'amount', header: 'Amount', type: 'currency', flex: 1, minWidth: 140 }
    ]

    type View = 'raw' | 'grouped' | 'pivot'

    let view = $state<View>('raw')
    const FIRST_DOWN = 'region'
    const FIRST_ACROSS = 'quarter'

    let hasQ5 = $state(false)

    const initialSales = makeSales(false)
    const sales = $derived(hasQ5 ? makeSales(true) : initialSales)

    const rawGrid = createDataGrid<Sale>({
        data: initialSales,
        columns,
        getRowId: (sale) => String(sale.id),
        features: [filtering(), sorting()]
    })

    const groupedGrid = createDataGrid<Sale>({
        data: initialSales,
        columns,
        getRowId: (sale) => String(sale.id),
        features: [
            filtering(),
            sorting(),
            grouping<Sale>({
                by: [FIRST_DOWN],
                expandedByDefault: false,
                aggregations: { amount: 'sum' }
            })
        ]
    })

    const pivotGrid = createDataGrid<Sale>({
        data: initialSales,
        columns,
        getRowId: (sale) => String(sale.id),
        features: [
            filtering(),
            sorting(),
            columnOps(),
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

    const pivotState = () => getPivot(pivotGrid)!
    const down = $derived(getPivot(pivotGrid)?.rows[0] ?? '')
    const across = $derived(getPivot(pivotGrid)?.columns[0] ?? '')

    const grids = [rawGrid, groupedGrid, pivotGrid]

    $effect(() => {
        groupedGrid.api.setGroupBy?.([down])
    })

    $effect(() => {
        const rows = sales
        for (const grid of grids) {
            if (grid.data !== rows) grid.data = rows
        }
    })

    const active = $derived(view === 'raw' ? rawGrid : view === 'grouped' ? groupedGrid : pivotGrid)

    const fields = ['region', 'quarter', 'product', 'shipped', 'size']

    const SIZE_ORDER = ['Small', 'Medium', 'Large']

    let subtotals = $state(false)
    let foldable = $state(false)
    let totals = $state(false)
    let ownKeys = $state(false)
    let saved = $state<ReturnType<NonNullable<typeof pivotGrid.api.getState>> | null>(null)

    $effect(() => {
        const state = pivotState()
        state.setColumnSubtotal(subtotals ? (header: string) => `${header} tổng` : undefined)
        state.setColumnGroups(foldable ? 'open' : 'fixed')
        state.setTotalColumn(totals ? 'Tổng' : undefined)
        state.setTotalRow(totals ? 'Tất cả' : undefined)
    })

    const generatedHeaders = $derived(
        pivotGrid.columns.visible
            .filter((column) => isPivotColumn(column.id))
            .map((column) => String(column.def.header))
    )

    const nested = $derived((getPivot(pivotGrid)?.columns.length ?? 0) > 1)

    function setDown(field: string) {
        pivotGrid.api.setPivotRows?.([field])
    }

    function setAcross(field: string) {
        pivotGrid.api.setPivotColumns?.(nested ? [field, 'product'] : [field])
    }

    function toggleNested() {
        pivotGrid.api.setPivotColumns?.(nested ? [across] : [across, 'product'])
    }

    function swap() {
        const wasDown = down
        setDown(across)
        pivotGrid.api.setPivotColumns?.([wasDown])
    }

    const generated = $derived(
        pivotGrid.columns.visible.filter((column) => column.id.startsWith('__pv'))
    )

    const field = (sale: Sale, id: string): string =>
        String((sale as unknown as Record<string, unknown>)[id] ?? '')

    const check = $derived.by(() => {
        const downKeys = [...new Set(sales.map((sale) => field(sale, down)))].sort()
        const acrossKeys = [...new Set(sales.map((sale) => field(sale, across)))].sort()
        const downKey = downKeys[0] ?? ''
        const acrossKey = acrossKeys[0] ?? ''

        const cell = sales.filter(
            (sale) => field(sale, down) === downKey && field(sale, across) === acrossKey
        )
        return {
            downKey,
            acrossKey,
            count: cell.length,
            total: cell.reduce((sum, sale) => sum + sale.amount, 0)
        }
    })

    const views: { id: View; label: string; blurb: string }[] = [
        {
            id: 'raw',
            label: '1. Dữ liệu thô',
            blurb: 'Danh sách dài. Mỗi dòng là một lần bán. Muốn biết North bán bao nhiêu ở Q1 thì phải tự cộng tay.'
        },
        {
            id: 'grouped',
            label: '2. Gộp nhóm',
            blurb: 'grouping() gập danh sách lại theo một trường. Được một số mỗi nhóm. Cột vẫn đúng bốn cột ứng dụng đã khai.'
        },
        {
            id: 'pivot',
            label: '3. Pivot',
            blurb: 'pivot() gập theo hai trường cùng lúc: một chạy dọc, một chạy ngang. Cột ngang do dữ liệu sinh ra.'
        }
    ]

    const activeView = $derived(views.find((entry) => entry.id === view)!)
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Pivot table - @sv5ui/datagrid</h1>
            <p class="text-sm text-on-surface-variant">
                Cùng một bộ {sales.length} dòng, xem ở ba dạng. Bấm lần lượt 1, 2, 3 để thấy pivot khác
                gộp nhóm chỗ nào.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/aggregate">← Aggregation</Link>
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

    <div
        class="rounded-lg border border-outline-variant bg-surface-container p-3 text-sm text-on-surface-variant"
    >
        {activeView.blurb}
    </div>

    {#if view === 'pivot'}
        <div class="flex flex-wrap items-center gap-3 text-sm">
            <span class="text-on-surface-variant">Chạy dọc:</span>
            {#each fields as field (field)}
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
            {#each fields as field (field)}
                <Button
                    variant={across === field ? 'solid' : 'outline'}
                    size="sm"
                    label={field}
                    disabled={down === field}
                    onclick={() => setAcross(field)}
                />
            {/each}
        </div>
    {/if}

    {#if view === 'pivot'}
        <div class="flex flex-wrap items-center gap-2">
            <Button
                variant={nested ? 'solid' : 'outline'}
                size="sm"
                label="Lồng thêm Product ra ngang"
                onclick={toggleNested}
            />
            <Button
                variant={subtotals ? 'solid' : 'outline'}
                size="sm"
                label="Tổng con mỗi nhóm cột"
                disabled={!nested}
                onclick={() => (subtotals = !subtotals)}
            />
            <Button
                variant={foldable ? 'solid' : 'outline'}
                size="sm"
                label="Cho gập nhóm cột"
                disabled={!nested}
                onclick={() => (foldable = !foldable)}
            />
            <Button
                variant={totals ? 'solid' : 'outline'}
                size="sm"
                label="Cột Tổng và hàng Tất cả"
                onclick={() => (totals = !totals)}
            />
            <Button
                variant={ownKeys ? 'solid' : 'outline'}
                size="sm"
                label="Tự khai khoá cho Size"
                disabled={across !== 'size'}
                onclick={() => (ownKeys = !ownKeys)}
            />
        </div>
    {/if}

    {#key view}
        <DataGrid grid={active} toolbar class="h-100" />
    {/key}

    {#if view === 'pivot'}
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
                    onclick={() => (saved = pivotGrid.api.getState?.() ?? null)}
                />
                <Button
                    variant="outline"
                    size="sm"
                    label="Nạp lại view đã lưu"
                    disabled={saved === null}
                    onclick={() => {
                        if (saved !== null) pivotGrid.api.setState?.(saved)
                    }}
                />
            </div>

            <p class="text-xs text-on-surface-variant">
                Bấm <strong class="text-on-surface">Lưu view</strong>, rồi đổi trục hoặc tắt pivot
                đi, rồi bấm <strong class="text-on-surface">Nạp lại</strong>: bảng chéo trở về đúng
                như lúc lưu. Trước đợt này thì cấu hình pivot không vào snapshot, nên nạp lại là mất
                trắng.
            </p>

            <p class="text-xs text-on-surface-variant">
                Bật <strong class="text-on-surface">Lồng thêm Product</strong>,
                <strong class="text-on-surface">Tổng con</strong> và
                <strong class="text-on-surface">Cho gập nhóm cột</strong>, rồi bấm mũi tên trên tiêu
                đề <code>Q1</code>: nhóm gập lại còn đúng cột tổng của nó, các nhóm bên cạnh không
                đụng tới. Không có tổng con thì không còn gì để gập xuống, nên nhóm cuộn thành một
                dải hẹp thay vì biến mất.
            </p>

            <p class="text-xs text-on-surface-variant">
                Bấm chuột phải lên tiêu đề một cột dữ liệu để thấy
                <strong class="text-on-surface">Pivot cột này xuống dọc</strong> và
                <strong class="text-on-surface">ra ngang</strong>. Menu ấy gọi cùng những hàm mà mấy
                nút trên đây gọi.
            </p>
        </div>

        <div class="space-y-2 rounded-lg border border-outline-variant p-4">
            <h2 class="text-sm font-medium text-on-surface">Cột lưới đang tự sinh</h2>
            <div class="flex flex-wrap gap-2 text-xs">
                {#each generatedHeaders as header, index (`${header}-${index}`)}
                    <Badge label={header} color="primary" size="sm" />
                {/each}
            </div>
            <p class="text-xs text-on-surface-variant">
                Đổi trục ngang sang <code>shipped</code> để thấy trục ngày:
                <strong class="text-on-surface">xếp theo thời gian</strong>, và tiêu đề vẽ qua bộ
                định dạng của cột nguồn chứ không phải chuỗi ISO. Đổi sang
                <code>size</code> thì thứ tự mặc định là A tới Z, bấm
                <strong class="text-on-surface">Tự khai khoá cho Size</strong> để lấy thứ tự Small, Medium,
                Large mà chỉ ứng dụng mới biết.
            </p>
        </div>
    {/if}

    {#if view === 'pivot'}
        <div class="space-y-3 rounded-lg border border-outline-variant p-4">
            <div class="flex flex-wrap items-center gap-2">
                <h2 class="text-sm font-medium text-on-surface">Cột nào do dữ liệu sinh ra?</h2>
                <Button
                    variant={hasQ5 ? 'solid' : 'outline'}
                    size="sm"
                    label={hasQ5 ? 'Đã thêm dữ liệu Q5' : 'Thêm dữ liệu quý Q5'}
                    onclick={() => (hasQ5 = !hasQ5)}
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
                Hàng trên là danh sách cột trong code, không đổi bao giờ. Hàng dưới là cột lưới tự
                tạo sau khi đọc {sales.length} dòng dữ liệu. Bấm
                <strong class="text-on-surface">Thêm dữ liệu quý Q5</strong>: dữ liệu có thêm một
                giá trị, hàng dưới mọc thêm một cột, hàng trên đứng yên. Đó là thứ không feature nào
                khác trong thư viện làm được.
            </p>
        </div>

        <div class="space-y-2 rounded-lg border border-outline-variant p-4">
            <h2 class="text-sm font-medium text-on-surface">Cộng tay để đối chiếu</h2>
            <p class="text-xs text-on-surface-variant">
                Ô đầu tiên của lưới, <code>{check.downKey}</code> giao
                <code>{check.acrossKey}</code>, gom
                <strong class="text-on-surface">{check.count}</strong> dòng và cộng lại thành
                <strong class="text-on-surface">{money.format(check.total)}</strong>. Con số này
                cộng thẳng từ dữ liệu gốc, không đi qua lưới, nên nó lệch thì là thư viện sai.
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
        <div
            class="rounded-lg border border-outline-variant bg-surface-container p-3 text-xs text-on-surface-variant"
        >
            Mở hết nhóm ra và đếm: muốn biết mỗi vùng bán bao nhiêu ở từng quý, anh phải gộp thêm
            một tầng nữa và đọc {regions.length * quarters.length} dòng xếp dọc. So "North Q1" với "South
            Q1" thì phải cuộn đi tìm. Pivot xếp chúng thành một cột, đọc thẳng xuống.
        </div>
    {/if}
</Container>
