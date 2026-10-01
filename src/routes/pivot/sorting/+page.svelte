<script lang="ts">
    import { createDataGrid, DataGrid, pivot, sorting } from '$lib/index.js'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        features: [
            sorting(),
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }],
                sortableColumns: true,
                totalColumn: 'Cả năm'
            })
        ]
    })

    const code = 'sortableColumns: true'
</script>

<Case
    title="Sắp hàng theo một cột giao"
    what="Cột sinh ra vốn không bấm sắp xếp được, vì nó không phải một trường của dữ liệu. sortableColumns mở quyền ấy, và lưới sắp các hàng gom theo con số trong cột bạn bấm."
    look="Bấm nút Q1 trên header một lần: East 80, North 180, South 200, tức tăng dần. Bấm lần nữa thì đảo thành South, North, East. Bấm Cả năm thì sắp theo tổng: East 300, North 330, South 420. Mặc định tắt."
    {code}
>
    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                Sắp xếp thường đổi chỗ các dòng trong một danh sách phẳng. Ở đây hàng là hàng gom,
                nên pivot phải sắp <strong class="text-on-surface">trong phạm vi anh em</strong>:
                các vùng so với nhau, và nếu trục dọc có tầng thứ hai thì trong mỗi vùng các mặt
                hàng lại so với nhau, chứ không trộn hàng của vùng này sang vùng khác.
            </p>
            <p class="text-on-surface-variant">
                Con số đem ra so là con số đã nằm sẵn trên hàng gom, tức đã đo từ dòng chứ không
                cộng các ô. Nên sắp theo cột Cả năm cho đúng thứ tự tổng, kể cả khi phép rút gọn là
                trung bình.
            </p>
            <p class="text-on-surface-variant">
                Vòng bấm giống hệt một cột thường: lần một tăng dần, lần hai giảm dần, lần ba bỏ sắp
                xếp và trả lại thứ tự tự nhiên của trường chạy dọc. Hàng tổng đứng ngoài vòng ấy, nó
                luôn nằm cuối.
            </p>
            <p class="text-on-surface-variant">
                Mặc định tắt vì một pivot thường được đọc theo thứ tự tự nhiên của trường chạy dọc.
                Bật lên là nói rằng câu hỏi của bạn về độ lớn chứ không về vị trí.
            </p>
        </div>
    {/snippet}
</Case>
