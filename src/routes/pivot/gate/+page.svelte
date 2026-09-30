<script lang="ts">
    import { createDataGrid, DataGrid, editing, pivot } from '$lib/index.js'
    import { Button } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const editable = columns.map((column) =>
        column.id === 'amount' ? { ...column, editable: true } : column
    )

    const grid = createDataGrid<Sale>({
        data: sales,
        columns: editable,
        getRowId: rowId,
        features: [
            editing(),
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }]
            })
        ]
    })

    const crossing = $derived(grid.api.isPivoting?.() ?? false)

    const code = "purpose === 'edit' && isPivotColumn(column.id) ? refuse : undefined"
</script>

<Case
    title="Ô giao không sửa được"
    what="Một ô giao là kết quả đo từ nhiều dòng, không có chỗ nào để ghi ngược lại, nên lưới từ chối mở trình soạn thảo thay vì để người dùng gõ rồi mất chữ. Nó vẫn được xuất, sao chép và tìm kiếm."
    look="Bấm đúp vào một ô giao: không có ô nhập nào mở ra. Tắt phép giao đi thì cột Tiền sửa lại được như thường."
    {code}
>
    {#snippet controls()}
        <Button
            variant="outline"
            size="sm"
            label="Tắt phép giao"
            disabled={!crossing}
            onclick={() => grid.api.clearPivot?.()}
        />
        <Button
            variant="outline"
            size="sm"
            label="Giao lại"
            disabled={crossing}
            onclick={() => {
                grid.api.setPivotRows?.(['region'])
                grid.api.setPivotColumns?.(['quarter'])
            }}
        />
    {/snippet}

    <DataGrid {grid} />
</Case>
