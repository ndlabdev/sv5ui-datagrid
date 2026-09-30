<script lang="ts">
    import {
        createDataGrid,
        DataGrid,
        pivot,
        serverRowModel,
        type ColumnDef,
        type GetRowsRequest,
        type GetRowsResult
    } from '$lib/index.js'
    import Case from '../Case.svelte'
    import { sales } from '../demo-data.js'

    interface Crossed {
        id: number
        region: string
        amount: number
        pivot?: Record<string, unknown>
    }

    const serverColumns: ColumnDef<Crossed>[] = [
        { id: 'region', header: 'Vùng', width: 120 },
        { id: 'amount', header: 'Tiền', type: 'number', width: 100 }
    ]

    let seen = $state<GetRowsRequest | null>(null)

    async function getRows(request: GetRowsRequest): Promise<GetRowsResult<Crossed>> {
        seen = request

        const regions = [...new Set(sales.map((sale) => sale.region))]
        const quarters = [...new Set(sales.map((sale) => sale.quarter))].sort()

        const rows: Crossed[] = regions.map((region, index) => {
            const cells: Record<string, unknown> = {}
            for (const quarter of quarters) {
                const belong = sales.filter((s) => s.region === region && s.quarter === quarter)
                if (belong.length > 0) {
                    cells[quarter] = [belong.reduce((total, s) => total + s.amount, 0)]
                }
            }
            return { id: index + 1, region, amount: 0, pivot: cells }
        })

        return { rows, rowCount: rows.length, pivotColumns: quarters.map((key) => [key]) }
    }

    const grid = createDataGrid<Crossed>({
        data: [],
        columns: serverColumns,
        getRowId: (row) => String(row.id),
        rowModel: 'server',
        features: [
            pivot<Crossed>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }]
            }),
            serverRowModel<Crossed>({ getRows }, { mode: 'paged' })
        ]
    })

    const code = "result.pivotColumns = [['Q1'], ['Q2'], ['Q3']]"
</script>

<Case
    title="Server giao thay cho client"
    what="Với rowModel là server, client không bao giờ tự giao. Phép giao đi kèm mọi lần gọi dữ liệu, và server trả về cả trục cột lẫn các hàng đã đo, vì chỉ bên nắm toàn bộ dữ liệu mới trả lời đúng được."
    look="Khối JSON bên dưới là yêu cầu thật lưới vừa gửi. Trục cột đến từ pivotColumns trong câu trả lời, các con số đến từ trường pivot lồng trong mỗi hàng."
    {code}
>
    <DataGrid {grid} />

    {#snippet after()}
        {#if seen}
            <pre
                class="overflow-auto rounded-lg bg-surface-container p-4 text-xs text-on-surface-variant">{JSON.stringify(
                    seen.pivot,
                    null,
                    2
                )}</pre>
        {/if}
    {/snippet}
</Case>
