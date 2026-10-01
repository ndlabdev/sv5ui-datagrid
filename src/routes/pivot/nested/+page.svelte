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
                columns: ['quarter', 'product'],
                values: [{ field: 'amount', agg: 'sum' }],
                columnSubtotal: (header) => header + ' cộng'
            })
        ]
    })

    const code = [
        "columns: ['quarter', 'product'],",
        "columnSubtotal: (header) => header + ' cộng'"
    ].join('\n')
</script>

<Case
    title="Trục cột lồng nhau"
    what="Trục ngang nhận nhiều trường. Mỗi trường thêm một tầng header, và columnSubtotal khép mỗi nhánh bằng một cột tổng con đo từ dòng."
    look="Header hai tầng: quý ở trên, hàng ở dưới. Cột Q1 cộng hiện 460, đúng bằng Widget 300 cộng Gadget 160."
    {code}
>
    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                Nhiều trường chạy ngang nghĩa là khoá trở thành một đường dẫn chứ không còn là một
                giá trị. Q1 / Widget là một khoá, Q1 / Gadget là một khoá khác. Mỗi tầng của đường
                dẫn vẽ ra một tầng header, và chỉ tầng cuối cùng mới là cột thật chứa số.
            </p>
            <p class="text-on-surface-variant">
                Chỉ những đường dẫn thật sự có dòng mới thành cột. Nếu quý nào đó không bán Gadget
                thì không có cột rỗng chen vào, nên bảng không nở ra bằng tích của mọi giá trị.
            </p>
            <p class="text-on-surface-variant">
                columnSubtotal khép từng nhánh. Nó nhận chữ của tầng cha và trả về chữ cho cột tổng
                con, nên bạn đặt tên được theo ngôn ngữ của mình. Con số trong đó đo lại từ dòng của
                cả nhánh, không cộng các cột lá bên cạnh, nên vẫn đúng khi phép rút gọn không phải
                là sum.
            </p>
        </div>
    {/snippet}
</Case>
