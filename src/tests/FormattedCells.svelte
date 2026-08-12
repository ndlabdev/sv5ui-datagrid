<script lang="ts">
    import {
        createDataGrid,
        DataGrid,
        type ColumnDef,
        type DataGridCellContext
    } from '$lib/index.js'

    interface Row {
        id: number
        money: number
        when: string
        plain: string
        empty: string | null
        bar: number
        flag: boolean
    }

    let { onCell }: { onCell: (ctx: DataGridCellContext<Row>) => void } = $props()

    const columns: ColumnDef<Row>[] = [
        {
            id: 'money',
            type: 'currency',
            typeOptions: {
                currency: 'USD',
                locale: 'en-US',
                numberFormat: { maximumFractionDigits: 0 }
            },
            cell: probe
        },
        { id: 'when', type: 'date', typeOptions: { locale: 'en-US' }, cell: probe },
        { id: 'plain', cell: probe },
        { id: 'empty', cell: probe },
        { id: 'bar', type: 'progress', cell: probe },
        { id: 'flag', type: 'boolean', cell: probe }
    ]

    /** Hands the context out and prints what the snippet would print. */
    function report(ctx: DataGridCellContext<Row>): string {
        onCell(ctx)
        return ctx.formatted ?? '—'
    }

    const grid = createDataGrid<Row>({
        columns,
        data: [
            {
                id: 1,
                money: 1234.5,
                when: '2026-08-11',
                plain: 'hello',
                empty: null,
                bar: 0.4,
                flag: true
            }
        ],
        getRowId: (row) => String(row.id)
    })
</script>

{#snippet probe(ctx: DataGridCellContext<Row>)}
    <span>{report(ctx)}</span>
{/snippet}

<DataGrid {grid} />
