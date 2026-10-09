<script lang="ts">
    import { createDataGrid, DataGrid, isPivotColumn, pivot } from '$lib/index.js'
    import { Button } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, salesWithQ4, type Sale } from '../demo-data.js'

    let grown = $state(false)

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

    const grow = () => {
        grown = !grown
        grid.data = grown ? salesWithQ4 : sales
    }

    const leaves = $derived(grid.columns.visible.filter((c) => isPivotColumn(c.id)).length)

    const code = [
        'pivot({',
        "    rows: ['region'],",
        "    columns: ['quarter'],",
        "    values: [{ field: 'amount', agg: 'sum' }]",
        '})'
    ].join('\n')
</script>

<Case
    title="Phép giao"
    what="Một trường gom xuống thành hàng, một trường gom ngang thành cột, ô nơi hai chiều gặp nhau giữ kết quả rút gọn. Các cột không do mã khai mà do lưới đọc dữ liệu rồi sinh ra, nên dữ liệu có thêm giá trị nào là có thêm cột ấy."
    look="10 dòng thành 3 hàng. Cộng hàng North: 180 + 150 = 330. Bấm thêm quý thì số cột nhảy từ 3 lên 4 và Q4 hiện ra đúng chỗ, không dòng mã nào khai nó."
    {code}
>
    {#snippet controls()}
        <Button
            variant="outline"
            size="sm"
            label={grown ? 'Bỏ Q4 đi' : 'Thêm hai dòng quý Q4'}
            onclick={grow}
        />
        <span class="text-sm text-on-surface-variant">{leaves} cột sinh ra</span>
    {/snippet}

    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                Lưới không hề biết trước sẽ có bao nhiêu cột. Nó quét các dòng còn lại sau bộ lọc,
                nhặt ra mọi giá trị khác nhau của trường chạy ngang, và mỗi giá trị ấy thành một
                khoá. Khoá rồi thành một cột lá, với id do lưới tự đặt chứ không phải id bạn khai.
            </p>
            <p class="text-on-surface-variant">
                Hệ quả đáng nhớ: cột là hàm của dữ liệu. Thêm dòng Q4 thì có cột Q4, lọc hết Q3 đi
                thì cột Q3 biến mất. Mã của bạn không khai cột nào trong số đó, nên cũng đừng viết
                mã nào bám vào tên chúng.
            </p>
            <p class="text-on-surface-variant">
                Ô nơi hai chiều gặp nhau không giữ một dòng. Nó giữ kết quả của phép rút gọn chạy
                trên tập dòng vừa thuộc hàng ấy vừa thuộc cột ấy. Không dòng nào rơi vào chỗ giao
                thì ô không mang giá trị và lưới vẽ dấu ô rỗng, chứ không vẽ số 0. North không bán
                gì ở Q3, mà không có gì khác hẳn bằng không: một cái bị phép rút gọn bỏ qua, cái kia
                được đem vào tính.
            </p>
        </div>
    {/snippet}
</Case>
