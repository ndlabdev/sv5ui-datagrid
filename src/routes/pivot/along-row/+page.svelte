<script lang="ts">
    import { createDataGrid, DataGrid, pivot, type PivotShowAs } from '$lib/index.js'
    import { Button } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const ways: { id: PivotShowAs; label: string; note: string }[] = [
        {
            id: 'runningTotal',
            label: 'runningTotal',
            note: 'Cộng dồn tới ô này. North: 180 rồi 330. Chỉ nhận sum và count.'
        },
        {
            id: 'differenceFrom',
            label: 'differenceFrom',
            note: 'Ô này trừ ô liền trước. North Q2: 150 - 180 = -30. Cột đầu để trống.'
        },
        {
            id: 'percentDifferenceFrom',
            label: 'percentDifferenceFrom',
            note: 'Mức chênh ấy chia cho ô trước: -30 / 180 = -17%.'
        },
        {
            id: 'rankInRow',
            label: 'rankInRow',
            note: 'Thứ hạng trong hàng, 1 là lớn nhất. North: Q1 hạng 1, Q2 hạng 2.'
        }
    ]

    let showAs = $state<PivotShowAs>('runningTotal')

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum', showAs: 'runningTotal' }],
                totalColumn: 'Cả năm'
            })
        ]
    })

    const pick = (next: PivotShowAs) => {
        showAs = next
        grid.api.setPivotValues?.([{ field: 'amount', agg: 'sum', showAs: next }])
    }

    const note = $derived(ways.find((way) => way.id === showAs)?.note ?? '')

    const code = "values: [{ field: 'amount', agg: 'sum', showAs: 'runningTotal' }]"
</script>

<Case
    title="Đọc một ô dựa vào ô bên cạnh"
    what="Bốn cách đọc này so với các ô nằm cạnh chứ không so với một tổng, nên tất cả đều đi theo thứ tự trục cột đang được vẽ."
    look="{note} Cột tổng luôn để trống ở cả bốn cách, vì nó đứng ngoài trình tự."
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
