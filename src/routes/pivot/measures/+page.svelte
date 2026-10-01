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
                    { field: 'units', agg: 'sum', header: 'Cái' }
                ]
            })
        ]
    })

    const code = [
        'values: [',
        "    { field: 'amount', agg: 'sum', header: 'Tiền' },",
        "    { field: 'units', agg: 'sum', header: 'Cái' }",
        ']'
    ].join('\n')
</script>

<Case
    title="Nhiều measure"
    what="values nhận nhiều measure. Mỗi phép giao khi ấy tách thành nhiều lá, và header mọc thêm một tầng để gọi tên chúng."
    look="Mỗi quý có hai cột con. Trục cột nhân lên theo số measure: 3 quý x 2 measure là 6 lá. Thêm measure thứ ba thành 9."
    {code}
>
    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                Mỗi measure là một cột lá riêng tại mỗi phép giao. Trục cột vì thế nhân lên: số phép
                giao nhân số measure. Ba quý với hai measure ra sáu lá, và đó là phép nhân chứ không
                phải phép cộng, nên nó lớn rất nhanh.
            </p>
            <p class="text-on-surface-variant">
                Tầng header gọi tên measure chỉ mọc ra khi có từ hai measure trở lên. Một measure
                thì không cần tầng ấy, và lưới bỏ nó đi để bảng khỏi cao thêm một dòng vô ích.
            </p>
            <p class="text-on-surface-variant">
                Mỗi measure mang định dạng riêng. Nếu hai measure cùng kiểu và cùng tuỳ chọn thì cột
                tổng dùng chung định dạng ấy; khác nhau thì lưới lùi về một định dạng trung tính
                thay vì mượn bừa định dạng của measure đầu.
            </p>
            <p class="text-on-surface-variant">
                Khi trục cột nở quá rộng vì phép nhân này, valuesOn 'rows' là lối thoát: nó xếp
                measure xuống dọc để số cột không còn nhân lên nữa.
            </p>
        </div>
    {/snippet}
</Case>
