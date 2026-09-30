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
</Case>
