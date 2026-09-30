<script lang="ts">
    import { createDataGrid, DataGrid, pivot, type PivotShowAs } from '$lib/index.js'
    import { Button } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const ways: { id: PivotShowAs; label: string; note: string }[] = [
        { id: 'percentOfRow', label: 'percentOfRow', note: 'Một hàng cộng ngang lại tròn 100%.' },
        {
            id: 'percentOfColumn',
            label: 'percentOfColumn',
            note: 'Một cột cộng dọc lại tròn 100%.'
        },
        { id: 'percentOfTotal', label: 'percentOfTotal', note: 'Cả bảng cộng lại tròn 100%.' }
    ]

    let showAs = $state<PivotShowAs>('percentOfRow')

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum', showAs: 'percentOfRow' }]
            })
        ]
    })

    const pick = (next: PivotShowAs) => {
        showAs = next
        grid.api.setPivotValues?.([{ field: 'amount', agg: 'sum', showAs: next }])
    }

    const note = $derived(ways.find((way) => way.id === showAs)?.note ?? '')

    const code = "values: [{ field: 'amount', agg: 'sum', showAs: 'percentOfRow' }]"
</script>

<Case
    title="Đọc measure như một tỉ lệ"
    what="showAs thay con số bằng tỉ lệ của nó so với một cái lớn hơn. Mẫu số luôn đo từ dòng, và cột sinh ra mang kiểu percent."
    look="Với percentOfRow, North ra 54.5% và 45.5%, cộng lại tròn 100. {note}"
    {code}
>
    {#snippet controls()}
        {#each ways as way (way.id)}
            <Button
                variant={showAs === way.id ? 'solid' : 'outline'}
                size="sm"
                label={way.label}
                onclick={() => pick(way.id)}
            />
        {/each}
    {/snippet}

    <DataGrid {grid} />
</Case>
