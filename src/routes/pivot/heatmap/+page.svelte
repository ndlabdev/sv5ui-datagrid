<script lang="ts">
    import { conditionalFormatting, createDataGrid, DataGrid, pivot } from '$lib/index.js'
    import { Button } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const heat = {
        kind: 'colorScale' as const,
        column: { measure: 0 },
        from: 'var(--color-surface)',
        to: 'var(--color-primary)'
    }

    let painted = $state(true)

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        features: [
            conditionalFormatting({ rules: [heat] }),
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }],
                totalColumn: 'Cả năm'
            })
        ]
    })

    const toggle = () => {
        painted = !painted
        grid.api.setFormatRules?.(painted ? [heat] : [])
    }

    const code = [
        'conditionalFormatting({',
        "    rules: [{ kind: 'colorScale', column: { measure: 0 } }]",
        '})'
    ].join('\n')
</script>

<Case
    title="Bản đồ nhiệt trên phép giao"
    what="Cột của một pivot sinh ra lúc chạy nên ứng dụng không biết trước id của chúng. Một luật tô màu vì thế nhắm theo measure thay vì theo cột, rồi tô mọi ô của measure ấy cùng lúc."
    look="Ô đậm nhất là South Q1 bằng 200, nhạt nhất là East Q1 bằng 80. South Q2 và East Q3 cùng bằng 100 nên cùng một sắc, dù nằm ở hai cột khác nhau."
    {code}
>
    {#snippet controls()}
        <Button
            variant={painted ? 'solid' : 'outline'}
            size="sm"
            label={painted ? 'Đang tô màu' : 'Đang tắt màu'}
            onclick={toggle}
        />
    {/snippet}

    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Thang màu trải cả bảng, không theo từng cột</h2>
            <p class="text-on-surface-variant">
                Nếu mỗi cột có thang riêng thì East Q3 bằng 100 sẽ là ô nhạt nhất của cột Q3, tức
                trắng hoàn toàn, dù 100 không hề nhỏ so với cả bảng. So cả bảng mới đọc được vùng
                nào quý nào yếu, và đó là lý do người ta tô màu một pivot.
            </p>
            <p class="text-on-surface-variant">
                Cột tổng đứng ngoài, không tô và cũng không tính vào thang. Nó luôn lớn hơn mọi ô
                thân, để nó vào thì cả bảng sẽ nhạt đi hết. Tổng con của một trục cột lồng nhau cũng
                vậy.
            </p>
        </div>
    {/snippet}
</Case>
