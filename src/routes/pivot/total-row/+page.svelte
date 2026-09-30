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
                values: [{ field: 'amount', agg: 'sum' }],
                totalColumn: 'Cả năm',
                totalRow: 'Tất cả'
            })
        ]
    })

    const code = ["totalColumn: 'Cả năm',", "totalRow: 'Tất cả'"].join('\n')
</script>

<Case
    title="Hàng tổng và cột tổng"
    what="totalColumn khép chiều ngang, totalRow khép chiều dọc. Cả hai đều đo từ dòng nên vẫn đúng khi bạn đổi phép rút gọn."
    look="Cột cuối: 330, 420, 300. Hàng cuối: 460, 370, 220. Cả hai chiều đều dẫn về ô góc 1050."
    {code}
>
    <DataGrid {grid} />
</Case>
