<script lang="ts">
    import { createDataGrid, DataGrid, filtering, pivot } from '$lib/index.js'
    import { Button } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        features: [
            filtering(),
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }]
            })
        ]
    })

    let only = $state('')

    const keep = (quarter: string) => {
        only = quarter
        grid.api.setColumnFilter?.(
            'quarter',
            quarter === '' ? null : { kind: 'text', op: 'equals', value: quarter }
        )
    }

    const code = 'features: [filtering(), pivot({ ... })]'
</script>

<Case
    title="Lọc làm rỗng cột, không xoá cột"
    what="Danh sách khoá của trục ngang lấy từ dữ liệu trước mọi bộ lọc, nên lọc hết dòng của một khoá sẽ để cột ấy đứng nguyên và làm rỗng nó."
    look="Chọn chỉ Q2: hai cột kia vẫn đứng đó, chỉ rỗng ruột. Bảng không nhảy chỗ khi bạn thu hẹp bộ lọc."
    {code}
>
    {#snippet controls()}
        <Button
            variant={only === '' ? 'solid' : 'outline'}
            size="sm"
            label="Không lọc"
            onclick={() => keep('')}
        />
        {#each ['Q1', 'Q2', 'Q3'] as quarter (quarter)}
            <Button
                variant={only === quarter ? 'solid' : 'outline'}
                size="sm"
                label="Chỉ {quarter}"
                onclick={() => keep(quarter)}
            />
        {/each}
    {/snippet}

    <DataGrid {grid} />
</Case>
