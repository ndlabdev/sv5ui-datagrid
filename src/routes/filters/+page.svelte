<script lang="ts">
    import { Badge, Button, Container, Kbd, Link, ThemeModeButton } from 'sv5ui'
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        filtering,
        getFiltering,
        pagination,
        sorting,
        type ColumnDef,
        type DataGridCellContext,
        type FilterModel
    } from '$lib/index.js'

    interface Employee {
        id: number
        name: string
        email: string
        dept: string
        salary: number
        score: number
        joined: string
        active: boolean
    }

    const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan', 'Fiona', 'George', 'Hana']
    const lastNames = ['Nguyen', 'Tran', 'Le', 'Pham', 'Vo', 'Dang', 'Ho', 'Bui']
    const depts = ['Core', 'Platform', 'Growth', 'Data', 'Infra', 'Design']

    const ROWS = 100_000
    const employees: Employee[] = Array.from({ length: ROWS }, (_, i) => {
        const year = 2020 + (i % 6)
        const month = String((i % 12) + 1).padStart(2, '0')
        const day = String((i % 27) + 1).padStart(2, '0')
        return {
            id: i + 1,
            name: `${firstNames[i % 8]} ${lastNames[Math.floor(i / 8) % 8]}`,
            email: `user${i + 1}@example.com`,
            dept: depts[i % 6],
            salary: 40_000 + (i % 100) * 850,
            score: (i * 37) % 100,
            joined: `${year}-${month}-${day}`,
            active: i % 3 === 0
        }
    })

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
        { id: 'id', header: '#', sortable: true, align: 'right', width: 80, filter: false },
        { id: 'name', header: 'Name', sortable: true, flex: 1, minWidth: 160, filter: 'text' },
        { id: 'email', header: 'Email', flex: 1, minWidth: 200, filter: 'text' },
        { id: 'dept', header: 'Dept', sortable: true, width: 130, filter: 'set', cell: deptCell },
        {
            id: 'salary',
            header: 'Salary',
            sortable: true,
            align: 'right',
            width: 130,
            filter: 'number',
            cell: moneyCell
        },
        {
            id: 'score',
            header: 'Score',
            sortable: true,
            align: 'right',
            width: 100,
            filter: 'number'
        },
        { id: 'joined', header: 'Joined', sortable: true, width: 130, filter: 'date' },
        { id: 'active', header: 'Active', width: 110, filter: 'boolean', cell: activeCell }
    ]

    const grid = createDataGrid<Employee>({
        data: employees,
        columns,
        getRowId: (employee) => String(employee.id),
        features: [
            filtering(),
            sorting({ nulls: 'last' }),
            columnOps(),
            pagination({ pageSize: 25 })
        ]
    })
    const filteringState = getFiltering(grid)!

    let savedModel = $state<string>('')

    function saveModel() {
        savedModel = JSON.stringify(filteringState.getFilterModel())
    }

    function loadModel() {
        if (savedModel) filteringState.applyFilterModel(JSON.parse(savedModel) as FilterModel)
    }
</script>

{#snippet deptCell({ value }: DataGridCellContext<Employee>)}
    <Badge label={String(value)} color={deptColors[String(value)] ?? 'surface'} size="sm" />
{/snippet}

{#snippet moneyCell({ value }: DataGridCellContext<Employee>)}
    {money.format(Number(value))}
{/snippet}

{#snippet activeCell({ value }: DataGridCellContext<Employee>)}
    {value ? '✓' : '—'}
{/snippet}

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Data ops — Phase 4</h1>
            <p class="text-sm text-on-surface-variant">
                {ROWS.toLocaleString()} hàng · multi-sort (Shift+click) · column filters đủ 5 loại (text/number/date/set/boolean)
                · filter chips · status bar · page-size — filter model serializable.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" label="Save filter model" onclick={saveModel} />
        <Button
            variant="outline"
            size="sm"
            label="Load filter model"
            disabled={!savedModel}
            onclick={loadModel}
        />
        {#if savedModel}
            <code class="max-w-2xl truncate text-xs text-on-surface-variant">{savedModel}</code>
        {/if}
    </div>

    <DataGrid {grid} toolbar />

    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
        <span>Header:</span>
        <span
            ><Kbd size="sm">Shift</Kbd> + click / <Kbd size="sm">Shift</Kbd> + <Kbd size="sm"
                >Enter</Kbd
            > multi-sort</span
        >
        <span>filter icon hoặc <Kbd size="sm">Alt</Kbd> + <Kbd size="sm">↓</Kbd> → Filter…</span>
    </div>
</Container>
