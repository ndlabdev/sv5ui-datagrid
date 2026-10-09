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
                columns: ['shipped'],
                values: [{ field: 'amount', agg: 'sum' }]
            })
        ]
    })

    const code = "columns: ['shipped']"
</script>

<Case
    title="Khoá xếp theo giá trị, không theo chuỗi"
    what="Trục ngang xếp khoá theo bản thân giá trị chứ không theo cách in ra, nên trục số thì đếm còn trục ngày thì chạy theo thời gian. Mỗi khoá lại vẽ qua đúng bộ định dạng của cột nó sinh ra từ đó."
    look="Trục ngang là cột Ngày giao kiểu date. Header chạy theo thời gian và hiện dưới dạng ngày, không phải chuỗi ISO."
    {code}
>
    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                Khoá giữ cả giá trị gốc lẫn chuỗi dùng làm id. Lưới sắp theo giá trị gốc, nên số thì
                đếm theo số và ngày thì chạy theo thời gian. Nếu sắp theo chuỗi thì ngày 2 tháng 1
                sẽ đứng sau ngày 10 tháng 1, và trục số sẽ ra 1, 10, 2.
            </p>
            <p class="text-on-surface-variant">
                Chuỗi id chỉ để nhận dạng cột, không bao giờ để sắp xếp. Nó cũng là thứ được ghi vào
                bản chụp trạng thái, nên một view đã lưu vẫn tìm đúng cột sau khi nạp lại.
            </p>
            <p class="text-on-surface-variant">
                Chữ in trên header thì đi qua đúng bộ định dạng của cột mà khoá sinh ra từ đó. Trục
                ngày ra ngày theo ngôn ngữ đang dùng, trục tiền ra tiền. Muốn tự đặt chữ thì dùng
                columnHeader, còn muốn tự đặt thứ tự thì dùng columnKeys.
            </p>
            <p class="text-on-surface-variant">
                Giá trị rỗng gom chung vào một khoá và đứng cuối, mang nhãn theo ngôn ngữ đang dùng.
                Nó là một khoá thật, nên vẫn đo và vẫn vào cột tổng.
            </p>
        </div>
    {/snippet}
</Case>
