<script lang="ts">
    import { createDataGrid, DataGrid, pivot } from '$lib/index.js'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

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

    const code = ["totalColumn: 'Cả năm',", "totalRow: 'Tất cả'"].join('\n')
</script>

<Case
    title="Hàng tổng và cột tổng"
    what="totalColumn khép chiều ngang, totalRow khép chiều dọc. Cả hai đều đo từ dòng nên vẫn đúng khi bạn đổi phép rút gọn."
    look="Cột cuối: 330, 420, 300. Hàng cuối: 460, 370, 220. Cả hai chiều đều dẫn về ô góc 1050."
    {code}
>
    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                Hai cái tổng này không phải một hàng và một cột thêm vào cho đẹp. Chúng là cùng một
                phép rút gọn chạy trên một tập dòng rộng hơn: cột tổng chạy trên mọi dòng của hàng
                ấy bất kể quý, hàng tổng chạy trên mọi dòng của quý ấy bất kể vùng.
            </p>
            <p class="text-on-surface-variant">
                Vì thế ô góc 1050 đo trên cả mười dòng một lượt. Nó trùng với tổng của cột tổng và
                cũng trùng với tổng của hàng tổng, nhưng đó là sự trùng khớp của phép cộng chứ không
                phải cách nó được tính. Đổi agg sang avg thì ba con số ấy lập tức khác nhau, và cả
                ba vẫn đúng.
            </p>
            <p class="text-on-surface-variant">
                Hàng tổng đứng ngoài mọi thứ sắp xếp và cắt bớt. Sắp hàng theo một cột thì nó vẫn
                nằm cuối, giữ lại top N thì nó vẫn đo trên toàn bộ. Nó trả lời một câu hỏi khác với
                các hàng còn lại.
            </p>
        </div>
    {/snippet}
</Case>
