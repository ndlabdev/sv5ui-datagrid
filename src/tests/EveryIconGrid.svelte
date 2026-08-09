<script lang="ts">
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        editing,
        filtering,
        pagination,
        rowPinning,
        rowReorder,
        selection,
        sorting,
        type ColumnDef
    } from '$lib/index.js'

    interface Row {
        id: number
        name: string
        score: number
        stars: number
        site: string
        dept: string
        active: boolean
        joined: string
        skills: string[]
    }

    // Every cell type and editor that reaches for an sv5ui default: `rating`
    // pulls the star, a `link` opening a new tab pulls the external arrow, and
    // the widget editors pull their own chevrons and check.
    const columns: ColumnDef<Row>[] = [
        { id: 'name', header: 'Name', width: 160, editable: true, filter: 'text', sortable: true },
        { id: 'score', header: 'Score', width: 120, type: 'progress', editable: true },
        { id: 'stars', header: 'Stars', width: 160, type: 'rating', editable: true },
        {
            id: 'site',
            header: 'Site',
            width: 160,
            type: 'link',
            typeOptions: { target: '_blank' }
        },
        {
            id: 'dept',
            header: 'Dept',
            width: 150,
            type: 'badge',
            editable: true,
            editor: {
                type: 'select',
                options: [
                    { label: 'Core', value: 'Core' },
                    { label: 'Data', value: 'Data' }
                ]
            },
            filter: 'set'
        },
        { id: 'active', header: 'Active', width: 110, type: 'boolean', editable: true },
        { id: 'joined', header: 'Joined', width: 180, type: 'date', editable: true },
        { id: 'skills', header: 'Skills', width: 180, editable: true, editor: 'tags' },
        {
            id: 'actions',
            header: 'Actions',
            width: 110,
            type: 'actions',
            typeOptions: { actions: () => [{ label: 'Edit', onSelect: () => {} }] }
        }
    ]

    const data: Row[] = Array.from({ length: 6 }, (_, i) => ({
        id: i + 1,
        name: `Person ${i + 1}`,
        score: 40 + i * 5,
        stars: (i % 5) + 1,
        site: 'https://example.com',
        dept: i % 2 === 0 ? 'Core' : 'Data',
        active: i % 2 === 0,
        joined: '2024-03-14',
        skills: ['svelte', 'ts']
    }))

    let { loading = false }: { loading?: boolean } = $props()

    export const grid = createDataGrid<Row>({
        columns,
        data,
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            filtering(),
            columnOps(),
            selection(),
            editing(),
            rowPinning(),
            rowReorder(),
            pagination({ pageSize: 3 })
        ]
    })
</script>

<DataGrid {grid} toolbar {loading} />
