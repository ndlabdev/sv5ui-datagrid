<script lang="ts">
    import { createDataGrid, DataGrid, isPivotColumn, pivot } from '$lib/index.js'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const make = (max: number) =>
        createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: rowId,
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter', 'product'],
                    values: [{ field: 'amount', agg: 'sum' }],
                    maxColumns: max
                })
            ]
        })

    const roomy = make(50)
    const tight = make(3)

    const made = $derived(roomy.columns.visible.filter((c) => isPivotColumn(c.id)).length)
    const refused = $derived(tight.columns.visible.filter((c) => isPivotColumn(c.id)).length)

    const code = 'maxColumns: 3'
</script>

<Case
    title="Quá nhiều cột thì từ chối"
    what="maxColumns đặt trần cho số cột lá, mặc định 100. Vượt trần thì lưới trả về danh sách phẳng ban đầu kèm một lời nhắn ra console. Nó từ chối chứ không cắt bớt, vì một bảng bị cắt âm thầm trông y hệt một bảng đúng."
    look="Trần 50 sinh {made} cột. Cùng cấu hình mà trần 3 thì sinh {refused} cột: lưới trả lại nguyên 10 dòng gốc, không giao gì cả."
    {code}
>
    <div class="space-y-3">
        <div class="space-y-1">
            <p class="text-xs text-on-surface-variant">Trần 50: dựng bình thường</p>
            <DataGrid grid={roomy} />
        </div>
        <div class="space-y-1">
            <p class="text-xs text-on-surface-variant">Trần 3: từ chối, trả về danh sách gốc</p>
            <DataGrid grid={tight} />
        </div>
    </div>
</Case>
