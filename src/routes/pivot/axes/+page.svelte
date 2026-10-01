<script lang="ts">
    import { createDataGrid, DataGrid, pivot } from '$lib/index.js'
    import { Button } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    let saved = $state<unknown>(null)

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }]
            })
        ]
    })

    const down = $derived(grid.api.pivotRows?.() ?? [])
    const across = $derived(grid.api.pivotColumns?.() ?? [])
    const crossing = $derived(grid.api.isPivoting?.() ?? false)

    const swap = () => {
        const [a, b] = [down, across]
        grid.api.setPivotRows?.(b)
        grid.api.setPivotColumns?.(a)
    }

    const code = [
        'grid.api.pivotRows()             // doc lai truc dang chay',
        'grid.api.pivotColumns()',
        'grid.api.clearPivot()            // ve lai bang phang',
        "grid.api.setPivotRows(['region'])",
        'const view = grid.api.getState()  // giu ca phep giao',
        'grid.api.setState(view)'
    ].join('\n')
</script>

<Case
    title="Đổi trục, tắt bật, và lưu lại"
    what="Phép giao không phải một thứ khai một lần rồi thôi. Hai trục đổi chỗ được lúc chạy, tắt hẳn được để về bảng phẳng, và nằm trong cùng một bản chụp trạng thái với mọi thứ khác của lưới."
    look="Đổi trục thì vùng chạy ngang còn quý chạy dọc, các con số vẫn y nguyên, chỉ đọc theo chiều khác. Tắt pivot thì bảng trở về mười dòng gốc. Lưu view rồi đổi lung tung rồi nạp lại thì về đúng lúc lưu."
    {code}
>
    {#snippet controls()}
        <Button
            variant="outline"
            size="sm"
            label="Đổi hai trục"
            disabled={!crossing}
            onclick={swap}
        />
        <Button
            variant="outline"
            size="sm"
            label="Tắt phép giao"
            disabled={!crossing}
            onclick={() => grid.api.clearPivot?.()}
        />
        <Button
            variant="outline"
            size="sm"
            label="Bật lại"
            disabled={crossing}
            onclick={() => {
                grid.api.setPivotRows?.(['region'])
                grid.api.setPivotColumns?.(['quarter'])
            }}
        />
        <span class="w-3"></span>
        <Button
            variant="outline"
            size="sm"
            label="Lưu view"
            onclick={() => (saved = grid.api.getState?.())}
        />
        <Button
            variant="outline"
            size="sm"
            label="Nạp lại view đã lưu"
            disabled={saved === null}
            onclick={() => {
                if (saved !== null) grid.api.setState?.(saved as never)
            }}
        />
    {/snippet}

    <p class="text-xs text-on-surface-variant" data-dg-axes>
        Dọc: <strong class="text-on-surface">{down.join(', ') || 'trống'}</strong>, ngang:
        <strong class="text-on-surface">{across.join(', ') || 'trống'}</strong>
    </p>

    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                Đổi trục không tính lại gì về bản chất. Cùng một phép rút gọn trên cùng những dòng
                ấy, chỉ khác chỗ khoá nào thành hàng và khoá nào thành cột. Vì vậy mọi con số bên
                trong giữ nguyên, tổng cũng vậy, chỉ có hình bảng là xoay.
            </p>
            <p class="text-on-surface-variant">
                Tắt phép giao là đặt cả hai trục về rỗng. Lưới bỏ hết cột sinh ra và trả lại đúng
                các cột đã khai ban đầu, nên bảng về lại dạng phẳng chứ không phải một pivot rỗng.
                Lúc ấy <code>isPivoting()</code> trả về false, và đó là thứ một thanh công cụ nên đọc
                để bật tắt nút của mình.
            </p>
            <p class="text-on-surface-variant">
                Bản chụp trạng thái giữ hai trục, danh sách measure, và mọi cài đặt của phép giao,
                cùng chỗ với sắp xếp và bộ lọc. Nạp lại là nạp lại tất cả một lượt, nên một cái
                "view đã lưu" của ứng dụng không cần biết pivot tồn tại.
            </p>
            <p class="text-on-surface-variant">
                Hai trục đọc lại được qua <code>pivotRows()</code> và
                <code>pivotColumns()</code>, nên một thanh công cụ tự dựng không phải giữ bản sao
                riêng rồi lệch với lưới. Cả hai trả về một bản chép, nên sửa mảng nhận được không
                đụng tới trục thật.
            </p>
            <p class="text-on-surface-variant">
                Một điều đáng để ý: nạp lại bản chụp không làm lưới mất chỗ đang mở. Các nhóm đang
                bung vẫn bung, vì trạng thái bung cũng nằm trong bản chụp ấy.
            </p>
        </div>
    {/snippet}
</Case>
