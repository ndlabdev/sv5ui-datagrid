<script lang="ts">
    import { createDataGrid, DataGrid, pivot } from '$lib/index.js'
    import { Button } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    type Mode = 'all' | 'top' | 'others' | 'bottom'

    let mode = $state<Mode>('all')

    const keeps: Record<Mode, undefined | { top?: number; bottom?: number; others?: string }> = {
        all: undefined,
        top: { top: 2 },
        others: { top: 2, others: 'Còn lại' },
        bottom: { bottom: 2 }
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
                totalColumn: 'Cả năm',
                totalRow: 'Tất cả'
            })
        ]
    })

    const pick = (next: Mode) => {
        mode = next
        grid.api.setPivotKeepRows?.(keeps[next])
    }

    const code = "keepRows: { top: 2, others: 'Còn lại' }"
</script>

<Case
    title="Chỉ giữ lại mấy hàng lớn nhất"
    what="keepRows giữ lại N hàng gom lớn nhất, xếp hạng theo con số mà measure đo được từ các dòng của từng hàng, không phải cộng các ô vẽ bên cạnh. Một bảng bốn mươi vùng là trang không ai đọc."
    look="Giữ hai vùng lớn nhất thì còn South 420 và North 330, East 300 bị loại. Hàng tổng tụt từ 1050 xuống 750, tức nó đo lại trên đúng cái đang hiện. Gom phần còn lại thì nó thành một hàng 300 và tổng trở về 1050."
    {code}
>
    {#snippet controls()}
        <Button
            variant={mode === 'all' ? 'solid' : 'outline'}
            size="sm"
            label="Cả ba vùng"
            onclick={() => pick('all')}
        />
        <Button
            variant={mode === 'top' ? 'solid' : 'outline'}
            size="sm"
            label="Chỉ hai vùng lớn nhất"
            onclick={() => pick('top')}
        />
        <Button
            variant={mode === 'others' ? 'solid' : 'outline'}
            size="sm"
            label="Gom phần còn lại thành một hàng"
            onclick={() => pick('others')}
        />
        <Button
            variant={mode === 'bottom' ? 'solid' : 'outline'}
            size="sm"
            label="Chỉ hai vùng nhỏ nhất"
            onclick={() => pick('bottom')}
        />
    {/snippet}

    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Vì sao không tự viết được bằng một stage</h2>
            <p class="text-on-surface-variant">
                Cắt hàng bằng tay thì cắt sau khi tổng đã tính xong, nên hàng tổng vẫn nói 1050
                trong khi bảng chỉ còn 750. Ở đây phép cắt xảy ra trước, nên tổng, tổng con và mọi
                cách đọc theo tỉ lệ đều đo lại trên đúng những dòng còn lại.
            </p>
            <p class="text-on-surface-variant">
                Hàng gom phần còn lại không phải một dòng giả: nó được đo từ chính những dòng bị
                loại, nên mở nó ra bằng rowsBehind vẫn thấy đủ các vùng thật bên trong, và tổng cộng
                lại đúng bằng lúc chưa cắt.
            </p>
            <p class="text-on-surface-variant">
                Cấu hình này đi vào ảnh chụp trạng thái, thứ mà một pipelineStage tự viết không ghi
                xuống được.
            </p>
        </div>
    {/snippet}
</Case>
