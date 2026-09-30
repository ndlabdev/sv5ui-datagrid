<script lang="ts">
    import { createDataGrid, DataGrid, pivot, sorting } from '$lib/index.js'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        features: [
            sorting(),
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }],
                sortableColumns: true,
                totalColumn: 'Cả năm'
            })
        ]
    })

    const code = 'sortableColumns: true'
</script>

<Case
    title="Sắp xếp theo một cột giao"
    what="sortableColumns cho phép bấm header của một cột sinh ra để sắp lại các hàng theo con số trong cột ấy. Mặc định tắt."
    look="Bấm header Q1: thứ tự thành South 200, North 180, East 80. Bấm cột Cả năm thì sắp theo tổng: South 420, North 330, East 300."
    {code}
>
    <DataGrid {grid} />
</Case>
