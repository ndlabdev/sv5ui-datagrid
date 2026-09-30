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
</Case>
