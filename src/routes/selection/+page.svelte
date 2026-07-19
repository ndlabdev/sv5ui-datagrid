<script lang="ts">
    import { Badge, Button, Container, Kbd, Link, ThemeModeButton, useClipboard } from 'sv5ui'
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        filtering,
        getSelection,
        pagination,
        selection,
        sorting,
        type ColumnDef,
        type DataGridCellContext
    } from '$lib/index.js'

    interface Employee {
        id: number
        name: string
        email: string
        dept: string
        salary: number
        active: boolean
    }

    const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan', 'Fiona', 'George', 'Hana']
    const lastNames = ['Nguyen', 'Tran', 'Le', 'Pham', 'Vo', 'Dang', 'Ho', 'Bui']
    const depts = ['Core', 'Platform', 'Growth', 'Data', 'Infra', 'Design']

    const employees: Employee[] = Array.from({ length: 1000 }, (_, i) => ({
        id: i + 1,
        name: `${firstNames[i % 8]} ${lastNames[Math.floor(i / 8) % 8]}`,
        email: `user${i + 1}@example.com`,
        dept: depts[i % 6],
        salary: 40_000 + (i % 100) * 850,
        active: i % 4 !== 0
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
        { id: 'id', header: '#', sortable: true, align: 'right', width: 80 },
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
        { id: 'active', header: 'Active', width: 110, filter: 'boolean', cell: activeCell }
    ]

    const grid = createDataGrid<Employee>({
        data: employees,
        columns,
        getRowId: (employee) => String(employee.id),
        features: [
            filtering(),
            sorting(),
            columnOps(),
            selection({ isRowSelectable: (employee) => employee.active }),
            pagination({ pageSize: 25 })
        ]
    })
    const selectionState = getSelection(grid)!
    const clipboard = useClipboard()

    let copiedText = $state('')

    async function copyTsv() {
        const text = selectionState.copyText({ headers: true })
        if (!text) return
        await clipboard.copy(text)
        copiedText = text
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
            <h1 class="text-2xl font-semibold text-on-surface">Selection + clipboard — Phase 5</h1>
            <p class="text-sm text-on-surface-variant">
                Row selection (checkbox pinned trái, select-all indeterminate) · Shift+click range ·
                copy TSV · export CSV · context menu — hàng Active = ✗ không chọn được
                (isRowSelectable).
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
        <Button
            variant="outline"
            size="sm"
            icon="lucide:copy"
            label={clipboard.copied ? 'Copied!' : 'Copy TSV'}
            disabled={selectionState.count === 0}
            onclick={copyTsv}
        />
        <Button
            variant="outline"
            size="sm"
            icon="lucide:download"
            label="Export CSV"
            onclick={() => selectionState.exportCsv({ filename: 'employees.csv' })}
        />
        <Button
            variant="ghost"
            size="sm"
            label="Clear selection"
            disabled={selectionState.count === 0}
            onclick={selectionState.clear}
        />
        <span class="text-xs text-on-surface-variant">
            Export CSV xuất selection — hoặc toàn bộ hàng đã lọc khi chưa chọn gì
        </span>
    </div>

    <DataGrid {grid} toolbar />

    {#if copiedText}
        <pre
            class="max-h-40 overflow-auto rounded-lg border border-outline-variant bg-surface-container p-3 text-xs text-on-surface-variant">{copiedText}</pre>
    {/if}

    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
        <span>Body:</span>
        <span><Kbd size="sm">Space</Kbd> chọn/bỏ hàng đang focus</span>
        <span><Kbd size="sm">Shift</Kbd> + <Kbd size="sm">Space</Kbd> chọn range</span>
        <span><Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">A</Kbd> chọn tất cả</span>
        <span><Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">C</Kbd> copy TSV</span>
        <span>Chuột phải → context menu</span>
    </div>
</Container>
