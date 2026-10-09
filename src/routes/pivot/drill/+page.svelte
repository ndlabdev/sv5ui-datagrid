<script lang="ts">
    import { createDataGrid, DataGrid, getPivot, isPivotColumn, pivot } from '$lib/index.js'
    import { Button } from 'sv5ui'
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
                values: [{ field: 'amount', agg: 'sum' }]
            })
        ]
    })

    let behind = $state<{ cell: string; rows: Sale[] } | null>(null)

    function columnAt(cell: Element): string | undefined {
        const at = Number(cell.getAttribute('data-dg-cell')?.split(':')[1])
        return Number.isInteger(at) ? grid.columns.visible[at]?.id : undefined
    }

    function open(nodeId: string, columnId: string) {
        const node = grid.preWindowNodes.find((candidate) => candidate.id === nodeId)
        if (!node) return

        const header = grid.columns.visible.find((column) => column.id === columnId)?.def.header
        behind = {
            cell: String(header ?? columnId),
            rows: getPivot(grid)!.rowsBehind(node, columnId)
        }
    }

    function onDoubleClick(event: MouseEvent) {
        const cell = (event.target as HTMLElement | null)?.closest('[data-dg-cell]')
        const nodeId = cell?.closest('[data-dg-row-id]')?.getAttribute('data-dg-row-id')
        if (!cell || !nodeId) return

        const columnId = columnAt(cell)
        if (columnId && isPivotColumn(columnId)) open(nodeId, columnId)
    }

    const code = 'getPivot(grid).rowsBehind(node, columnId)'
</script>

<Case
    title="Những dòng đứng sau một ô"
    what="rowsBehind trả về đúng các dòng gốc đã đo thành con số trong một ô. Một hàng gom không mở ra được, nên đây là lối duy nhất đi xuống dữ liệu thô, và nó trả về các dòng còn lại sau bộ lọc."
    look="Bấm đúp vào ô North / Q1 (180): bảng bên dưới hiện đúng hai dòng 100 và 80, cộng lại bằng 180."
    {code}
>
    <div ondblclick={onDoubleClick} role="presentation">
        <DataGrid {grid} />
    </div>

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                Một hàng của pivot là một nhóm, không phải một dòng, nên bung nó ra không có nghĩa
                gì: bên dưới nó không có hàng con nào cả. Vì vậy lối đi xuống dữ liệu thô không phải
                là mở hàng, mà là hỏi một ô cụ thể.
            </p>
            <p class="text-on-surface-variant">
                rowsBehind nhận đúng hai thứ xác định một ô: node của hàng và id của cột. Từ đó nó
                dựng lại tập dòng vừa thuộc hàng ấy vừa thuộc cột ấy, tức đúng tập mà con số trong ô
                đã được đo trên đó.
            </p>
            <p class="text-on-surface-variant">
                Nó trả về các dòng còn lại sau bộ lọc, không phải mọi dòng của dữ liệu gốc. Đó là
                điều phải thế: con số trong ô cũng chỉ đo trên chừng ấy dòng, nên cộng tay danh sách
                trả về luôn ra đúng con số đang hiện.
            </p>
            <p class="text-on-surface-variant">
                Trang này lấy id cột từ thuộc tính data-dg-cell của ô được bấm chứ không lấy theo vị
                trí. Hai thứ ấy lệch nhau ngay khi có cột ghim, nên bám vào chỉ số là một lỗi chỉ lộ
                ra khi người dùng ghim cột lại.
            </p>
        </div>

        {#if behind}
            <div class="space-y-2 rounded-lg border border-outline-variant p-4">
                <div class="flex items-center justify-between">
                    <h2 class="text-sm font-medium text-on-surface">
                        {behind.rows.length} dòng sau ô {behind.cell}, cộng lại bằng
                        {behind.rows.reduce((total, row) => total + row.amount, 0)}
                    </h2>
                    <Button
                        variant="ghost"
                        size="sm"
                        label="Đóng"
                        onclick={() => (behind = null)}
                    />
                </div>
                <table class="w-full text-left text-xs">
                    <tbody class="text-on-surface-variant">
                        {#each behind.rows as row (row.id)}
                            <tr class="border-t border-outline-variant">
                                <td class="px-2 py-1">{row.region}</td>
                                <td class="px-2 py-1">{row.quarter}</td>
                                <td class="px-2 py-1">{row.product}</td>
                                <td class="px-2 py-1 text-right">{row.amount}</td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    {/snippet}
</Case>
