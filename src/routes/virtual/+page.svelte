<script lang="ts">
    import {
        Badge,
        Button,
        Container,
        Input,
        Link,
        ThemeModeButton,
        useDebouncedState
    } from 'sv5ui'
    import {
        createDataGrid,
        filtering,
        getFiltering,
        getVirtualization,
        Grid,
        sorting,
        virtualization,
        type ColumnDef,
        type DataGridCellContext
    } from '$lib/index.js'

    interface Employee {
        id: number
        name: string
        email: string
        role: string
        city: string
        dept: string
        age: number
        score: number
        salary: number
        active: boolean
    }

    const roles = ['Engineer', 'Designer', 'Manager', 'Analyst', 'Support']
    const firstNames = [
        'Alice',
        'Bob',
        'Charlie',
        'Diana',
        'Ethan',
        'Fiona',
        'George',
        'Hana',
        'Ivan',
        'Julia',
        'Kevin',
        'Linh',
        'Minh',
        'Nga',
        'Oanh',
        'Phong',
        'Quan',
        'Rosa',
        'Son',
        'Trang'
    ]
    const lastNames = [
        'Nguyen',
        'Tran',
        'Le',
        'Pham',
        'Vo',
        'Dang',
        'Ho',
        'Bui',
        'Do',
        'Ly',
        'Truong',
        'Hoang',
        'Phan',
        'Vu',
        'Dinh',
        'Duong',
        'Lam',
        'Mai',
        'Trinh',
        'Cao'
    ]
    const cities = [
        'Hanoi',
        'Saigon',
        'Danang',
        'Hue',
        'Cantho',
        'Haiphong',
        'Dalat',
        'Vinh',
        'Nhatrang',
        'Bienhoa',
        'Thudaumot',
        'Vungtau'
    ]
    const depts = ['Core', 'Platform', 'Growth', 'Data', 'Infra', 'Design', 'QA', 'Ops']

    const ROWS = 100_000

    const employees: Employee[] = Array.from({ length: ROWS }, (_, i) => ({
        id: i + 1,
        name: `${firstNames[i % firstNames.length]} ${lastNames[Math.floor(i / firstNames.length) % lastNames.length]}`,
        email: `user${i + 1}@example.com`,
        role: roles[i % roles.length],
        city: cities[i % cities.length],
        dept: depts[i % depts.length],
        age: 22 + (i % 40),
        score: (i * 37) % 100,
        salary: 40_000 + (i % 100) * 850,
        active: i % 3 === 0
    }))

    const roleColors: Record<string, 'primary' | 'tertiary' | 'success' | 'info' | 'warning'> = {
        Engineer: 'primary',
        Designer: 'tertiary',
        Manager: 'success',
        Analyst: 'info',
        Support: 'warning'
    }

    const salaryFormat = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    })

    const quarterColumns: ColumnDef<Employee>[] = Array.from({ length: 10 }, (_, q) => ({
        id: `q${q + 1}`,
        header: `Q${q + 1}`,
        sortable: true,
        align: 'right' as const,
        width: 90,
        accessor: (employee: Employee) => (employee.score * (q + 3)) % 1000
    }))

    const columns: ColumnDef<Employee>[] = [
        { id: 'id', header: '#', sortable: true, align: 'right', width: 80 },
        { id: 'name', header: 'Name', sortable: true, width: 170 },
        { id: 'email', header: 'Email', width: 210 },
        { id: 'role', header: 'Role', sortable: true, width: 130, cell: roleCell },
        { id: 'city', header: 'City', sortable: true, width: 120 },
        { id: 'dept', header: 'Dept', sortable: true, width: 110 },
        { id: 'age', header: 'Age', sortable: true, align: 'right', width: 80 },
        { id: 'score', header: 'Score', sortable: true, align: 'right', width: 90 },
        {
            id: 'salary',
            header: 'Salary',
            sortable: true,
            align: 'right',
            width: 120,
            accessor: (employee) => employee.salary,
            cell: salaryCell
        },
        { id: 'active', header: 'Active', align: 'center', width: 90, cell: activeCell },
        ...quarterColumns
    ]

    const grid = createDataGrid<Employee>({
        data: employees,
        columns,
        getRowId: (employee) => String(employee.id),
        features: [
            filtering(),
            sorting(),
            virtualization({ rowHeight: 40, overscan: 6, columns: true })
        ]
    })

    const variableGrid = createDataGrid<Employee>({
        data: employees.slice(0, 5000),
        columns: [
            { id: 'id', header: '#', sortable: true, align: 'right', width: 80 },
            { id: 'name', header: 'Name', sortable: true, flex: 1, minWidth: 170 },
            { id: 'role', header: 'Role', sortable: true, width: 130, cell: roleCell },
            { id: 'age', header: 'Age', sortable: true, align: 'right', width: 80 }
        ],
        getRowId: (employee) => String(employee.id),
        features: [
            sorting(),
            virtualization({
                getRowHeight: (node) => 40 + (node.row.id % 3) * 24,
                overscan: 6
            })
        ]
    })
    const variableVirt = getVirtualization(variableGrid)!

    const virt = getVirtualization(grid)!

    const search = useDebouncedState('', 200)

    $effect(() => {
        const state = getFiltering(grid)
        if (state && state.quick !== search.debounced) state.setQuickFilter(search.debounced)
    })

    let scrollTarget = $state('')

    function scrollToRow() {
        const index = Number(scrollTarget)
        if (Number.isFinite(index) && index >= 1) virt.scrollToRow(index - 1)
    }
</script>

{#snippet roleCell({ value }: DataGridCellContext<Employee>)}
    <Badge label={String(value)} color={roleColors[String(value)] ?? 'surface'} size="sm" />
{/snippet}

{#snippet salaryCell({ value }: DataGridCellContext<Employee>)}
    {salaryFormat.format(Number(value))}
{/snippet}

{#snippet activeCell({ value }: DataGridCellContext<Employee>)}
    {value ? '✓' : '—'}
{/snippet}

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">
                {ROWS.toLocaleString()} rows — row virtualization
            </h1>
            <p class="text-sm text-on-surface-variant">
                Fixed-height virtualizer (40px), overscan 6, sticky header, rAF-batched scroll. Sort
                và quick filter chạy trên toàn bộ {ROWS.toLocaleString()} hàng.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
        <Input
            placeholder="Search 100k rows..."
            icon="lucide:search"
            class="min-w-64"
            bind:value={search.current}
        />
        <Input placeholder="Row #" class="w-28" bind:value={scrollTarget} />
        <Button variant="outline" size="sm" label="Scroll to row" onclick={scrollToRow} />
        <Button
            variant="outline"
            size="sm"
            label="Bottom"
            onclick={() => virt.scrollToRow(grid.totalRows - 1)}
        />
        <Button variant="outline" size="sm" label="Top" onclick={() => virt.scrollToRow(0)} />
    </div>

    <Grid.Root {grid}>
        <Grid.Viewport class="h-160">
            <Grid.Header />
            <Grid.Body />
        </Grid.Viewport>
    </Grid.Root>

    <p class="font-mono text-xs text-on-surface-variant">
        rendered rows {virt.virtualizer.range.start + 1}–{virt.virtualizer.range.end} / {grid.totalRows.toLocaleString()}
        · rendered cols {virt.columnVirtualizer
            ? `${virt.columnVirtualizer.range.start + 1}–${virt.columnVirtualizer.range.end}`
            : 'all'} / {grid.columns.visible.length} · DOM giữ ~{virt.virtualizer.range.end -
            virt.virtualizer.range.start} hàng dù danh sách cao {Math.round(
            virt.virtualizer.totalHeight / 1000
        ).toLocaleString()}k px
    </p>

    <section class="space-y-3">
        <div class="space-y-1">
            <h2 class="text-lg font-medium text-on-surface">Variable row heights</h2>
            <p class="text-sm text-on-surface-variant">
                5.000 hàng với <code>getRowHeight</code> (40/64/88px xen kẽ) — offset tính bằng
                Fenwick tree, <code>scrollToRow</code> vẫn nhảy chính xác.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Button
                variant="outline"
                size="sm"
                label="Scroll to row 2500"
                onclick={() => variableVirt.scrollToRow(2499)}
            />
            <Button
                variant="outline"
                size="sm"
                label="Top"
                onclick={() => variableVirt.scrollToRow(0)}
            />
            <span class="font-mono text-xs text-on-surface-variant">
                rows {variableVirt.virtualizer.range.start + 1}–{variableVirt.virtualizer.range.end} /
                {variableGrid.totalRows.toLocaleString()}
            </span>
        </div>
        <Grid.Root grid={variableGrid}>
            <Grid.Viewport class="h-100">
                <Grid.Header />
                <Grid.Body />
            </Grid.Viewport>
        </Grid.Root>
    </section>
</Container>
