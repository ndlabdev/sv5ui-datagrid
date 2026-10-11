<script lang="ts">
    import { createDataGrid, DataGrid, pivot } from '$lib/index.js'
    import { Button } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const NAMES: Record<string, string> = { Q1: 'Quý một', Q2: 'Quý hai', Q3: 'Quý ba' }

    let own = $state(true)

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter', 'product'],
                values: [{ field: 'amount', agg: 'sum' }],
                get columnHeader() {
                    return own
                        ? (key: string, depth: number) =>
                              depth === 0 ? (NAMES[key] ?? key) : key.toUpperCase()
                        : undefined
                }
            })
        ]
    })

    const code = [
        'columnHeader: (key, depth, value) =>',
        '    depth === 0 ? NAMES[key] : key.toUpperCase()'
    ].join('\n')
</script>

<Case
    title="Tự đặt chữ cho header sinh ra"
    what="Cột của một phép giao sinh ra lúc chạy, nên chữ trên đầu chúng cũng do lưới quyết định. columnHeader là chỗ ứng dụng giành lại quyền ấy."
    look="Tầng trên hiện Quý một tới Quý ba thay vì Q1 tới Q3, tầng dưới viết hoa tên hàng. Tắt đi thì cả hai trở về đúng giá trị trong dữ liệu."
    {code}
>
    {#snippet controls()}
        <Button
            variant={own ? 'solid' : 'outline'}
            size="sm"
            label={own ? 'Đang tự đặt chữ' : 'Đang để lưới tự vẽ'}
            onclick={() => (own = !own)}
        />
    {/snippet}

    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                Hàm nhận ba thứ. <code>key</code> là chuỗi khoá, tức giá trị đã hoá thành chữ để làm
                id cột. <code>depth</code> là tầng header, đếm từ 0 ở ngoài cùng, nên một trục hai
                trường thì tầng 0 là quý và tầng 1 là hàng. <code>value</code> là giá trị gốc trước khi
                định dạng, nên với trục ngày bạn nhận được chính đối tượng Date chứ không phải chuỗi.
            </p>
            <p class="text-on-surface-variant">
                Không khai thì lưới vẽ khoá qua đúng bộ định dạng của cột nguồn: trục ngày ra ngày,
                trục tiền ra tiền, ô trống ra nhãn "trống" theo ngôn ngữ đang dùng. columnHeader
                thay toàn bộ quyết định ấy, nên nếu bạn chỉ muốn đổi vài khoá thì nhớ trả về
                <code>key</code> cho phần còn lại.
            </p>
            <p class="text-on-surface-variant">
                Chữ này chỉ là chữ. Nó không đổi id cột, không đổi thứ tự, không đổi cách đo. Đổi
                thứ tự thì dùng columnKeys hoặc orderColumns.
            </p>
        </div>
    {/snippet}
</Case>
