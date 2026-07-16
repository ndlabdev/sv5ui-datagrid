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
        DataGrid,
        filtering,
        getFiltering,
        getPagination,
        getSorting,
        Grid,
        pagination,
        sorting,
        type ColumnDef,
        type DataGridCellContext,
        type GridFeature
    } from '$lib/index.js'

    interface Person {
        id: number
        name: string
        email: string
        role: string
        age: number
    }

    const people: Person[] = [
        { id: 1, name: 'Alice Nguyen', email: 'alice@example.com', role: 'Engineer', age: 29 },
        { id: 2, name: 'Bob Tran', email: 'bob@example.com', role: 'Designer', age: 34 },
        { id: 3, name: 'Charlie Le', email: 'charlie@example.com', role: 'Manager', age: 41 },
        { id: 4, name: 'Diana Pham', email: 'diana@example.com', role: 'Engineer', age: 26 },
        { id: 5, name: 'Ethan Vo', email: 'ethan@example.com', role: 'Analyst', age: 31 },
        { id: 6, name: 'Fiona Dang', email: 'fiona@example.com', role: 'Engineer', age: 38 },
        { id: 7, name: 'George Ho', email: 'george@example.com', role: 'Designer', age: 27 },
        { id: 8, name: 'Hana Bui', email: 'hana@example.com', role: 'Manager', age: 45 },
        { id: 9, name: 'Ivan Do', email: 'ivan@example.com', role: 'Analyst', age: 24 },
        { id: 10, name: 'Julia Ly', email: 'julia@example.com', role: 'Engineer', age: 33 },
        { id: 11, name: 'Kevin Truong', email: 'kevin@example.com', role: 'Designer', age: 30 },
        { id: 12, name: 'Linh Hoang', email: 'linh@example.com', role: 'Engineer', age: 28 }
    ]

    const roleColors: Record<string, 'primary' | 'tertiary' | 'success' | 'info'> = {
        Engineer: 'primary',
        Designer: 'tertiary',
        Manager: 'success',
        Analyst: 'info'
    }

    const columns: ColumnDef<Person>[] = [
        { id: 'name', header: 'Name', sortable: true, flex: 2, minWidth: 160 },
        { id: 'email', header: 'Email', flex: 2, minWidth: 200 },
        { id: 'role', header: 'Role', sortable: true, width: 140, cell: roleCell },
        { id: 'age', header: 'Age', sortable: true, align: 'right', width: 90 },
        {
            id: 'seniority',
            header: 'Seniority',
            accessor: (person) => (person.age >= 35 ? 'Senior' : 'Junior'),
            sortable: true,
            align: 'center',
            width: 120
        }
    ]

    const grid = createDataGrid<Person>({
        data: people,
        columns,
        getRowId: (person) => String(person.id),
        features: [filtering(), sorting(), pagination({ pageSize: 5 })]
    })

    const search = useDebouncedState('', 200)

    $effect(() => {
        const state = getFiltering(grid)
        if (state && state.quick !== search.debounced) state.setQuickFilter(search.debounced)
    })

    let showEmail = $state(true)

    function toggleEmail() {
        showEmail = !showEmail
        grid.columns.defs = grid.columns.defs.map((def) =>
            def.id === 'email' ? { ...def, hidden: !showEmail } : def
        )
    }

    let eventLog = $state<string[]>([])

    function log(entry: string) {
        eventLog = [entry, ...eventLog].slice(0, 6)
    }

    grid.events.on('sortChanged', ({ sort }) =>
        log(`sortChanged: ${sort.map((s) => `${s.columnId} ${s.direction}`).join(', ') || 'none'}`)
    )
    grid.events.on('filterChanged', ({ filter }) => log(`filterChanged: "${filter.quick}"`))
    grid.events.on('pageChanged', ({ page }) => log(`pageChanged: page ${page}`))

    class RowLimitState {
        limit = $state<number | null>(null)
    }

    function rowLimit(): GridFeature<Person> {
        return {
            id: 'row-limit',
            createState: () => new RowLimitState(),
            pipelineStage: {
                order: 850,
                transform: (nodes, g) => {
                    const state = g.feature<RowLimitState>('row-limit')
                    return state?.limit ? nodes.slice(0, state.limit) : nodes
                }
            }
        }
    }

    const compoundGrid = createDataGrid<Person>({
        data: people,
        columns: [
            { id: 'name', header: 'Name', sortable: true, flex: 1, minWidth: 160 },
            { id: 'role', header: 'Role', sortable: true, width: 140, cell: roleCell },
            { id: 'age', header: 'Age', sortable: true, align: 'right', width: 90 }
        ],
        getRowId: (person) => String(person.id),
        features: [sorting(), rowLimit()]
    })

    const limitState = compoundGrid.feature<RowLimitState>('row-limit')!

    const emptyGrid = createDataGrid<Person>({
        data: [],
        columns,
        getRowId: (person) => String(person.id)
    })
</script>

{#snippet roleCell({ value }: DataGridCellContext<Person>)}
    <Badge label={String(value)} color={roleColors[String(value)] ?? 'surface'} size="sm" />
{/snippet}

<Container class="space-y-10 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">@sv5ui/datagrid — Phase 1 kernel</h1>
            <p class="text-sm text-on-surface-variant">
                Feature modules · RowNode pipeline · ColumnModel (CSS vars) · compound parts · ARIA
                grid · <Link href="/virtual">100k rows virtualization demo →</Link>
            </p>
        </div>
        <ThemeModeButton />
    </div>

    <section class="space-y-3">
        <div class="space-y-1">
            <h2 class="text-lg font-medium text-on-surface">
                1. Batteries included — <code>&lt;DataGrid&gt;</code>
            </h2>
            <p class="text-sm text-on-surface-variant">
                Quick filter (filtering), click-to-sort với 3 trạng thái (sorting), phân trang
                (pagination) — tất cả là feature module cắm rời. Cột: width cố định / flex +
                minWidth, align, cột ẩn được, cột <em>Seniority</em> tính từ
                <code>accessor</code>, cột <em>Role</em> render bằng snippet với sv5ui Badge.
            </p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
            <Input
                placeholder="Search all columns..."
                icon="lucide:search"
                class="min-w-64"
                bind:value={search.current}
            />
            <Button
                variant="outline"
                size="sm"
                label={showEmail ? 'Hide email column' : 'Show email column'}
                onclick={toggleEmail}
            />
            <Button
                variant="outline"
                size="sm"
                label="Multi-sort: role ↑ age ↓"
                onclick={() =>
                    getSorting(grid)!.setSort([
                        { columnId: 'role', direction: 'asc' },
                        { columnId: 'age', direction: 'desc' }
                    ])}
            />
            <Button
                variant="outline"
                size="sm"
                label="Clear sort"
                onclick={() => getSorting(grid)!.setSort([])}
            />
            <Button
                variant="outline"
                size="sm"
                label="Go to page 2"
                onclick={() => getPagination(grid)!.setPage(2)}
            />
        </div>

        <DataGrid {grid} />

        <div class="rounded-lg border border-outline-variant p-3">
            <p class="mb-1 text-xs font-medium text-on-surface-variant">
                EventBus — grid.events.on(...): {grid.totalRows} rows sau filter
            </p>
            {#if eventLog.length === 0}
                <p class="text-xs text-on-surface-variant">
                    Chưa có event nào — thử sort, filter hoặc đổi trang.
                </p>
            {:else}
                <ul class="space-y-0.5 font-mono text-xs text-on-surface">
                    {#each eventLog as entry, index (index)}
                        <li>{entry}</li>
                    {/each}
                </ul>
            {/if}
        </div>
    </section>

    <section class="space-y-3">
        <div class="space-y-1">
            <h2 class="text-lg font-medium text-on-surface">
                2. Compound composition — <code>Grid.*</code> + custom feature
            </h2>
            <p class="text-sm text-on-surface-variant">
                Tự lắp <code>Grid.Root / Viewport / Header / Body</code> từ context. Grid này cắm
                thêm feature <code>rowLimit()</code> tự viết (một <code>pipelineStage</code> order 850)
                — đúng extension point mà mọi feature Pro sau này sẽ dùng.
            </p>
        </div>

        <div class="flex items-center gap-2">
            <span class="text-sm text-on-surface-variant">Row limit:</span>
            <Button variant="outline" size="sm" label="3" onclick={() => (limitState.limit = 3)} />
            <Button variant="outline" size="sm" label="6" onclick={() => (limitState.limit = 6)} />
            <Button
                variant="outline"
                size="sm"
                label="All"
                onclick={() => (limitState.limit = null)}
            />
            <span class="text-sm text-on-surface-variant">
                — đang hiển thị {compoundGrid.nodes.length}/{people.length} hàng
            </span>
        </div>

        <Grid.Root grid={compoundGrid}>
            <Grid.Viewport>
                <Grid.Header />
                <Grid.Body />
            </Grid.Viewport>
        </Grid.Root>
    </section>

    <section class="space-y-3">
        <div class="space-y-1">
            <h2 class="text-lg font-medium text-on-surface">3. Empty state</h2>
            <p class="text-sm text-on-surface-variant">
                Grid không có feature nào (kernel trần) và không có dữ liệu.
            </p>
        </div>
        <DataGrid grid={emptyGrid} emptyText="No people found" />
    </section>

    <p class="text-xs text-on-surface-variant">
        Markup là div-based ARIA grid: <code>role="grid"</code> +
        <code>aria-rowcount/colcount/rowindex/colindex/sort</code>, rowindex tính theo tập dữ liệu
        sau filter (không theo trang). Độ rộng cột nằm trong CSS custom properties (<code
            >--dg-col-*-w</code
        >) — mở DevTools sửa thử, không có re-render nào xảy ra.
    </p>
</Container>
