<script lang="ts">
    import { createDataGrid, DataGrid, pivot } from '$lib/index.js'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter', 'product'],
                values: [{ field: 'amount', agg: 'sum' }],
                columnSubtotal: (header) => header + ' cộng'
            })
        ]
    })

    const code = [
        "columns: ['quarter', 'product'],",
        "columnSubtotal: (header) => header + ' cộng'"
    ].join('\n')
</script>

<Case
    title="Trục cột lồng nhau"
    what="Trục ngang nhận nhiều trường. Mỗi trường thêm một tầng header, và columnSubtotal khép mỗi nhánh bằng một cột tổng con đo từ dòng."
    look="Header hai tầng: quý ở trên, hàng ở dưới. Cột Q1 cộng hiện 460, đúng bằng Widget 300 cộng Gadget 160."
    {code}
>
    <DataGrid {grid} />
</Case>
