<script lang="ts">
    import { createDataGrid } from '$lib/core/grid/index.js'
    import { GroupPanel } from '$lib/components/panels/index.js'
    import { Grid } from '$lib/components/parts.js'
    import { filtering } from '$lib/features/filtering/index.js'
    import { grouping } from '$lib/features/grouping/index.js'
    import { pagination } from '$lib/features/pagination/index.js'
    import { rangeSelection } from '$lib/features/range-selection/index.js'
    import { sorting } from '$lib/features/sorting/index.js'

    interface Row {
        id: number
        region: string
        rep: string
        total: number
    }

    const data: Row[] = [
        { id: 1, region: 'North', rep: 'Ann', total: 10 },
        { id: 2, region: 'North', rep: 'Bo', total: 20 },
        { id: 3, region: 'South', rep: 'Cai', total: 30 }
    ]

    const grid = createDataGrid<Row>({
        data,
        columns: [
            { id: 'region', header: 'Region' },
            { id: 'rep', header: 'Rep' },
            { id: 'total', header: 'Total', type: 'number' }
        ],
        getRowId: (row) => String(row.id),
        features: [
            filtering<Row>(),
            sorting<Row>(),
            pagination<Row>(),
            grouping<Row>(),
            rangeSelection<Row>()
        ]
    })
</script>

<Grid.Root {grid}>
    <GroupPanel />
    <Grid.Viewport>
        <Grid.Header />
        <Grid.Body />
    </Grid.Viewport>
</Grid.Root>
