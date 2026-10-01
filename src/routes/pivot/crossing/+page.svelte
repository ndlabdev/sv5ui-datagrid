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
    what="Một trường gom xuống thành hàng, một trường gom ngang thành cột, ô nơi hai chiều gặp nhau giữ kết quả rút gọn. Các cột không do mã khai mà do lưới đọc dữ liệu rồi sinh ra, nên dữ liệu có thêm giá trị nào là có thêm cột ấy."
    look="10 dòng thành 3 hàng. Cộng hàng North: 180 + 150 = 330. Bấm thêm quý thì số cột nhảy từ 3 lên 4 và Q4 hiện ra đúng chỗ, không dòng mã nào khai nó."
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
