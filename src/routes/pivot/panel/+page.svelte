<script lang="ts">
    import { createDataGrid, DataGrid, Grid, pivot } from '$lib/index.js'
    import { viVN } from '$lib/locales/index.js'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        locales: [viVN],
        locale: 'vi-VN',
        features: [
            pivot<Sale>({
                rows: ['region', 'product'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }]
            })
        ]
    })

    const code = '<Grid.PivotPanel {grid} />'
</script>

<Case
    title="Bảng điều khiển"
    what="Grid.PivotPanel vẽ bốn vùng mà một pivot được mô tả bằng: trường chạy dọc, trường chạy ngang, các measure, và phần cài đặt chung. Mỗi vùng thêm bớt trường được, mỗi measure đổi được phép rút gọn lẫn cách đọc tỉ lệ."
    look="Không cần kéo thả: mỗi vùng có nút thêm riêng, mỗi chip có nút dời và nút gỡ. Gỡ trường cuối cùng khỏi một trục thì phép giao tắt, đó là hành vi đúng. Trục dọc ở đây có hai trường, nên vùng thiết lập hiện thêm nút bung hết tầng."
    {code}
>
    {#snippet controls()}
        <Grid.PivotPanel {grid} />
    {/snippet}

    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                Bảng này không giữ trạng thái riêng. Nó đọc thẳng từ lưới và viết ngược lại qua api,
                nên nó với lưới không bao giờ lệch nhau, và mọi thứ nó làm bạn cũng làm được bằng
                mã.
            </p>
            <p class="text-on-surface-variant">
                Bốn vùng tương ứng bốn phần của một mô tả pivot: trường chạy dọc, trường chạy ngang,
                các measure, và phần cài đặt chung. Ba vùng đầu là danh sách có thứ tự, vì thứ tự
                trong đó chính là thứ tự tầng của nhóm và của header.
            </p>
            <p class="text-on-surface-variant">
                Không có kéo thả. Mỗi vùng có nút thêm riêng, mỗi chip có nút dời chỗ và nút gỡ, nên
                toàn bộ thao tác đi được bằng bàn phím và đọc được bằng trình đọc màn hình. Kéo thả
                đẹp hơn nhưng loại hẳn một nhóm người dùng.
            </p>
            <p class="text-on-surface-variant">
                Gỡ trường cuối cùng khỏi một trục thì phép giao tắt và bảng về dạng phẳng. Đó là
                hành vi đúng chứ không phải lỗi: một pivot thiếu một trục thì không còn là pivot
                nữa.
            </p>
            <p class="text-on-surface-variant">
                Trục dọc nhiều trường thì hàng lồng nhau và mặc định gập hết, nên vùng thiết lập có
                một nút bung hết tầng. Nó đọc trạng thái thật của lưới: mở một hàng bằng tay thì
                nhãn đổi thành gập. Trục một trường không lồng được nên nút không hiện.
            </p>
        </div>
    {/snippet}
</Case>
