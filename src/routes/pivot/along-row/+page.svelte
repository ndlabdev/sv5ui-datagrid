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

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                Bốn cách đọc này khác hẳn nhóm phần trăm. Chúng không có mẫu số chung nào cả, mà
                nhìn sang các ô đứng cạnh trong cùng một hàng, theo đúng thứ tự trục cột đang được
                vẽ.
            </p>
            <p class="text-on-surface-variant">
                Nên thứ tự cột là một phần của kết quả. Đổi thứ tự khoá, hay sắp cột theo một
                measure, thì luỹ kế và chênh lệch đổi theo. Đó không phải lỗi: một luỹ kế chỉ có
                nghĩa khi trình tự có nghĩa, thường là thời gian.
            </p>
            <p class="text-on-surface-variant">
                Ô đầu tiên của hàng không có ô nào đứng trước nó. Chênh lệch vì thế để trống thay vì
                lấy chính nó, còn luỹ kế thì bằng chính nó.
            </p>
            <p class="text-on-surface-variant">
                Cột tổng luôn để trống ở cả bốn cách. Nó không nằm trong trình tự nào, nên cộng dồn
                tới nó hay so nó với ô liền trước đều không có nghĩa gì.
            </p>
        </div>
    {/snippet}
</Case>
