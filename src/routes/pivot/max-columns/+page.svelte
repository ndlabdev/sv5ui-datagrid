<script lang="ts">
    import { createDataGrid, DataGrid, isPivotColumn, pivot } from '$lib/index.js'
    import { Button } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const make = (max: number) =>
        createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: rowId,
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter', 'product'],
                    values: [{ field: 'amount', agg: 'sum' }],
                    maxColumns: max
                })
            ]
        })

    const roomy = make(50)
    const tight = make(3)

    const made = $derived(roomy.columns.visible.filter((c) => isPivotColumn(c.id)).length)
    const refused = $derived(tight.columns.visible.filter((c) => isPivotColumn(c.id)).length)
    const ceiling = $derived(tight.api.pivotMaxColumns?.() ?? 0)

    const code = ['maxColumns: 3', '', 'grid.api.setPivotMaxColumns(50)'].join('\n')
</script>

<Case
    title="Quá nhiều cột thì từ chối"
    what="maxColumns đặt trần cho số cột lá, mặc định 100. Vượt trần thì lưới trả về danh sách phẳng ban đầu kèm một lời nhắn ra console. Nó từ chối chứ không cắt bớt, vì một bảng bị cắt âm thầm trông y hệt một bảng đúng."
    look="Trần 50 sinh {made} cột. Cùng cấu hình mà trần 3 thì sinh {refused} cột: lưới trả lại nguyên 10 dòng gốc, không giao gì cả. Nâng trần lên 50 ngay tại chỗ thì bảng dưới hiện ra, không phải dựng lại lưới."
    {code}
>
    <div class="space-y-3">
        <div class="space-y-1">
            <p class="text-xs text-on-surface-variant">Trần 50: dựng bình thường</p>
            <DataGrid grid={roomy} />
        </div>
        <div class="space-y-1">
            <div class="flex flex-wrap items-center gap-2">
                <p class="text-xs text-on-surface-variant">
                    Trần {ceiling}: {refused === 0 ? 'từ chối, trả về danh sách gốc' : 'dựng được'}
                </p>
                <Button
                    variant="outline"
                    size="xs"
                    label={ceiling > 3 ? 'Hạ trần về 3' : 'Nâng trần lên 50'}
                    onclick={() => tight.api.setPivotMaxColumns?.(ceiling > 3 ? 3 : 50)}
                />
            </div>
            <DataGrid grid={tight} />
        </div>
    </div>

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                Trần này đếm cột lá, tức là đã nhân cả số measure vào. Hai trường ngang với ba
                measure thì một bảng trông có vẻ nhỏ vẫn có thể vượt trần.
            </p>
            <p class="text-on-surface-variant">
                Lưới kiểm trước khi vẽ. Vượt trần thì nó không vẽ gì của pivot cả mà trả lại đúng
                danh sách phẳng ban đầu, kèm một lời nhắn ra console nói rõ trần là bao nhiêu và vì
                sao.
            </p>
            <p class="text-on-surface-variant">
                Từ chối chứ không cắt bớt, vì một bảng bị cắt âm thầm trông y hệt một bảng đúng.
                Người đọc sẽ cộng nhẩm một cột rồi tin vào con số thiếu mất một nửa. Thà không có
                bảng còn hơn có một bảng sai mà không ai biết.
            </p>
            <p class="text-on-surface-variant">
                Gặp trần thì có ba lối: chọn trường ít giá trị hơn, lọc bớt dữ liệu trước khi giao,
                hoặc nâng trần lên và chấp nhận cái bảng rộng sinh ra. Nâng trần là một quyết định
                có ý thức, và đó là điều trần này muốn ép bạn làm.
            </p>
            <p class="text-on-surface-variant">
                Trần đổi được lúc đang chạy qua <code>setPivotMaxColumns</code>, nên lối thứ ba ở
                trên dựng được thành một cái nút "cứ hiện ra đi" mà không phải dựng lại lưới. Hạ
                trần xuống dưới cái bảng đang vẽ thì lưới từ chối ngay, đúng như lúc mới dựng.
            </p>
            <p class="text-on-surface-variant">
                Trần không nằm trong bản chụp trạng thái. Nó là thanh an toàn của ứng dụng, không
                phải thứ người đọc bày ra, nên một view đã lưu không mang theo nó rồi âm thầm nới
                trần cho lần sau.
            </p>
        </div>
    {/snippet}
</Case>
