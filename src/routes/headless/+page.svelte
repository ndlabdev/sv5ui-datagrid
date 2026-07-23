<script lang="ts">
    import { Button, Container, Input, Link, ThemeModeButton } from 'sv5ui'
    import {
        createDataGrid,
        filtering,
        getFiltering,
        getPagination,
        getSorting,
        Grid,
        pagination,
        sorting,
        type ColumnDef,
        type Density
    } from '$lib/index.js'

    interface Task {
        id: number
        title: string
        assignee: string
        status: string
        points: number
    }

    const people = ['Alice', 'Bob', 'Carol', 'Dave', 'Erin', 'Frank']
    const states = ['todo', 'in-progress', 'review', 'done']

    const tasks: Task[] = Array.from({ length: 48 }, (_, i) => ({
        id: i + 1,
        title: `Task ${i + 1}`,
        assignee: people[i % people.length],
        status: states[i % states.length],
        points: (i % 8) + 1
    }))

    const columns: ColumnDef<Task>[] = [
        { id: 'title', header: 'Title', sortable: true, flex: 2 },
        { id: 'assignee', header: 'Assignee', sortable: true, flex: 1 },
        { id: 'status', header: 'Status', sortable: true, flex: 1 },
        { id: 'points', header: 'Points', sortable: true, align: 'right', width: 100 }
    ]

    // No <DataGrid>: create the grid, then compose the parts and drive every
    // surface through createDataGrid's api and the getX accessors.
    const grid = createDataGrid<Task>({
        columns,
        data: tasks,
        getRowId: (task) => String(task.id),
        features: [filtering(), sorting(), pagination({ pageSize: 8 })]
    })

    const filter = getFiltering(grid)!
    const sort = getSorting(grid)!
    const page = getPagination(grid)!

    let query = $state('')
    $effect(() => filter.setQuickFilter(query))

    const densities: Density[] = ['compact', 'standard', 'comfortable']

    // Read reactively straight off the models — no wrapper component involved.
    const sortLabel = $derived(
        sort.sort.length === 0
            ? 'none'
            : sort.sort.map((entry) => `${entry.columnId} ${entry.direction}`).join(', ')
    )
    const rangeStart = $derived((page.page - 1) * (page.pageSize ?? 0) + 1)
    const rangeEnd = $derived(Math.min(page.page * (page.pageSize ?? 0), page.total))
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Headless — build your own UI</h1>
            <p class="text-sm text-on-surface-variant">
                Không dùng <code>&lt;DataGrid&gt;</code>. Chỉ <code>createDataGrid</code> +
                <code>Grid.Root / Viewport / Header / Body</code> + các accessor
                <code>getSorting</code>/<code>getFiltering</code>/<code>getPagination</code>.
                Toolbar và phân trang dưới đây là markup của riêng bạn, đọc/ghi thẳng vào model.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <!-- Your own toolbar -->
    <div class="flex flex-wrap items-center gap-2">
        <Input class="min-w-56" placeholder="Tìm task..." icon="lucide:search" bind:value={query} />
        <Button
            size="sm"
            variant="outline"
            label="Sort points ↓"
            onclick={() => sort.setSort([{ columnId: 'points', direction: 'desc' }])}
        />
        <Button size="sm" variant="ghost" label="Clear sort" onclick={() => sort.setSort([])} />
        <div class="grow"></div>
        <div role="group" aria-label="Density" class="flex items-center gap-1">
            {#each densities as density (density)}
                <Button
                    size="sm"
                    variant={grid.density === density ? 'solid' : 'outline'}
                    label={density}
                    onclick={() => (grid.density = density)}
                />
            {/each}
        </div>
    </div>

    <!-- The grid, from the compound parts -->
    <Grid.Root {grid}>
        <Grid.Viewport>
            <Grid.Header />
            <Grid.Body emptyText="Không có task nào khớp" />
        </Grid.Viewport>
    </Grid.Root>

    <!-- Your own footer -->
    <div class="flex flex-wrap items-center justify-between gap-3 text-sm text-on-surface-variant">
        <span>
            {page.total > 0 ? `${rangeStart}–${rangeEnd} / ${page.total}` : '0'} · sort: {sortLabel}
        </span>
        <div class="flex items-center gap-2">
            <Button
                size="sm"
                variant="outline"
                label="← Trước"
                disabled={page.page <= 1}
                onclick={() => page.setPage(page.page - 1)}
            />
            <span class="tabular-nums">Trang {page.page} / {page.pageCount}</span>
            <Button
                size="sm"
                variant="outline"
                label="Sau →"
                disabled={page.page >= page.pageCount}
                onclick={() => page.setPage(page.page + 1)}
            />
        </div>
    </div>

    <p class="text-xs text-on-surface-variant">
        Cùng một grid, hai giao diện: <code>&lt;DataGrid&gt;</code> là bản lắp sẵn của chính các
        part này. Khi cần toàn quyền layout — toolbar riêng, phân trang riêng, nhúng vào app shell —
        bạn dựng từ <code>Grid.*</code> và điều khiển bằng API.
    </p>
</Container>
