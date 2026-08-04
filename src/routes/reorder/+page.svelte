<script lang="ts">
    import { Badge, Container, Kbd, Link, ThemeModeButton } from 'sv5ui'
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        filtering,
        rowReorder,
        selection,
        virtualization,
        type ColumnDef,
        type DataGridCellContext,
        type GridState,
        type HeaderContext
    } from '$lib/index.js'

    interface Task {
        id: number
        title: string
        notes: string
        owner: string
        points: number
    }

    const owners = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan']
    const blurbs = [
        'Short note.',
        'A longer note that wraps onto a second line once the column is narrow enough to force it.',
        'A much longer note again — auto row height measures whatever the cell actually renders, so three or four lines of prose are fine and the scrollbar still lands in the right place.'
    ]

    let tasks = $state.raw<Task[]>(
        Array.from({ length: 40 }, (_, i) => ({
            id: i + 1,
            title: `Task ${i + 1}`,
            notes: blurbs[i % 3],
            owner: owners[i % 5],
            points: ((i * 7) % 13) + 1
        }))
    )

    let lastMove = $state('—')

    const columns: ColumnDef<Task>[] = [
        {
            id: 'id',
            header: '#',
            width: 64,
            align: 'right',
            // Frozen: an id column has nothing to gain from being dragged wider.
            resizable: false,
            meta: { role: 'key' }
        },
        { id: 'title', header: 'Task', width: 160, filter: 'text' },
        {
            id: 'notes',
            header: 'Notes',
            headerCell: notesHeader,
            flex: 1,
            minWidth: 220,
            cell: notesCell,
            // The cell already wraps, so the hover-truncation tooltip has
            // nothing to add — turn it off rather than have both.
            tooltip: false
        },
        { id: 'owner', header: 'Owner', width: 130, filter: 'set' },
        {
            id: 'points',
            header: 'Points',
            width: 100,
            align: 'right',
            filter: 'number',
            tooltip: ({ row }) => `${row.owner} estimated ${row.points} points`
        }
    ]

    const grid: GridState<Task> = createDataGrid<Task>({
        get data() {
            return tasks
        },
        columns,
        getRowId: (task) => String(task.id),
        features: [
            rowReorder({
                // The first task is the backlog anchor and stays put.
                isRowDraggable: (task) => task.id !== 1,
                onReorder: ({ node, from, to }) => {
                    lastMove = `${node.row.title}: ${from + 1} → ${to + 1}`
                }
            }),
            selection(),
            filtering(),
            columnOps(),
            virtualization({ rowHeight: 44, getRowHeight: () => 'auto', overscan: 6 })
        ]
    })

    $effect(() => {
        // The feature rewrites `grid.data`; mirror it back so the page state
        // and the grid never disagree about the order.
        tasks = grid.data
    })
</script>

{#snippet notesHeader({ header }: HeaderContext<Task>)}
    <span class="truncate" data-dg-truncate>{header}</span>
    <Badge label="auto height" size="xs" color="tertiary" />
{/snippet}

{#snippet notesCell({ value }: DataGridCellContext<Task>)}
    <span class="block py-1 leading-relaxed whitespace-normal">{value}</span>
{/snippet}

<Container class="space-y-8 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Row reorder + auto height</h1>
            <p class="text-sm text-on-surface-variant">
                Kéo tay cầm <span class="font-mono">⣿</span> để đổi thứ tự dòng, hoặc focus một ô
                rồi
                <Kbd value="Alt" /> + <Kbd value="↑" /> / <Kbd value="↓" />. Dòng #1 bị khoá. Cột
                Notes cao theo nội dung (<span class="font-mono">getRowHeight: () => 'auto'</span>),
                cột # không cho resize, cột Points có tooltip riêng.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <p class="text-sm text-on-surface-variant">
        Lần đổi chỗ gần nhất: <span class="font-mono text-on-surface">{lastMove}</span>
    </p>

    <DataGrid {grid} toolbar class="max-h-[32rem]" />
</Container>
