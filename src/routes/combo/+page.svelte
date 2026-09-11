<script lang="ts">
    import {
        Grid,
        columnOps,
        createDataGrid,
        editing,
        filtering,
        selection,
        sorting,
        virtualization,
        type ColumnDef
    } from '$lib/index.js'
    import { Button, Container, Kbd, Link, ThemeModeButton } from 'sv5ui'
    import {
        commandPalette,
        conditionalFormatting,
        DataGrid,
        findReplace,
        formula,
        getGrouping,
        getRangeSelection,
        grouping,
        rangeSelection,
        savedViews,
        type FormatRule,
        type SavedView
    } from '$lib/index.js'
    import { downloadGridXlsx } from '$lib/xlsx.js'

    interface Line {
        id: number
        item: string
        region: string
        owner: string
        unit: number
        qty: number
        total?: number
        band?: string
    }

    const items = ['Bơm', 'Van', 'Ống', 'Gioăng', 'Trục']
    const regions = ['Bắc', 'Trung', 'Nam']
    const owners = ['An', 'Bình', 'Chi', 'Dũng']

    const rows: Line[] = Array.from({ length: 90 }, (_, i) => ({
        id: i + 1,
        item: `${items[i % 5]} ${100 + i}`,
        region: regions[i % 3]!,
        owner: owners[i % 4]!,
        unit: 50 + ((i * 37) % 900),
        qty: 1 + (i % 12)
    }))

    const toNumber = (input: unknown) => (input === null || input === '' ? null : Number(input))

    const columns: ColumnDef<Line>[] = [
        { id: 'item', header: 'Mặt hàng', width: 150, sortable: true, filter: 'text' },
        { id: 'region', header: 'Vùng', width: 110, sortable: true, type: 'badge' },
        { id: 'owner', header: 'Phụ trách', width: 130, sortable: true, editable: true },
        {
            id: 'unit',
            header: 'Đơn giá',
            width: 130,
            align: 'right',
            editable: true,
            editor: 'number',
            parse: toNumber
        },
        {
            id: 'qty',
            header: 'SL',
            width: 100,
            align: 'right',
            editable: true,
            editor: 'number',
            parse: toNumber
        },
        { id: 'total', header: 'Thành tiền (công thức)', width: 190, align: 'right' },
        { id: 'band', header: 'Xếp loại (công thức)', width: 170 }
    ]

    const rules: FormatRule[] = [
        { kind: 'colorScale', id: 'scale', column: 'total' },
        { kind: 'dataBar', id: 'bar', column: 'unit' },
        { kind: 'topN', id: 'top', column: 'qty', n: 5 }
    ]

    const seeded: SavedView[] = []

    const grid = createDataGrid<Line>({
        columns,
        data: rows,
        getRowId: (row) => String(row.id),
        features: [
            filtering(),
            sorting(),
            columnOps(),
            selection(),
            editing(),
            formula<Line>({
                columns: {
                    total: 'unit * qty',
                    band: 'IF(total > 4000, "lớn", IF(total > 1200, "vừa", "nhỏ"))'
                }
            }),
            grouping<Line>({
                by: ['region'],
                expandedByDefault: false,
                groupFooters: true,
                grandTotal: true,
                aggregations: {
                    total: 'sum',
                    unit: 'median',
                    qty: { kind: 'percentile', p: 0.9 },
                    owner: 'distinctCount',
                    band: 'last'
                }
            }),
            conditionalFormatting<Line>({ rules }),
            findReplace(),
            savedViews<Line>({ views: seeded, storage: null }),
            rangeSelection(),
            commandPalette<Line>(),
            virtualization({ rowHeight: 40, overscan: 8 })
        ]
    })

    const groupingState = getGrouping(grid)!
    const range = $derived(getRangeSelection(grid)!)

    async function exportXlsx() {
        await downloadGridXlsx(grid, { filename: 'combo.xlsx' })
    }
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">
                Tám tính năng trên một lưới - @sv5ui/datagrid
            </h1>
            <p class="text-sm text-on-surface-variant">
                Grouping + aggregation nâng cao, cột công thức, định dạng điều kiện, chọn vùng /
                cut-move / fill, find &amp; replace, saved views, XLSX, command palette - cùng chạy,
                cùng một pipeline. Trang này tồn tại để tìm lỗi ở chỗ các tính năng gặp nhau.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Grouping</Link>
            <Link href="/range">Range →</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div
        class="rounded-lg border border-outline-variant bg-surface-container p-3 text-xs text-on-surface-variant"
    >
        <strong class="text-on-surface">Thành tiền</strong> và
        <strong class="text-on-surface">Xếp loại</strong>
        là cột công thức, không sửa tay được - thử cut/move hay Ctrl+Enter lên chúng thì ô nguồn phải
        giữ nguyên giá trị. Cột checkbox nằm ngoài mọi phép copy/paste vùng. Hàng nhóm, hàng footer và
        hàng tổng không bao giờ nhận giá trị ghi vào.
    </div>

    <div class="flex flex-wrap items-center gap-2">
        <Button
            variant="outline"
            size="sm"
            label="Expand all"
            onclick={groupingState.expandAllGroups}
        />
        <Button
            variant="outline"
            size="sm"
            label="Collapse all"
            onclick={groupingState.collapseAllGroups}
        />
        <Button
            variant="outline"
            size="sm"
            icon="lucide:scissors"
            label="Cut range"
            disabled={range.ranges.length === 0}
            onclick={() => void range.cutRange()}
        />
        <Button
            variant="outline"
            size="sm"
            label="Drop here"
            disabled={range.cutSource === null}
            onclick={() => {
                const to = range.primary
                if (to) void range.moveRange(to.top, to.left)
            }}
        />
        <Button
            variant="outline"
            size="sm"
            icon="lucide:download"
            label="Xuất XLSX"
            onclick={exportXlsx}
        />
    </div>

    <Grid.GroupPanel {grid} />
    <Grid.SavedViews {grid} />
    <Grid.FindReplace {grid} />

    <div class="flex flex-col items-stretch gap-4 lg:flex-row lg:items-start">
        <Grid.ToolPanel {grid} class="lg:h-140" />
        <div class="min-w-0 grow">
            <DataGrid {grid} toolbar class="h-140" />
        </div>
    </div>

    <Grid.RangeStatusBar {grid} />
    <Grid.CommandPalette {grid} />

    <p class="text-xs text-on-surface-variant">
        Nhấn <Kbd value="meta" size="sm" /><Kbd value="K" size="sm" /> để mở command palette,
        <Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">F</Kbd> để tìm, kéo chọn một vùng rồi
        <Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">X</Kbd> / <Kbd size="sm">Ctrl</Kbd> +
        <Kbd size="sm">V</Kbd> để dời.
    </p>
</Container>
