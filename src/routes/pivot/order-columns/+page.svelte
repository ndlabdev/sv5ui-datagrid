<script lang="ts">
    import { createDataGrid, DataGrid, pivot } from '$lib/index.js'
    import { Button } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    type Mode = 'keys' | 'desc' | 'asc'

    let mode = $state<Mode>('keys')

    const orders = {
        keys: undefined,
        desc: { direction: 'desc' as const },
        asc: { direction: 'asc' as const }
    }

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }],
                totalRow: 'Tất cả'
            })
        ]
    })

    const pick = (next: Mode) => {
        mode = next
        grid.api.setPivotOrderColumns?.(orders[next])
    }

    const code = "orderColumns: { direction: 'desc' }"
</script>

<Case
    title="Sắp cột theo measure"
    what="Trục cột vốn ra theo thứ tự của chính các khoá: quý chạy Q1 tới Q3, vùng chạy theo bảng chữ cái. Thứ tự ấy trả lời cái gì nằm ở đâu, không trả lời cái nào lớn nhất. orderColumns xếp lại theo con số mà measure đo được dưới mỗi khoá."
    look="Theo khoá thì Q1, Q2, Q3. Theo measure giảm dần thì Q1 460 đứng trước, rồi Q2 370, rồi Q3 220. Hàng tổng dưới cùng đổi chỗ theo, vì nó chính là con số dùng để xếp."
    {code}
>
    {#snippet controls()}
        <Button
            variant={mode === 'keys' ? 'solid' : 'outline'}
            size="sm"
            label="Theo khoá"
            onclick={() => pick('keys')}
        />
        <Button
            variant={mode === 'desc' ? 'solid' : 'outline'}
            size="sm"
            label="Lớn nhất trước"
            onclick={() => pick('desc')}
        />
        <Button
            variant={mode === 'asc' ? 'solid' : 'outline'}
            size="sm"
            label="Nhỏ nhất trước"
            onclick={() => pick('asc')}
        />
    {/snippet}

    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Hai điều đi kèm</h2>
            <p class="text-on-surface-variant">
                Mọi tầng đều được xếp trong phạm vi anh em của nó: các quý so với nhau trước, rồi
                trong mỗi quý các mặt hàng so với nhau. Khoá mà measure không chấm điểm được thì rơi
                xuống cuối, giữ nguyên thứ tự cũ.
            </p>
            <p class="text-on-surface-variant">
                columnKeys thắng ở chỗ nó lên tiếng. Thứ tự do ứng dụng khai là một phát biểu về
                nghĩa, nên nó đứng trên thứ tự tính từ dữ liệu.
            </p>
            <p class="text-on-surface-variant">
                Các cách đọc bám theo trình tự vẽ sẽ bám theo trình tự mới: luỹ kế cộng dồn qua các
                cột đã xếp lại, và chênh lệch là so với cột giờ đang đứng cạnh. Đó chính là ý nghĩa
                của việc xếp lại, nhưng nên biết trước khi bật.
            </p>
        </div>
    {/snippet}
</Case>
