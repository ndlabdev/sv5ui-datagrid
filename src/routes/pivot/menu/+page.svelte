<script lang="ts">
    import { columnOps, createDataGrid, DataGrid, pivot } from '$lib/index.js'
    import { Button } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        features: [
            columnOps(),
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }]
            })
        ]
    })

    const crossing = $derived(grid.api.isPivoting?.() ?? false)

    const code = 'features: [columnOps(), pivot({ ... })]'
</script>

<Case
    title="Dựng phép giao từ menu của cột"
    what="Mỗi cột có một menu, và feature được hỏi muốn thêm mục gì cho đúng cột ấy. pivot() thêm hai mục đưa cột lên trục, và một mục gỡ ra. Menu do columnOps() vẽ."
    look="Tắt phép giao rồi mở menu của cột Hàng: có hai mục đưa lên trục. Bật lại rồi mở menu của cột Vùng: có mục gỡ ra. Khi đang giao, chỉ cột trục dọc còn được vẽ nên chỉ nó có menu."
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
