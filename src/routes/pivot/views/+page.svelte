<script lang="ts">
    import { createDataGrid, DataGrid, Grid, pivot, sorting } from '$lib/index.js'
    import { Button } from 'sv5ui'
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
            sorting(),
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }],
                sortableColumns: true
            })
        ]
    })

    let saved = $state<unknown>(null)

    const code = 'const view = grid.api.getState()\ngrid.api.setState(view)'
</script>

<Case
    title="Lưu và nạp lại view"
    what="Toàn bộ cấu hình pivot đi vào ảnh chụp trạng thái: hai trục, danh sách measure kèm phép rút gọn và cách đọc tỉ lệ, trục mà measure đang xếp lên, chế độ gập nhóm, và chữ của hai cột tổng."
    look="Đổi phép giao bằng bảng điều khiển, bấm Lưu, đổi tiếp cho khác hẳn, rồi bấm Nạp lại. Bảng trở về đúng lúc bạn lưu."
    {code}
>
    {#snippet controls()}
        <Grid.PivotPanel {grid} />
        <Button
            variant="outline"
            size="sm"
            label="Lưu view"
            onclick={() => (saved = grid.api.getState?.())}
        />
        <Button
            variant="outline"
            size="sm"
            label="Nạp lại"
            disabled={saved === null}
            onclick={() => {
                if (saved !== null) grid.api.setState?.(saved as never)
            }}
        />
    {/snippet}

    <DataGrid {grid} />
</Case>
