<script lang="ts">
    import { createDataGrid, DataGrid, isPivotColumn, pivot } from '$lib/index.js'
    import { Button } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, salesWithQ4, type Sale } from '../demo-data.js'

    let grown = $state(false)

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

    const grow = () => {
        grown = !grown
        grid.data = grown ? salesWithQ4 : sales
    }

    const leaves = $derived(grid.columns.visible.filter((c) => isPivotColumn(c.id)).length)

    const code = 'grid.data = salesWithQ4'
</script>

<Case
    title="Dữ liệu mọc thì cột mọc theo"
    what="Trục cột không do ứng dụng khai mà do lưới đọc từ dữ liệu. Giá trị mới xuất hiện là có cột mới, không sửa một dòng mã nào."
    look="Bấm thêm quý: số cột nhảy từ 3 lên 4 và Q4 hiện ra đúng chỗ theo thứ tự. Không dòng mã nào khai Q4."
    {code}
>
    {#snippet controls()}
        <Button
            variant="outline"
            size="sm"
            label={grown ? 'Bỏ Q4 đi' : 'Thêm hai dòng quý Q4'}
            onclick={grow}
        />
        <span class="text-sm text-on-surface-variant">{leaves} cột sinh ra</span>
    {/snippet}

    <DataGrid {grid} />
</Case>
