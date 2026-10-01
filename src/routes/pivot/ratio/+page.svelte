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
                values: [
                    { field: 'amount', agg: 'sum', header: 'Tiền' },
                    { field: 'units', agg: 'sum', header: 'Cái' },
                    { field: 'amount', agg: 'sum', per: 'units', type: 'number', header: 'Đơn giá' }
                ]
            })
        ]
    })

    const code = ["{ field: 'amount', agg: 'sum', per: 'units', type: 'number' }"].join('\n')
</script>

<Case
    title="Chia measure này cho measure kia"
    what="per lấy một measure chia cho một measure khác. Nó chia hai kết quả rút gọn, không chia từng dòng rồi lấy trung bình."
    look="North Q1: 180 tiền trên 14 cái ra 12.86. Hai dòng gốc có đơn giá 10 và 20, trung bình của chúng là 15. Hai con số khác nhau, và 12.86 mới là đơn giá thật."
    {code}
>
    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                per chia kết quả rút gọn cho kết quả rút gọn, theo đúng thứ tự: đo tử số trên cả tập
                dòng, đo mẫu số trên cả tập dòng ấy, rồi mới chia. Nó không chia từng dòng rồi lấy
                trung bình các thương.
            </p>
            <p class="text-on-surface-variant">
                Hai cách cho hai con số khác nhau và cách thứ nhất mới đúng. Chia theo dòng rồi lấy
                trung bình coi mọi dòng nặng ngang nhau, nên một dòng bán 1 cái ảnh hưởng ngang một
                dòng bán 100 cái. Đây chính là cái bẫy trung bình của trung bình, lần này nấp trong
                một phép chia.
            </p>
            <p class="text-on-surface-variant">
                Mẫu số bằng không cho ô trống, không phải vô cực và cũng không phải 0. Không bán cái
                nào thì không có đơn giá nào để nói.
            </p>
            <p class="text-on-surface-variant">
                Vì kết quả là một phép chia chứ không còn là trường gốc, cột sinh ra không mượn định
                dạng của trường nữa. Bạn tự khai type cho nó, như demo này khai number.
            </p>
        </div>
    {/snippet}
</Case>
