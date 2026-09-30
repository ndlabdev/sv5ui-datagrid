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
                columns: ['shipped'],
                values: [{ field: 'amount', agg: 'sum' }]
            })
        ]
    })

    const code = "columns: ['shipped']"
</script>

<Case
    title="Khoá xếp theo giá trị, không theo chuỗi"
    what="Trục ngang xếp khoá theo bản thân giá trị chứ không theo cách in ra, nên trục số thì đếm còn trục ngày thì chạy theo thời gian. Mỗi khoá lại vẽ qua đúng bộ định dạng của cột nó sinh ra từ đó."
    look="Trục ngang là cột Ngày giao kiểu date. Header chạy theo thời gian và hiện dưới dạng ngày, không phải chuỗi ISO."
    {code}
>
    <DataGrid {grid} />
</Case>
