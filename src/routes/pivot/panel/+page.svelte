<script lang="ts">
    import { createDataGrid, DataGrid, Grid, pivot } from '$lib/index.js'
    import { viVN } from '$lib/locales/index.js'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        locales: [viVN],
        locale: 'vi-VN',
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }]
            })
        ]
    })

    const code = '<Grid.PivotPanel {grid} />'
</script>

<Case
    title="Bảng điều khiển"
    what="Grid.PivotPanel vẽ ba vùng mà một pivot được mô tả bằng: trường chạy dọc, trường chạy ngang, và các measure. Mỗi vùng thêm bớt trường được, mỗi measure đổi được phép rút gọn lẫn cách đọc tỉ lệ."
    look="Không cần kéo thả: mỗi vùng có nút thêm riêng, mỗi chip có nút dời và nút gỡ. Gỡ trường cuối cùng khỏi một trục thì phép giao tắt, đó là hành vi đúng."
    {code}
>
    {#snippet controls()}
        <Grid.PivotPanel {grid} />
    {/snippet}

    <DataGrid {grid} />
</Case>
