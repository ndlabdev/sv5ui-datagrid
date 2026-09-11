<script lang="ts">
    import {
        columnOps,
        createDataGrid,
        filtering,
        sorting,
        virtualization,
        type ColumnDef
    } from '$lib/index.js'
    import { onMount } from 'svelte'
    import { Badge, Button, Container, Link, ThemeModeButton } from 'sv5ui'
    import {
        advancedFilter,
        DataGrid,
        getAdvancedFilter,
        getServerRowModel,
        serverRowModel,
        workerDataSource
    } from '$lib/index.js'

    interface Person {
        id: number
        name: string
        dept: string
        country: string
        salary: number
        joined: string
        active: boolean
    }

    const DEPTS = ['Core', 'Platform', 'Growth', 'Data', 'Infra', 'Design']
    const COUNTRIES = ['VN', 'US', 'DE', 'JP', 'SG', 'AU']
    const COUNT = 300_000

    let groupSeed = 0

    const rows: Person[] = Array.from({ length: COUNT }, (_, i) => ({
        id: i + 1,
        name: `Person ${((i * 7919) % COUNT) + 1}`,
        dept: DEPTS[i % DEPTS.length]!,
        country: COUNTRIES[Math.floor(i / DEPTS.length) % COUNTRIES.length]!,
        salary: 40_000 + ((i * 37) % 90_000),
        joined: `20${String(10 + (i % 16)).padStart(2, '0')}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
        active: i % 3 === 0
    }))

    const columns: ColumnDef<Person>[] = [
        { id: 'name', header: 'Name', width: 160, sortable: true, filter: 'text' },
        { id: 'dept', header: 'Dept', width: 130, sortable: true, type: 'badge', filter: 'text' },
        { id: 'country', header: 'Country', width: 110, sortable: true, filter: 'text' },
        {
            id: 'salary',
            header: 'Salary',
            width: 140,
            align: 'right',
            sortable: true,
            type: 'currency',
            filter: 'number'
        },
        {
            id: 'joined',
            header: 'Joined',
            width: 140,
            sortable: true,
            type: 'date',
            filter: 'date'
        },
        { id: 'active', header: 'Active', width: 100, type: 'boolean', filter: 'boolean' }
    ]

    let onWorker = $state<boolean | null>(null)

    const source = workerDataSource<Person>(rows, {
        columns,
        onFallback: () => {
            onWorker = false
        },
        searchText: (value, column) =>
            column.id === 'salary' ? Number(value).toLocaleString('en-US') : undefined,
        groupRow: (keys, count) =>
            ({
                id: -1_000_000 - groupSeed++,
                name: `${String(keys.at(-1))} (${count.toLocaleString('en-US')})`,
                dept: String(keys[0]),
                country: '',
                salary: 0,
                joined: '',
                active: false
            }) as Person
    })

    let groupBy = $state<string[]>([])

    const grid = createDataGrid<Person>({
        columns,
        data: [],
        rowModel: 'server',
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            filtering(),
            columnOps(),
            advancedFilter<Person>(),
            virtualization({ rowHeight: 40, overscan: 10 }),
            serverRowModel<Person>(source, {
                mode: 'infinite',
                blockSize: 200,
                get groupBy() {
                    return groupBy
                },
                getRowMeta: (row) =>
                    row.id <= -1_000_000 ? { level: 0, expandable: true } : { level: 1 },
                groupKeysOf: (node) => [node.row.dept],
                isChildOf: () => (row) => row.id > -1_000_000,
                placeholder: (index) => ({ id: -(index + 1) }) as Person
            })
        ]
    })

    const model = getServerRowModel(grid)!
    const filterState = getAdvancedFilter(grid)!

    let blocked = $state<number | null>(null)

    onMount(() => {
        onWorker = source.usingWorker
    })

    async function measure(run: () => void) {
        const start = performance.now()
        run()
        blocked = performance.now() - start
    }

    const scenarios: { label: string; run: () => void }[] = [
        { label: 'Quick filter "person 1"', run: () => grid.api.setQuickFilter?.('person 1') },
        {
            label: 'Dept contains "core"',
            run: () =>
                grid.api.setColumnFilter?.('dept', { kind: 'text', op: 'contains', value: 'core' })
        },
        {
            label: 'Salary sort desc',
            run: () => grid.api.setSort?.([{ columnId: 'salary', direction: 'desc' }])
        },
        {
            label: 'Name sort asc',
            run: () => grid.api.setSort?.([{ columnId: 'name', direction: 'asc' }])
        },
        {
            label: 'Tree: Core AND > 100k',
            run: () =>
                filterState.setModel({
                    kind: 'group',
                    join: 'and',
                    children: [
                        { kind: 'condition', columnId: 'dept', op: 'equals', value: 'Core' },
                        { kind: 'condition', columnId: 'salary', op: 'gt', value: 100_000 }
                    ]
                })
        }
    ]

    function group(by: string[]) {
        groupBy = by
        model.refresh()
        blocked = null
    }

    function reset() {
        groupBy = []
        grid.api.setQuickFilter?.('')
        grid.api.setColumnFilter?.('dept', null)
        grid.api.setSort?.([])
        filterState.clear()
        blocked = null
    }
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">
                Worker row model - @sv5ui/datagrid
            </h1>
            <p class="text-sm text-on-surface-variant">
                {COUNT.toLocaleString('en-US')} rows loaded once into a worker as columnar typed arrays.
                Filtering and sorting run there and return row indices, so the thread drawing this page
                never does the work. No new extension point: a worker is a server that happens to live
                in the same tab.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/">&larr; Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
        {#each scenarios as scenario (scenario.label)}
            <Button
                variant="outline"
                size="sm"
                label={scenario.label}
                onclick={() => measure(scenario.run)}
            />
        {/each}
        <Button
            variant={groupBy.length > 0 ? 'solid' : 'outline'}
            size="sm"
            label="Group by dept"
            onclick={() => group(groupBy.length > 0 ? [] : ['dept'])}
        />
        <Button variant="ghost" size="sm" label="Reset" onclick={reset} />
    </div>

    <div class="flex flex-wrap items-center gap-3 text-xs text-on-surface-variant">
        {#if onWorker !== null}
            <Badge
                color={onWorker ? 'success' : 'warning'}
                size="sm"
                label={onWorker ? 'on a worker' : 'main thread fallback'}
            />
        {/if}
        <span>
            <strong class="text-on-surface"
                >{model.rowCount?.toLocaleString('en-US') ?? '...'}</strong
            >
            rows match
        </span>
        {#if blocked !== null}
            <span>
                main thread busy for
                <strong class="text-on-surface">{blocked.toFixed(2)}ms</strong>
                asking the question
            </span>
        {/if}
        {#if model.loading}
            <span>loading a block...</span>
        {/if}
        {#if model.error}
            <span class="text-error">{model.error}</span>
        {/if}
    </div>

    <DataGrid {grid} toolbar class="h-140" />

    <p class="text-xs text-on-surface-variant">
        The number above is what this thread spent: it posts a message and returns. The worker
        answers with the row indices for the window, and the grid maps them to rows only for what it
        draws. v1 does not group, and a column with an <code>accessor</code>, a <code>sortFn</code>
        or a custom predicate is refused rather than read behind your back - a function does not survive
        <code>postMessage</code>.
    </p>
</Container>
