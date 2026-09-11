<script lang="ts">
    import {
        columnOps,
        createDataGrid,
        editing,
        filtering,
        sorting,
        type ColumnDef
    } from '$lib/index.js'
    import { Badge, Button, Container, Link, ThemeModeButton } from 'sv5ui'
    import {
        DataGrid,
        getPolicy,
        getRangeSelection,
        grouping,
        policy,
        rangeSelection,
        type PolicyRule
    } from '$lib/index.js'

    interface Staff {
        id: number
        name: string
        team: string
        nationalId: string
        email: string
        salary: number
    }

    type Viewer = 'intern' | 'staff' | 'manager' | 'compliance'

    let viewer = $state<Viewer>('intern')
    let sortableSalary = $state(false)
    let copied = $state<string | null>(null)

    const rows: Staff[] = [
        {
            id: 1,
            name: 'Nguyễn Thị Chi',
            team: 'Core',
            nationalId: '079301004321',
            email: 'chi.nguyen@example.vn',
            salary: 120_000
        },
        {
            id: 2,
            name: 'Trần Văn An',
            team: 'Data',
            nationalId: '079198007654',
            email: 'an.tran@example.vn',
            salary: 60_000
        },
        {
            id: 3,
            name: 'Lê Bình',
            team: 'Core',
            nationalId: '079205001122',
            email: 'binh.le@example.vn',
            salary: 90_000
        },
        {
            id: 4,
            name: 'Phạm Dũng',
            team: 'Growth',
            nationalId: '079400009988',
            email: 'dung.pham@example.vn',
            salary: 75_000
        }
    ]

    const sees = {
        intern: { id: false, salary: false, email: false, name: false },
        staff: { id: false, salary: false, email: true, name: true },
        manager: { id: false, salary: true, email: true, name: true },
        compliance: { id: true, salary: true, email: true, name: true }
    } as const

    const rules: PolicyRule<Staff>[] = [
        { columns: ['nationalId'], mask: 'last4', when: () => !sees[viewer].id },
        { columns: ['salary'], mask: 'hide', when: () => !sees[viewer].salary },
        { columns: ['email'], mask: 'email', when: () => !sees[viewer].email },
        { columns: ['name'], mask: 'initials', when: () => !sees[viewer].name }
    ]

    const columns: ColumnDef<Staff>[] = [
        { id: 'name', header: 'Name', width: 190, filter: 'text' },
        { id: 'team', header: 'Team', width: 110, type: 'badge', sortable: true, filter: 'text' },
        { id: 'nationalId', header: 'National ID', width: 170 },
        { id: 'email', header: 'Email', width: 220 },
        {
            id: 'salary',
            header: 'Salary',
            width: 140,
            align: 'right',
            type: 'currency',
            editable: true,
            get sortable() {
                return sortableSalary
            }
        }
    ]

    const grid = createDataGrid<Staff>({
        columns,
        data: rows,
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            filtering(),
            columnOps(),
            editing(),
            rangeSelection(),
            grouping<Staff>({ by: [], aggregations: { salary: 'sum' } }),
            policy<Staff>({ rules })
        ]
    })

    const guard = getPolicy(grid)!
    const range = getRangeSelection(grid)!

    const VIEWERS: { id: Viewer; label: string }[] = [
        { id: 'intern', label: 'Intern' },
        { id: 'staff', label: 'Staff' },
        { id: 'manager', label: 'Manager' },
        { id: 'compliance', label: 'Compliance' }
    ]

    function copyEverything() {
        range.selectAll()
        copied = range.getRangeTsv()
    }

    function groupByTeam() {
        grid.api.setGroupBy?.(grid.state.grouping ? ['team'] : [])
    }
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Policy engine - @sv5ui/datagrid</h1>
            <p class="text-sm text-on-surface-variant">
                Masking a cell is ten lines. Masking it so it does not come back out through the
                clipboard, an export, a filter, a group total or a formula is the feature. Switch
                who is looking and watch every one of those paths change with it.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/">&larr; Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium text-on-surface">Looking as:</span>
        {#each VIEWERS as entry (entry.id)}
            <Button
                variant={viewer === entry.id ? 'solid' : 'outline'}
                size="sm"
                label={entry.label}
                onclick={() => (viewer = entry.id)}
            />
        {/each}
        <Badge color="surface" size="sm" label={`${guard.guarded.length} columns guarded`} />
    </div>

    <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" label="Copy every cell" onclick={copyEverything} />
        <Button variant="outline" size="sm" label="Group by team" onclick={groupByTeam} />
        <Button
            variant={sortableSalary ? 'solid' : 'ghost'}
            color={sortableSalary ? 'warning' : 'surface'}
            size="sm"
            label="Leave salary sortable"
            onclick={() => (sortableSalary = !sortableSalary)}
        />
    </div>

    <DataGrid {grid} toolbar class="h-96" />

    {#if copied}
        <div class="space-y-1">
            <h2 class="text-sm font-medium text-on-surface">What the clipboard actually got</h2>
            <pre
                class="overflow-x-auto rounded-md border border-outline-variant bg-surface-container p-3 font-mono text-xs text-on-surface-variant">{copied}</pre>
        </div>
    {/if}

    <div class="grid gap-4 lg:grid-cols-2">
        <div class="space-y-2">
            <h2 class="text-sm font-medium text-on-surface">Nine doors, all shut</h2>
            <p class="text-xs text-on-surface-variant">
                Copy every cell as an intern and the TSV above holds
                <code>••••4321</code>, not the ID. The same is true of an XLSX export, a group
                total, a formula over the column, a colour scale, the advanced filter, find and
                replace, and the values a set filter offers. Each one used to leak, and each one is
                now a test.
            </p>
            <p class="text-xs text-on-surface-variant">
                A masked cell is not a way in either: try to edit Salary as an intern - the grid
                refuses, because it will not open an editor on a value the reader substituted.
            </p>
        </div>

        <div class="space-y-2">
            <h2 class="text-sm font-medium text-on-surface">Two doors this cannot shut</h2>
            <p class="text-xs text-on-surface-variant">
                Press <strong>Leave salary sortable</strong> and look at the console. The grid's own
                sort reads the real value, so the ranking survives the mask - and a column filter
                narrowed step by step is a search for a hidden number. Neither is reachable from
                here, so the policy says so out loud instead of pretending. The fix until Community
                gates both is <code>sortable: false</code> and <code>filter: false</code>.
            </p>
            <p class="text-xs text-on-surface-variant">
                A worker row model has no grid to ask, so it is handed the same reader through
                <code>readValue</code>. Without it, filtering happens on unmasked data.
            </p>
        </div>
    </div>
</Container>
