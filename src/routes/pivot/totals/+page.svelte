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
                values: [{ field: 'amount', agg: 'avg' }],
                totalColumn: 'Trung bình'
            })
        ]
    })

    const code = ["values: [{ field: 'amount', agg: 'avg' }],", "totalColumn: 'Trung bình'"].join(
        '\n'
    )
</script>

<Case
    title="Tổng đo từ dòng, không cộng ô"
    what="Mọi con số tổng đều được đo lại từ các dòng gốc, không bao giờ cộng các ô nằm cạnh nó."
    look="North có hai ô 90 và 150, trung bình của chúng là 120. Nhưng cột tổng hiện 110."
    {code}
>
    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Vì sao 110 mới đúng</h2>
            <p class="text-on-surface-variant">
                North có ba dòng: 100 và 80 rơi vào Q1, 150 rơi vào Q2. Trung bình thật là (100 + 80
                + 150) / 3 = <strong class="text-on-surface">110</strong>.
            </p>
            <p class="text-on-surface-variant">
                Lấy trung bình của hai ô ra 120, vì cách ấy coi Q1 và Q2 nặng ngang nhau. Nhưng Q1
                đứng cho 2 dòng còn Q2 chỉ 1 dòng. Tính đúng trọng số: (90 x 2 + 150 x 1) / 3 = 110.
                Trung bình của các trung bình đã đánh rơi số lượng.
            </p>
            <p class="text-on-surface-variant">
                Hàng East là đối chứng: mỗi ô của nó chỉ có một dòng nên hai cách trùng nhau, đều ra
                100. Cái bẫy chỉ lộ khi các ô không đều nhau.
            </p>
            <p class="text-on-surface-variant">
                Với sum thì hai cách luôn trùng, nên không ai để ý cho tới ngày đổi sang avg, và lúc
                đó con số sai vẫn trông rất hợp lý. Luật này chi phối cả totalRow, columnSubtotal và
                mọi cách đọc theo tỉ lệ.
            </p>
        </div>
    {/snippet}
</Case>
