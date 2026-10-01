<script lang="ts">
    import { createDataGrid, DataGrid, pivot, type PivotShowAs } from '$lib/index.js'
    import { Button } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const ways: { id: PivotShowAs | 'off'; label: string; note: string }[] = [
        { id: 'off', label: 'Như đã đo', note: 'Con số trở về đúng thứ phép rút gọn trả ra.' },
        { id: 'percentOfRow', label: 'percentOfRow', note: 'Một hàng cộng ngang lại tròn 100%.' },
        {
            id: 'percentOfColumn',
            label: 'percentOfColumn',
            note: 'Một cột cộng dọc lại tròn 100%.'
        },
        { id: 'percentOfTotal', label: 'percentOfTotal', note: 'Cả bảng cộng lại tròn 100%.' }
    ]

    let showAs = $state<PivotShowAs | 'off'>('percentOfRow')

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

    const pick = (next: PivotShowAs | 'off') => {
        showAs = next
        grid.api.setPivotValues?.([
            { field: 'amount', agg: 'sum', ...(next === 'off' ? {} : { showAs: next }) }
        ])
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

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                showAs không đổi cách đo. Lưới vẫn rút gọn ra con số như cũ, rồi mới chia nó cho một
                con số lớn hơn ở bước cuối. Vì vậy đổi qua lại giữa các cách đọc không hề tính lại
                dữ liệu.
            </p>
            <p class="text-on-surface-variant">
                Mẫu số luôn đo từ dòng, đúng cùng một luật với cột tổng. percentOfRow chia cho kết
                quả đo trên mọi dòng của hàng ấy, chứ không chia cho tổng các ô đang nhìn thấy. Khác
                biệt này lộ ra ngay khi phép rút gọn không phải sum.
            </p>
            <p class="text-on-surface-variant">
                Cột sinh ra lúc ấy mang kiểu phần trăm, nên định dạng, căn lề và cách xuất ra file
                đều theo kiểu ấy mà không cần khai gì thêm.
            </p>
            <p class="text-on-surface-variant">
                Ô trống vẫn trống chứ không thành 0%. Mẫu số bằng không cũng cho ô trống thay vì vô
                cực, vì không có gì để chia thì không có tỉ lệ nào để nói.
            </p>
        </div>
    {/snippet}
</Case>
