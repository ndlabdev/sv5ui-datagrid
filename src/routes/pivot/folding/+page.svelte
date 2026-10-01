<script lang="ts">
    import { columnOps, createDataGrid, DataGrid, pivot } from '$lib/index.js'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const make = (subtotal: boolean) =>
        createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: rowId,
            features: [
                columnOps(),
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter', 'product'],
                    values: [{ field: 'amount', agg: 'sum' }],
                    columnGroups: 'open',
                    ...(subtotal ? { columnSubtotal: (header: string) => header + ' cộng' } : {})
                })
            ]
        })

    const withSubtotal = make(true)
    const noSubtotal = make(false)

    const code = "columnGroups: 'open'"
</script>

<Case
    title="Gập một nhánh cột"
    what="Nhóm header trên trục ngang gập lại được, nên bảng rộng đọc được từng nhánh một. Nút gập do columnOps() vẽ."
    look="Bấm mũi tên trên header Q1 ở lưới trên: nhánh co lại còn mỗi cột cộng. Lưới dưới không có tổng con nên gập thành một dải hẹp thay vì biến mất."
    {code}
>
    <div class="space-y-3">
        <div class="space-y-1">
            <p class="text-xs text-on-surface-variant">Có tổng con</p>
            <DataGrid grid={withSubtotal} />
        </div>
        <div class="space-y-1">
            <p class="text-xs text-on-surface-variant">Không có tổng con</p>
            <DataGrid grid={noSubtotal} />
        </div>
    </div>

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                columnGroups đổi nhóm header từ cố định sang gập được. Nút gập do columnOps() vẽ,
                nên hai tính năng này phải đi cùng nhau; thiếu columnOps() thì nhóm vẫn đúng nhưng
                không có gì để bấm.
            </p>
            <p class="text-on-surface-variant">
                Gập là việc của tầng cột, không phải của phép đo. Không dòng nào bị bỏ đi và không
                con số nào tính lại, chỉ là các cột lá của nhánh ấy thôi hiển thị.
            </p>
            <p class="text-on-surface-variant">
                Có tổng con thì nhánh gập về đúng cột tổng con ấy, nên vẫn còn một con số đại diện.
                Không có tổng con thì chẳng còn gì để hiện, và lưới gập nhánh thành một dải hẹp chứ
                không xoá hẳn, để bạn biết chỗ ấy đang đóng và bấm mở lại được.
            </p>
            <p class="text-on-surface-variant">
                Trạng thái gập nằm trong bản chụp trạng thái, nên một view đã lưu mở lại đúng những
                nhánh đang mở lúc lưu.
            </p>
        </div>
    {/snippet}
</Case>
