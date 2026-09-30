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
                values: [{ field: 'amount', agg: 'sum' }]
            })
        ]
    })

    const code = [
        'pivot({',
        "    rows: ['region'],",
        "    columns: ['quarter'],",
        "    values: [{ field: 'amount', agg: 'sum' }]",
        '})'
    ].join('\n')
</script>

<Case
    title="Phép giao"
    what="Một trường gom xuống thành hàng, một trường gom ngang thành cột, ô nơi hai chiều gặp nhau giữ kết quả rút gọn. Các cột không do mã khai mà do lưới đọc dữ liệu rồi sinh ra."
    look="10 dòng thành 3 hàng. Dữ liệu có đúng 3 quý nên có đúng 3 cột. Cộng hàng North: 180 + 150 = 330."
    {code}
>
    <DataGrid {grid} />
</Case>
