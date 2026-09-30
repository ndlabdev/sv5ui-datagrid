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
                columns: ['quarter'],
                values: [
                    { field: 'amount', agg: 'sum', header: 'Tiền' },
                    { field: 'units', agg: 'sum', header: 'Cái' },
                    { field: 'amount', agg: 'sum', per: 'units', type: 'number', header: 'Đơn giá' }
                ]
            })
        ]
    })

    const code = ["{ field: 'amount', agg: 'sum', per: 'units', type: 'number' }"].join('\n')
</script>

<Case
    title="Chia measure này cho measure kia"
    what="per lấy một measure chia cho một measure khác. Nó chia hai kết quả rút gọn, không chia từng dòng rồi lấy trung bình."
    look="North Q1: 180 tiền trên 14 cái ra 12.86. Hai dòng gốc có đơn giá 10 và 20, trung bình của chúng là 15. Hai con số khác nhau, và 12.86 mới là đơn giá thật."
    {code}
>
    <DataGrid {grid} />
</Case>
