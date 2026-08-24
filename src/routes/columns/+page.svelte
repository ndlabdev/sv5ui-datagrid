<script lang="ts">
    import { Badge, Button, Container, Kbd, Link, ThemeModeButton, useLocalStorage } from 'sv5ui'
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        filtering,
        getColumnOps,
        pagination,
        sorting,
        virtualization,
        type ColumnDef,
        type GridSnapshot,
        type DataGridCellContext,
        type GridState,
        type HeaderContext
    } from '$lib/index.js'

    interface Employee {
        id: number
        name: string
        email: string
        dept: string
        salary: number
        bonus: number
        q1: number
        q2: number
        q3: number
        q4: number
    }

    const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan', 'Fiona', 'George', 'Hana']
    const lastNames = ['Nguyen', 'Tran', 'Le', 'Pham', 'Vo', 'Dang', 'Ho', 'Bui']
    const depts = ['Core', 'Platform', 'Growth', 'Data', 'Infra', 'Design']

    const employees: Employee[] = Array.from({ length: 500 }, (_, i) => ({
        id: i + 1,
        name: `${firstNames[i % 8]} ${lastNames[Math.floor(i / 8) % 8]}`,
        email: `user${i + 1}@example.com`,
        dept: depts[i % 6],
        salary: 40_000 + (i % 100) * 850,
        bonus: (i % 20) * 250,
        q1: (i * 37) % 100,
        q2: (i * 53) % 100,
        q3: (i * 71) % 100,
        q4: (i * 89) % 100
    }))

    const deptColors: Record<string, 'primary' | 'tertiary' | 'success' | 'info' | 'warning'> = {
        Core: 'primary',
        Platform: 'tertiary',
        Growth: 'success',
        Data: 'info',
        Infra: 'warning',
        Design: 'primary'
    }

    const money = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    })

    const columns: ColumnDef<Employee>[] = [
        {
            id: 'identity',
            header: 'Identity',
            children: [
                {
                    id: 'id',
                    header: '#',
                    sortable: true,
                    align: 'right',
                    width: 70,
                    pinned: 'left'
                },
                { id: 'name', header: 'Name', sortable: true, width: 170, pinned: 'left' },
                { id: 'email', header: 'Email', width: 210 }
            ]
        },
        { id: 'dept', header: 'Dept', sortable: true, width: 130, cell: deptCell },
        {
            id: 'compensation',
            header: 'Compensation',
            children: [
                {
                    id: 'salary',
                    header: 'Salary',
                    headerCell: moneyHeader,
                    sortable: true,
                    align: 'right',
                    width: 120,
                    cell: moneyCell
                },
                {
                    id: 'bonus',
                    header: 'Bonus',
                    sortable: true,
                    align: 'right',
                    width: 110,
                    cell: moneyCell
                }
            ]
        },
        {
            id: 'performance',
            header: 'Performance',
            children: [
                // The summary the group folds down to, and the four it folds
                // away. `Compensation` above declares neither, so it is a
                // group with nothing to fold and no toggle.
                {
                    id: 'ytd',
                    header: 'YTD',
                    columnGroupShow: 'closed',
                    accessor: (employee) => employee.q1 + employee.q2 + employee.q3 + employee.q4,
                    sortable: true,
                    align: 'right',
                    width: 90
                },
                {
                    id: 'q1',
                    header: 'Q1',
                    columnGroupShow: 'open',
                    sortable: true,
                    align: 'right',
                    width: 90
                },
                {
                    id: 'q2',
                    header: 'Q2',
                    columnGroupShow: 'open',
                    sortable: true,
                    align: 'right',
                    width: 90
                },
                {
                    id: 'q3',
                    header: 'Q3',
                    columnGroupShow: 'open',
                    sortable: true,
                    align: 'right',
                    width: 90
                },
                {
                    id: 'q4',
                    header: 'Q4',
                    columnGroupShow: 'open',
                    sortable: true,
                    align: 'right',
                    width: 90
                }
            ]
        }
    ]

    const grid = createDataGrid<Employee>({
        data: employees,
        columns,
        getRowId: (employee) => String(employee.id),
        features: [filtering(), sorting(), columnOps(), pagination({ pageSize: 10 })]
    })
    const ops = getColumnOps(grid)!

    const savedLayout = useLocalStorage<GridSnapshot | null>('datagrid-columns-layout', null)

    // A preset is just a snapshot narrowed to its columns: setState leaves sort,
    // filter and density alone when the snapshot carries none of them.
    function saveLayout() {
        const { version, columns } = grid.getState()
        savedLayout.current = { version, columns }
    }

    function restoreLayout() {
        if (savedLayout.current) grid.setState(savedLayout.current)
    }

    const PERSIST_KEY = 'datagrid-columns-demo'

    function forgetState() {
        localStorage.removeItem(PERSIST_KEY)
        location.reload()
    }

    const wideColumns: ColumnDef<Employee>[] = [
        { id: 'id', header: '#', sortable: true, align: 'right', width: 70, pinned: 'left' },
        { id: 'name', header: 'Name', width: 170, pinned: 'left' },
        ...Array.from({ length: 16 }, (_, i) => ({
            id: `m${i + 1}`,
            header: `M${i + 1}`,
            align: 'right' as const,
            width: 110,
            accessor: (employee: Employee) => (employee.salary * (i + 2)) % 1000
        })),
        { id: 'dept', header: 'Dept', width: 120, pinned: 'right' }
    ]

    const wideGrid: GridState<Employee> = createDataGrid<Employee>({
        data: employees,
        columns: wideColumns,
        getRowId: (employee) => String(employee.id),
        features: [
            sorting(),
            columnOps(),
            virtualization({ rowHeight: 40, overscan: 6, columns: true })
        ]
    })

    // ── Column spanning ──────────────────────────────────────────────────
    interface Line {
        id: number
        label: string
        q1: number | null
        q2: number | null
        q3: number | null
        note: string
    }

    const lines: Line[] = [
        { id: 1, label: 'Revenue', q1: 120, q2: 138, q3: 151, note: '' },
        { id: 2, label: 'Costs', q1: 74, q2: 80, q3: 88, note: '' },
        {
            id: 3,
            label: 'Audited figures — quarterly totals restated',
            q1: null,
            q2: null,
            q3: null,
            note: 'banner'
        },
        { id: 4, label: 'Net', q1: 46, q2: 58, q3: 63, note: '' }
    ]

    // The banner row spans its label across every quarter column; data rows
    // keep one cell per column.
    const spanColumns: ColumnDef<Line>[] = [
        {
            id: 'label',
            header: 'Line',
            flex: 1,
            minWidth: 160,
            colSpan: (ctx) => (ctx.row.note === 'banner' ? 4 : 1),
            cellClass: (ctx) => ctx.row.note === 'banner' && 'font-medium text-primary'
        },
        { id: 'q1', header: 'Q1', type: 'currency', align: 'right' },
        { id: 'q2', header: 'Q2', type: 'currency', align: 'right' },
        { id: 'q3', header: 'Q3', type: 'currency', align: 'right' }
    ]

    const spanGrid: GridState<Line> = createDataGrid<Line>({
        data: lines,
        columns: spanColumns,
        getRowId: (line) => String(line.id)
    })
</script>

{#snippet deptCell({ value }: DataGridCellContext<Employee>)}
    <Badge label={String(value)} color={deptColors[String(value)] ?? 'surface'} size="sm" />
{/snippet}

{#snippet moneyCell({ value }: DataGridCellContext<Employee>)}
    {money.format(Number(value))}
{/snippet}

<!-- The sort control, filter icon, column menu and resize handle stay: a
     headerCell snippet draws the label, not the whole header cell. -->
{#snippet moneyHeader({ header }: HeaderContext<Employee>)}
    <span class="truncate" data-dg-truncate>{header}</span>
    <span class="text-[10px] font-normal text-on-surface-variant/70">USD</span>
{/snippet}

<Container class="space-y-8 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Columns UX — Phase 3</h1>
            <p class="text-sm text-on-surface-variant">
                Resize (kéo mép / double-click autosize) · Reorder (kéo header) · Pin · Ẩn/hiện ·
                Header groups thu gọn được · Column menu · <code>headerCell</code> (cột Salary) —
                tất cả điều khiển được bằng bàn phím.
                <strong>Sắp xếp lại rồi F5</strong>: layout, sort, filter, page size và density đều
                được giữ nguyên.
            </p>
            <p class="text-sm text-on-surface-variant">
                Nhóm <em>Performance</em> gập được: bấm mũi tên kép trên ô nhóm thì Q1 tới Q4 gập
                lại còn cột <em>YTD</em>, bấm lần nữa thì mở ra. Cột nào gập theo là do
                <code>columnGroupShow</code> của chính cột đó nói:
                <code>'open'</code> là chi tiết, <code>'closed'</code> là bản tóm tắt. Nhóm
                <em>Compensation</em> không khai gì nên không có nút. Bằng bàn phím thì mục thu gọn nằm
                trong column menu của cột trong nhóm. Trạng thái gập cũng được lưu qua F5.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <section class="space-y-3">
        <div class="flex flex-wrap items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                label="Autosize all"
                onclick={ops.autoSizeColumns}
            />
            <Button variant="outline" size="sm" label="Save preset" onclick={saveLayout} />
            <Button
                variant="outline"
                size="sm"
                label="Restore preset"
                disabled={!savedLayout.current}
                onclick={restoreLayout}
            />
            <Button variant="outline" size="sm" label="Quên state đã lưu" onclick={forgetState} />
            <span class="text-xs text-on-surface-variant">
                Preset thủ công lưu snapshot chỉ có <code>columns</code>; còn
                <code>persistState</code> bên dưới tự lưu <em>toàn bộ</em> state.
            </span>
        </div>

        <DataGrid {grid} toolbar persistState={{ key: PERSIST_KEY }} />

        <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
            <span>Focus header rồi:</span>
            <span><Kbd size="sm">Shift</Kbd> + <Kbd size="sm">←→</Kbd> resize</span>
            <span><Kbd size="sm">Alt</Kbd> + <Kbd size="sm">←→</Kbd> reorder</span>
            <span><Kbd size="sm">Alt</Kbd> + <Kbd size="sm">↓</Kbd> mở column menu</span>
            <span><Kbd size="sm">Enter</Kbd> sort</span>
        </div>
    </section>

    <section class="space-y-3">
        <div class="space-y-1">
            <h2 class="text-lg font-medium text-on-surface">
                Pinned + column virtualization (100k px nội dung ngang)
            </h2>
            <p class="text-sm text-on-surface-variant">
                Cột <em>#</em> và <em>Name</em> pin trái, <em>Dept</em> pin phải (sticky) — sống chung
                với column windowing và 500 hàng ảo hoá.
            </p>
        </div>
        <DataGrid grid={wideGrid} class="h-100" />
    </section>

    <section class="space-y-3">
        <div class="space-y-1">
            <h2 class="text-lg font-medium text-on-surface">Column spanning</h2>
            <p class="text-sm text-on-surface-variant">
                <code>colSpan(ctx)</code> theo từng ô: hàng banner trải nhãn qua cả bốn cột, hàng dữ liệu
                giữ nguyên. Điều hướng bàn phím nhảy qua ô bị phủ; span bị chặn không vượt ranh giới pin.
            </p>
        </div>
        <DataGrid grid={spanGrid} />
    </section>
</Container>
