<script lang="ts">
    import { createDataGrid, DataGrid, isPivotColumn, pivot } from '$lib/index.js'
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
                values: [
                    { field: 'amount', agg: 'sum', header: 'Tiền' },
                    { field: 'units', agg: 'sum', header: 'Cái' },
                    { field: 'amount', agg: 'avg', header: 'Tiền TB' }
                ],
                valuesOn: 'rows'
            })
        ]
    })

    const where = $derived(grid.api.pivotValuesOn?.() ?? 'columns')
    const leaves = $derived(grid.columns.visible.filter((c) => isPivotColumn(c.id)).length)

    const code = "valuesOn: 'rows'"
</script>

<Case
    title="Xếp measure xuống dọc"
    what="Mặc định measure chồng lên trục cột, nên bảng rộng bằng số phép giao nhân số measure. valuesOn 'rows' chặn phép nhân ấy: mỗi phép giao còn một cột, mỗi nhóm nở ra một hàng cho mỗi measure."
    look="Đổi trục và nhìn con số cạnh hai nút: 3 measure chạy ngang thành 9 cột, chạy dọc còn 4. Mọi tầng nhóm đều nở, nên gập lại vẫn đọc được."
    {code}
>
    {#snippet controls()}
        <Button
            variant={where === 'columns' ? 'solid' : 'outline'}
            size="sm"
            label="Chạy ngang"
            onclick={() => grid.api.setPivotValuesOn?.('columns')}
        />
        <Button
            variant={where === 'rows' ? 'solid' : 'outline'}
            size="sm"
            label="Chạy dọc"
            onclick={() => grid.api.setPivotValuesOn?.('rows')}
        />
        <span class="text-sm text-on-surface-variant">{leaves} cột sinh ra</span>
    {/snippet}

    <DataGrid {grid} />
</Case>
