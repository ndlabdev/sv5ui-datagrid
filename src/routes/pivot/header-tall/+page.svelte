<script lang="ts">
    import { createDataGrid, DataGrid, pivot } from '$lib/index.js'
    import { Button, Link } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    const LONG = 'Doanh thu thuần đã trừ chiết khấu'

    let roomy = $state(true)

    const grid = createDataGrid<Sale>({
        data: sales,
        columns: columns.map((column) =>
            column.id === 'region' ? { ...column, header: LONG, width: 150 } : column
        ),
        getRowId: rowId,
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }]
            })
        ]
    })

    $effect(() => {
        grid.headerHeight = roomy ? 64 : undefined
    })

    const code = 'headerHeight: 64'
</script>

<Case
    title="Header lá cần cao hơn"
    what="Chiều này ít được nghĩ tới. Một tiêu đề dài trong cột hẹp bị cắt mất chữ, vì ô header cao đúng bằng một hàng. headerHeight nới riêng hàng ấy mà không làm mọi hàng dữ liệu phình ra theo."
    look="Cột đầu mang một tiêu đề dài. Tắt đi thì chữ bị cắt bởi chiều cao một hàng; bật lên 64px thì nó có chỗ. Các hàng dữ liệu bên dưới không đổi, và trục ngang vẫn nguyên."
    {code}
>
    {#snippet controls()}
        <Button
            variant={roomy ? 'solid' : 'outline'}
            size="sm"
            label={roomy ? 'headerHeight: 64' : 'chưa đặt, theo chiều cao hàng'}
            onclick={() => (roomy = !roomy)}
        />
    {/snippet}

    <DataGrid {grid} />

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                Ô header cắt chữ chứ không tự cao lên, và đó là có chủ ý: chiều cao header quyết
                định chỗ bắt đầu của phần thân, nên để nó tự nở theo nội dung thì bảng sẽ nhảy mỗi
                lần bạn đổi tên cột hay kéo hẹp một cột lại.
            </p>
            <p class="text-on-surface-variant">
                <code>headerHeight</code> là chỗ bạn nói ra con số ấy. Nó chỉ nới hàng header lá.
                Hàng dữ liệu vẫn theo <code>density</code>, hàng lọc vẫn theo chiều cao hàng, và
                tầng nhóm có <code>groupHeaderHeight</code> riêng.
            </p>
            <p class="text-on-surface-variant">
                Hai hướng này đi cùng nhau trên một bảng thật: nới hàng lá cho tiêu đề đọc được, và
                hạ tầng nhóm vì khoá trong đó ngắn. Trang
                <Link href="/pivot/header-height">Chiều cao của header</Link> có bảng đo thẳng từ DOM
                để bạn thử cả hai một lượt.
            </p>
            <p class="text-on-surface-variant">
                Muốn chữ tự gãy dòng thì tiêu đề nhận được một snippet, và chiều cao bạn đặt ở đây
                là chỗ cho nó. Hai thứ ấy rời nhau: lưới không đoán hộ bạn cần mấy dòng.
            </p>
        </div>
    {/snippet}
</Case>
