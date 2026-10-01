<script lang="ts">
    import { createDataGrid, DataGrid, pivot } from '$lib/index.js'
    import { Button } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const ORDER = ['Small', 'Medium', 'Large', 'Huge']

    let declared = $state(true)

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['size'],
                values: [{ field: 'amount', agg: 'sum' }],
                get columnKeys() {
                    return declared
                        ? (field: string) => (field === 'size' ? ORDER : undefined)
                        : undefined
                }
            })
        ]
    })

    const code = "columnKeys: () => ['Small', 'Medium', 'Large', 'Huge']"
</script>

<Case
    title="Tự khai khoá cột"
    what="Mặc định khoá xếp theo chính giá trị, nên chữ xếp theo bảng chữ cái. columnKeys thay bằng danh sách ứng dụng biết, kể cả khoá chưa có dòng nào."
    look="Tắt đi thì thành Large, Medium, Small, sai hẳn về nghĩa. Bật lên thì đúng thứ tự cỡ, và có thêm cột Huge đứng trống chờ sẵn."
    {code}
>
    {#snippet controls()}
        <Button
            variant={declared ? 'solid' : 'outline'}
            size="sm"
            label={declared ? 'Đang dùng thứ tự tự khai' : 'Đang để dữ liệu tự xếp'}
            onclick={() => (declared = !declared)}
        />
    {/snippet}

    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                Không khai thì thứ tự khoá do dữ liệu quyết định, mà dữ liệu thì không biết Small
                nhỏ hơn Medium. Nó chỉ biết chữ, nên xếp theo bảng chữ cái và cho ra một thứ tự vô
                nghĩa.
            </p>
            <p class="text-on-surface-variant">
                columnKeys nhận tên trường và trả về danh sách khoá bạn muốn, theo đúng thứ tự ấy.
                Trả về undefined cho trường nào thì trường ấy quay về cách tự xếp, nên trục nhiều
                tầng khai được từng tầng một.
            </p>
            <p class="text-on-surface-variant">
                Khoá bạn khai mà chưa dòng nào rơi vào vẫn thành cột, và cột ấy đứng trống. Đó là
                điểm khác quan trọng nhất: một bảng báo cáo giữ nguyên hình dạng qua các kỳ, kỳ nào
                chưa có số thì để trống chứ không làm lệch cả bảng.
            </p>
            <p class="text-on-surface-variant">
                Chiều ngược lại cũng cần nhớ: dữ liệu có khoá mà bạn không khai thì khoá ấy biến mất
                khỏi bảng. Danh sách bạn đưa là danh sách đầy đủ, không phải gợi ý thứ tự.
            </p>
        </div>
    {/snippet}
</Case>
