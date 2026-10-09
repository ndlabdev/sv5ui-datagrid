<script lang="ts">
    import { Button, Card, Container, Link, ThemeModeButton } from 'sv5ui'
    import {
        columnOps,
        conditionalFormatting,
        createDataGrid,
        DataGrid,
        filtering,
        grouping,
        masterDetail,
        pivot,
        rangeSelection,
        rowPinning,
        selection,
        sorting,
        virtualization,
        type ColumnDef,
        type GridState
    } from '$lib/index.js'

    interface Sale {
        id: number
        region: string
        product: string
        rep: string
        amount: number
        note: string
    }

    const REGIONS = ['Bắc', 'Trung', 'Nam']
    const PRODUCTS = ['Widget', 'Gadget']

    const sales: Sale[] = REGIONS.flatMap((region, r) =>
        PRODUCTS.flatMap((product, p) =>
            Array.from({ length: 40 }, (_, at) => ({
                id: r * 1000 + p * 100 + at,
                region,
                product,
                rep: `NV ${String(at + 1).padStart(2, '0')}`,
                amount: (at + 1) * 10 + p * 5,
                note: `ghi chú ${at + 1}`
            }))
        )
    )

    const base: ColumnDef<Sale>[] = [
        { id: 'rep', header: 'Người bán', width: 150 },
        { id: 'region', header: 'Vùng' },
        { id: 'product', header: 'Hàng' },
        { id: 'amount', header: 'Tiền', type: 'number' },
        { id: 'note', header: 'Ghi chú', width: 180 }
    ]

    const pinnedBoth: ColumnDef<Sale>[] = [
        { id: 'rep', header: 'Người bán', width: 150, pinned: 'left' },
        { id: 'region', header: 'Vùng' },
        { id: 'product', header: 'Hàng' },
        { id: 'amount', header: 'Tiền', type: 'number' },
        { id: 'note', header: 'Ghi chú', width: 180, pinned: 'right' }
    ]

    const wide: ColumnDef<Sale>[] = [
        { id: 'region', header: 'Vùng', width: 120 },
        ...Array.from({ length: 50 }, (_, at) => ({
            id: `m${at}`,
            header: `Tháng ${at + 1}`,
            width: 110,
            accessor: (row: Sale) => row.amount + at
        }))
    ]

    const pinnedGrid = createDataGrid<Sale>({
        data: sales,
        columns: pinnedBoth,
        getRowId: (row) => String(row.id),
        stickyGroups: true,
        features: [virtualization<Sale>({ rowHeight: 40 }), grouping<Sale>({ by: ['region'] })]
    })

    const wideGrid = createDataGrid<Sale>({
        data: sales,
        columns: wide,
        getRowId: (row) => String(row.id),
        stickyGroups: true,
        features: [
            virtualization<Sale>({ rowHeight: 40, columns: true }),
            grouping<Sale>({ by: ['region'] })
        ]
    })

    const footerGrid = createDataGrid<Sale>({
        data: sales,
        columns: base,
        getRowId: (row) => String(row.id),
        stickyGroups: true,
        features: [
            virtualization<Sale>({ rowHeight: 40 }),
            grouping<Sale>({
                by: ['region', 'product'],
                footerLabel: (key) => `${key} cộng`,
                grandTotal: true,
                grandTotalLabel: () => 'Tất cả'
            })
        ]
    })

    const detailGrid = createDataGrid<Sale>({
        data: sales.slice(0, 60),
        columns: base,
        getRowId: (row) => String(row.id),
        stickyGroups: true,
        features: [
            virtualization<Sale>({ rowHeight: 40 }),
            masterDetail<Sale>({ hasDetail: () => true })
        ]
    })

    const pivotGrid = createDataGrid<Sale>({
        data: sales,
        columns: base,
        getRowId: (row) => String(row.id),
        stickyGroups: true,
        features: [
            virtualization<Sale>({ rowHeight: 40 }),
            pivot<Sale>({
                rows: ['region', 'rep'],
                columns: ['product'],
                values: [
                    { field: 'amount', agg: 'sum', header: 'Tiền' },
                    { field: 'amount', agg: 'avg', header: 'Bình quân' }
                ],
                valuesOn: 'rows'
            })
        ]
    })

    const everything = createDataGrid<Sale>({
        data: sales,
        columns: [
            { id: 'rep', header: 'Người bán', width: 150, pinned: 'left' },
            { id: 'region', header: 'Vùng' },
            { id: 'product', header: 'Hàng' },
            { id: 'amount', header: 'Tiền', type: 'number', editable: true },
            { id: 'note', header: 'Ghi chú', width: 180 }
        ],
        getRowId: (row) => String(row.id),
        stickyGroups: true,
        headerHeight: 56,
        groupHeaderHeight: 24,
        features: [
            virtualization<Sale>({ rowHeight: 40 }),
            grouping<Sale>({ by: ['region', 'product'], footerLabel: (key) => `${key} cộng` }),
            sorting<Sale>(),
            filtering<Sale>({ floatingRow: true }),
            columnOps<Sale>(),
            selection<Sale>({ mode: 'multiple' }),
            rangeSelection<Sale>(),
            rowPinning<Sale>({ isRowPinned: (row) => (row.id === 0 ? 'top' : null) }),
            conditionalFormatting<Sale>({ rules: [{ kind: 'colorScale', column: 'amount' }] })
        ]
    })

    const grids: GridState<Sale>[] = [
        pinnedGrid,
        wideGrid,
        footerGrid,
        detailGrid,
        pivotGrid,
        everything
    ]

    let on = $state(true)

    $effect(() => {
        for (const grid of grids) grid.stickyGroups = on
    })

    $effect(() => {
        for (const grid of [detailGrid, pivotGrid]) {
            for (const node of grid.preWindowNodes) {
                if (node.meta?.expandable) grid.expansion.expand(node.id)
            }
        }
    })

    const cases = [
        {
            title: 'Cột ghim hai bên',
            what: 'Dòng dính phải thẳng cột với hàng thân, kể cả cột ghim trái và ghim phải. Cuộn ngang để thử.',
            grid: pinnedGrid
        },
        {
            title: '51 cột, cột cũng ảo hoá',
            what: 'Khi cột cũng vào cửa sổ, ô của dòng dính phải nhận đúng chỉ số cột. Cuộn ngang thật xa rồi đối chiếu.',
            grid: wideGrid
        },
        {
            title: 'Có tổng con và tổng chung',
            what: 'Hàng tổng con nằm cùng tầng với hàng con, nên phép đi ngược không được nhận nhầm nó làm tổ tiên. Dòng dính luôn là tên nhóm, không bao giờ là chữ cộng.',
            grid: footerGrid
        },
        {
            title: 'Panel chi tiết dưới hàng',
            what: 'Hàng chi tiết là hàng full-width ở tầng 1 và là lá, nên nó không bao giờ làm tổ tiên. Cuộn trong một panel dài thì không có gì dính, đó là hành vi đúng.',
            grid: detailGrid
        },
        {
            title: 'Pivot với measure xếp dọc',
            what: 'Mỗi nhóm nở thêm một hàng cho mỗi measure. Dòng dính vẫn là trường chạy dọc, vì hàng của phép giao cũng là hàng nhóm.',
            grid: pivotGrid
        },
        {
            title: 'Bật gần như mọi thứ cùng lúc',
            what: 'Ghim cột, ghim hàng, hàng lọc, chiều cao header riêng, tổng con, chọn vùng, tô màu theo thang, và ô sửa được. Chỉ được có một tầng dính, không nhân đôi hàng, và vẫn thẳng cột.',
            grid: everything
        }
    ]
</script>

<Container class="space-y-6 py-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">
                Hàng nhóm dính, trộn với phần còn lại
            </h1>
            <p class="text-sm text-on-surface-variant">
                Sáu lưới, mỗi lưới một tổ hợp dễ làm tính năng này gãy. Cuộn dọc để dòng dính hiện
                ra, rồi cuộn ngang để kiểm nó có lệch cột không.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm" label="Bản cơ bản" href="/sticky" />
            <Button variant="ghost" size="sm" label="Trang chủ" href="/" />
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
        <Button
            variant={on ? 'solid' : 'outline'}
            size="sm"
            label={on ? 'Đang bật cho cả sáu' : 'Đang tắt cho cả sáu'}
            onclick={() => (on = !on)}
        />
        <span class="text-sm text-on-surface-variant">
            Tắt rồi cuộn lại từng lưới để so cái mất đi.
        </span>
    </div>

    {#each cases as one, at (one.title)}
        <Card class="space-y-2 p-4">
            <h2 class="font-medium text-on-surface">{at + 1}. {one.title}</h2>
            <p class="text-sm text-on-surface-variant">{one.what}</p>
            <DataGrid grid={one.grid} class="h-[320px]" />
        </Card>
    {/each}

    <Card class="space-y-2 p-4 text-sm">
        <h2 class="font-medium text-on-surface">Những chỗ nó cố ý không làm gì</h2>
        <p class="text-on-surface-variant">
            Không có <code>virtualization()</code> thì không gì dính, vì không ai biết hàng nằm đâu
            so với vị trí cuộn. Lưới phân trang cũng vậy: phân trang và ảo hoá dùng cùng một bậc
            trong pipeline, nên lưới <strong class="text-on-surface">từ chối</strong> đăng ký cả hai,
            và một lưới phân trang thì tính năng này im lặng.
        </p>
        <p class="text-on-surface-variant">
            Sắp xếp và lọc kéo người đọc về đầu danh sách, nên dòng dính biến mất đúng lúc đó. Nó
            trở lại khi bạn cuộn xuống lần nữa, chứ không phải đứng lại với tên nhóm đã cũ.
        </p>
        <p class="text-on-surface-variant">
            Gập chính cái nhóm bạn đang ở trong thì dòng dính cũng mất, vì không còn nhóm nào bao
            quanh chỗ đang đọc.
        </p>
        <p class="text-on-surface-variant">
            Chi tiết hơn về cơ chế ở <Link href="/sticky">trang cơ bản</Link>.
        </p>
    </Card>
</Container>
