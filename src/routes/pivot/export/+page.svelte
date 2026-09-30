<script lang="ts">
    import {
        createDataGrid,
        DataGrid,
        pivot,
        rowsToMatrix,
        toCsv,
        withHeaderRow
    } from '$lib/index.js'
    import { Button } from 'sv5ui'
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

    let csv = $state('')

    const build = () => {
        const picked = grid.columns.visible
        csv = toCsv(withHeaderRow(rowsToMatrix(grid.preWindowNodes, picked), picked))
    }

    const code = [
        'const matrix = rowsToMatrix(grid.preWindowNodes, grid.columns.visible)',
        'toCsv(withHeaderRow(matrix, grid.columns.visible))'
    ].join('\n')
</script>

<Case
    title="Xuất đúng bảng đang hiện"
    what="Bản xuất lấy phép giao chứ không lấy 10 dòng gốc mà pivot đã gấp lại. Một hàng trong tệp là một hàng trên màn hình, kèm cả hàng tổng và cột tổng."
    look="Bấm xuất rồi đếm: tệp có 5 dòng, một dòng header cộng 4 hàng đang hiện, chứ không phải 10 dòng gốc."
    {code}
>
    <DataGrid {grid} />

    {#snippet after()}
        <Button variant="outline" size="sm" label="Xuất CSV" onclick={build} />
        {#if csv}
            <pre
                class="overflow-auto rounded-lg bg-surface-container p-4 text-xs text-on-surface-variant">{csv}</pre>
        {/if}
    {/snippet}
</Case>
