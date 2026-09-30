<script lang="ts">
    import { createDataGrid, DataGrid, pivot } from '$lib/index.js'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const NAMES: Record<string, string> = {
        Q1: 'Quý một',
        Q2: 'Quý hai',
        Q3: 'Quý ba'
    }

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter', 'product'],
                values: [{ field: 'amount', agg: 'sum' }],
                columnHeader: (key, depth) =>
                    depth === 0 ? (NAMES[key] ?? key) : key.toUpperCase()
            })
        ]
    })

    const code = [
        'columnHeader: (key, depth) =>',
        '    depth === 0 ? NAMES[key] : key.toUpperCase()'
    ].join('\n')
</script>

<Case
    title="Tự đặt chữ cho header"
    what="columnHeader quyết định chữ trên mỗi header sinh ra. Nó nhận khoá, độ sâu của tầng, và giá trị gốc trước khi định dạng."
    look="Tầng trên hiện Quý một tới Quý ba thay vì Q1 tới Q3, tầng dưới viết hoa tên hàng. Hai tầng hai quy tắc, vì hàm nhận được depth."
    {code}
>
    <DataGrid {grid} />
</Case>
