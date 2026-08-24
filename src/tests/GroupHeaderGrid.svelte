<script lang="ts">
    import { Badge } from 'sv5ui'
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        type ColumnDef,
        type HeaderGroupContext
    } from '$lib/index.js'

    interface Row {
        id: number
        total: number
        base: number
        bonus: number
    }

    /** A group header the app draws itself, toggle and all. */
    const columns: ColumnDef<Row>[] = [
        { id: 'id', header: '#', width: 70 },
        {
            id: 'pay',
            header: 'Pay',
            headerGroupCell: payHeader,
            children: [
                { id: 'total', header: 'Total', width: 110, columnGroupShow: 'closed' },
                { id: 'base', header: 'Base', width: 110, columnGroupShow: 'open' },
                { id: 'bonus', header: 'Bonus', width: 110, columnGroupShow: 'open' }
            ]
        }
    ]

    const grid = createDataGrid<Row>({
        columns,
        data: [{ id: 1, total: 120, base: 100, bonus: 20 }],
        getRowId: (row) => String(row.id),
        features: [columnOps()]
    })
</script>

{#snippet payHeader({ cell, toggle }: HeaderGroupContext)}
    <Badge
        label={`${cell.header} (${cell.span})`}
        color={cell.collapsed ? 'warning' : 'success'}
        size="sm"
    />
    <button type="button" tabindex="-1" data-testid="own-toggle" onclick={toggle}>fold</button>
{/snippet}

<DataGrid {grid} />
