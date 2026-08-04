<script lang="ts">
    import {
        Badge,
        Button,
        Card,
        Container,
        Kbd,
        Link,
        Select,
        Switch,
        ThemeModeButton
    } from 'sv5ui'
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        editing,
        filtering,
        getEditing,
        getFiltering,
        getRowPinning,
        getSelection,
        getSorting,
        pagination,
        rowPinning,
        selection,
        sorting,
        type ColumnDef,
        type Density,
        type GridState,
        type HeaderContext
    } from '$lib/index.js'

    interface Employee {
        id: number
        name: string
        email: string
        dept: string
        country: string
        salary: number
        share: number
        rating: number
        progress: number
        active: boolean
        joined: string
        note: string
        site: string
    }

    const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan', 'Fiona', 'George', 'Hana']
    const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Võ', 'Đặng', 'Hồ', 'Bùi']
    const depts = ['Core', 'Platform', 'Growth', 'Data', 'Infra', 'Design']
    const countries = ['VN', 'US', 'DE', 'JP', 'SG']
    // Deliberately awkward values: blanks, a very long string, punctuation that
    // a CSV has to quote, and text that a formula-happy spreadsheet would run.
    const notes = [
        '',
        'Ngắn.',
        'Một ghi chú rất dài, cố tình dài hơn bề rộng cột để kiểm tra ellipsis và tooltip khi hover.',
        'Có, dấu; phẩy',
        '=SUM(A1:A9)'
    ]

    const employees: Employee[] = Array.from({ length: 240 }, (_, i) => ({
        id: i + 1,
        name: `${firstNames[i % 8]} ${lastNames[Math.floor(i / 8) % 8]}`,
        email: `user${i + 1}@example.com`,
        dept: depts[i % 6],
        country: countries[i % 5],
        salary: 40_000 + (i % 100) * 850,
        share: (i % 100) / 100,
        rating: (i % 5) + 1,
        progress: (i * 7) % 101,
        active: i % 3 !== 0,
        joined: `202${(i % 4) + 1}-0${(i % 9) + 1}-1${i % 9}`,
        note: notes[i % 5],
        site: `https://example.com/u/${i + 1}`
    }))

    const deptColors: Record<string, 'primary' | 'tertiary' | 'success' | 'info' | 'warning'> = {
        Core: 'primary',
        Platform: 'tertiary',
        Growth: 'success',
        Data: 'info',
        Infra: 'warning',
        Design: 'primary'
    }

    const columns: ColumnDef<Employee>[] = [
        {
            id: 'identity',
            header: 'Identity',
            children: [
                {
                    id: 'id',
                    header: '#',
                    width: 72,
                    align: 'right',
                    pinned: 'left',
                    sortable: true,
                    // Frozen on purpose: the handle must not appear on this one.
                    resizable: false,
                    meta: { role: 'key' }
                },
                {
                    id: 'name',
                    header: 'Name',
                    width: 190,
                    pinned: 'left',
                    sortable: true,
                    filter: 'text',
                    type: 'user',
                    typeOptions: { description: (row) => row.email },
                    editable: true
                },
                { id: 'email', header: 'Email', width: 210, filter: 'text', editable: true }
            ]
        },
        {
            id: 'org',
            header: 'Organisation',
            children: [
                {
                    id: 'dept',
                    header: 'Dept',
                    width: 120,
                    sortable: true,
                    filter: 'set',
                    type: 'badge',
                    typeOptions: { colors: deptColors },
                    editable: true,
                    editor: {
                        type: 'select',
                        options: depts.map((dept) => ({ label: dept, value: dept }))
                    }
                },
                { id: 'country', header: 'Country', width: 110, filter: 'set', sortable: true },
                {
                    id: 'active',
                    header: 'Active',
                    width: 100,
                    align: 'center',
                    filter: 'boolean',
                    type: 'boolean',
                    editable: true,
                    editor: 'checkbox'
                }
            ]
        },
        {
            id: 'numbers',
            header: 'Numbers',
            children: [
                {
                    id: 'salary',
                    header: 'Salary',
                    headerCell: unitHeader,
                    width: 140,
                    align: 'right',
                    sortable: true,
                    filter: 'number',
                    type: 'currency',
                    typeOptions: { currency: 'USD' },
                    editable: true,
                    editor: 'number',
                    tooltip: ({ row }) => `${row.name} · ${row.dept}`
                },
                {
                    id: 'share',
                    header: 'Share',
                    width: 110,
                    align: 'right',
                    sortable: true,
                    filter: 'number',
                    type: 'percent'
                },
                {
                    id: 'progress',
                    header: 'Progress',
                    width: 150,
                    type: 'progress',
                    // The bar speaks for itself; no hover tooltip wanted.
                    tooltip: false
                },
                { id: 'rating', header: 'Rating', width: 130, type: 'rating', sortable: true }
            ]
        },
        {
            id: 'misc',
            header: 'Misc',
            children: [
                {
                    id: 'joined',
                    header: 'Joined',
                    width: 130,
                    sortable: true,
                    filter: 'date',
                    type: 'date'
                },
                { id: 'note', header: 'Note', flex: 1, minWidth: 160, filter: 'text' },
                { id: 'site', header: 'Site', width: 150, type: 'link' },
                {
                    id: 'actions',
                    header: '',
                    width: 64,
                    align: 'center',
                    pinned: 'right',
                    type: 'actions',
                    typeOptions: {
                        actions: (row) => [
                            {
                                label: 'Pin lên đầu',
                                icon: 'lucide:arrow-up-to-line',
                                onSelect: () => getRowPinning(grid)?.pinRow(String(row.id), 'top')
                            },
                            {
                                label: 'Bỏ pin',
                                icon: 'lucide:pin-off',
                                onSelect: () => getRowPinning(grid)?.pinRow(String(row.id), null)
                            },
                            {
                                label: 'Xoá dòng',
                                icon: 'lucide:trash-2',
                                onSelect: () =>
                                    (grid.data = grid.data.filter(
                                        (candidate) => candidate.id !== row.id
                                    )),
                                destructive: true
                            }
                        ]
                    }
                }
            ]
        }
    ]

    const grid: GridState<Employee> = createDataGrid<Employee>({
        data: employees,
        columns,
        getRowId: (employee) => String(employee.id),
        features: [
            sorting(),
            filtering(),
            columnOps(),
            selection(),
            editing(),
            rowPinning(),
            pagination({ pageSize: 12 })
        ],
        rowClass: (node) => !node.row.active && 'text-on-surface-variant'
    })

    // ── Live state, so a wrong model is visible without opening devtools ──
    const sortState = getSorting(grid)!
    const filterState = getFiltering(grid)!
    const selectionState = getSelection(grid)!
    const editState = getEditing(grid)!

    let lastEvent = $state('—')
    for (const event of [
        'sortChanged',
        'filterChanged',
        'selectionChanged',
        'cellEdited',
        'columnResized',
        'columnMoved',
        'columnPinned',
        'rowPinnedChanged',
        'pageChanged'
    ] as const) {
        grid.events.on(event, (payload) => {
            lastEvent = `${event} ${JSON.stringify(payload)}`.slice(0, 120)
        })
    }

    const densities: { label: string; value: Density }[] = [
        { label: 'Compact', value: 'compact' },
        { label: 'Standard', value: 'standard' },
        { label: 'Comfortable', value: 'comfortable' }
    ]
    let density = $state<Density>('standard')
    $effect(() => {
        grid.density = density
    })

    let direction = $state<'ltr' | 'rtl'>('ltr')
    let loading = $state(false)
    let showError = $state(false)
    let empty = $state(false)

    const shown = $derived(empty ? [] : employees)
    $effect(() => {
        grid.data = shown
    })

    const snapshot = $derived(JSON.stringify(grid.getState(), null, 2))
</script>

{#snippet unitHeader({ header }: HeaderContext<Employee>)}
    <span class="truncate" data-dg-truncate>{header}</span>
    <Badge label="USD" size="xs" color="surface" />
{/snippet}

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">QA — toàn bộ bản Free</h1>
            <p class="max-w-3xl text-sm text-on-surface-variant">
                Một lưới bật mọi tính năng Community: header group 2 tầng, ghim trái/phải, 13 kiểu
                ô, sắp xếp nhiều cột, lọc mọi kiểu (2 điều kiện + phủ định + match case), chọn dòng,
                sửa ô, ghim dòng, phân trang. Các công tắc bên dưới đổi trạng thái mà không dựng lại
                lưới. Bàn phím: <Kbd value="F2" /> sửa, <Kbd value="Space" /> chọn,
                <Kbd value="Alt" /> + <Kbd value="↓" /> mở menu cột.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <Card class="flex flex-wrap items-center gap-4 p-3">
        <Select items={densities} bind:value={density} aria-label="Density" class="w-40" />
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Switch bind:checked={loading} label="Loading" />
            <Switch bind:checked={showError} label="Error" />
            <Switch bind:checked={empty} label="Empty" />
            <Switch
                checked={direction === 'rtl'}
                onCheckedChange={(next) => (direction = next ? 'rtl' : 'ltr')}
                label="RTL"
            />
        </div>
        <span class="grow"></span>
        <Button
            variant="outline"
            size="sm"
            label="Chọn hết"
            onclick={() => selectionState.selectAll()}
        />
        <Button
            variant="outline"
            size="sm"
            label="Xoá lọc + sort"
            onclick={() => {
                filterState.clearColumnFilters()
                filterState.setQuickFilter('')
                sortState.setSort([])
            }}
        />
        <Button
            variant="ghost"
            size="sm"
            label="Autosize hết"
            onclick={() => (grid.api.autoSizeColumns as () => void)()}
        />
    </Card>

    <div dir={direction}>
        <DataGrid
            {grid}
            toolbar
            {loading}
            error={showError ? 'Không tải được dữ liệu từ máy chủ.' : null}
            onRetry={() => (showError = false)}
        />
    </div>

    <div class="grid gap-4 lg:grid-cols-3">
        <Card class="space-y-1 p-3 text-sm">
            <h2 class="font-medium text-on-surface">Trạng thái</h2>
            <p class="text-on-surface-variant">Sort: {sortState.sort.length} cột</p>
            <p class="text-on-surface-variant">Lọc: {filterState.activeCount} cột</p>
            <p class="text-on-surface-variant">Chọn: {selectionState.count} dòng</p>
            <p class="text-on-surface-variant">
                Đang sửa: {editState.active ? `${editState.active.columnId}` : '—'}
            </p>
            <p class="text-on-surface-variant">Announcer: {grid.announcer.message || '—'}</p>
        </Card>
        <Card class="space-y-1 p-3 text-sm lg:col-span-2">
            <h2 class="font-medium text-on-surface">Event gần nhất</h2>
            <p class="font-mono text-xs break-all text-on-surface-variant">{lastEvent}</p>
            <h2 class="pt-2 font-medium text-on-surface">Snapshot</h2>
            <pre class="max-h-56 overflow-auto text-xs text-on-surface-variant">{snapshot}</pre>
        </Card>
    </div>
</Container>
