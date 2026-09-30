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
</Case>
