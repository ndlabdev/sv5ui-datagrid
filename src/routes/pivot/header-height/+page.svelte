<script lang="ts">
    import { columnOps, createDataGrid, DataGrid, pivot } from '$lib/index.js'
    import { Button, Link } from 'sv5ui'
    import Case from '../Case.svelte'
    import { columns, rowId, sales, type Sale } from '../demo-data.js'

    let header = $state<number | undefined>(undefined)
    let group = $state<number | undefined>(undefined)

    const grid = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: rowId,
        features: [
            columnOps<Sale>(),
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter', 'product'],
                values: [
                    { field: 'amount', agg: 'sum', header: 'Tiền' },
                    { field: 'units', agg: 'sum', header: 'Cái' }
                ]
            })
        ]
    })

    $effect(() => {
        grid.headerHeight = header
        grid.groupHeaderHeight = group
    })

    let box = $state<HTMLElement | null>(null)
    let measured = $state({ leaf: 0, tiers: [] as number[], row: 0, total: 0 })

    const px = (element: Element | null | undefined): number =>
        element ? Math.round(element.getBoundingClientRect().height) : 0

    $effect(() => {
        void header
        void group
        if (!box) return

        const read = () => {
            if (!box) return
            const tiers = Array.from(box.querySelectorAll('[data-dg-header-cell]'))
            const seen: string[] = []
            const levels: number[] = []
            for (const cell of tiers) {
                const level = (cell.getAttribute('data-dg-header-cell') ?? '').split(':')[0] ?? ''
                if (seen.includes(level)) continue
                seen.push(level)
                levels.push(px(cell))
            }
            const leaf = px(
                box.querySelector(
                    '[role="columnheader"]:not([aria-expanded]):not([data-dg-header-cell])'
                )
            )
            measured = {
                leaf,
                tiers: levels,
                row: px(box.querySelector('[role="row"][data-dg-row-id] [role="gridcell"]')),
                total: leaf + levels.reduce((sum, one) => sum + one, 0)
            }
        }

        const frame = requestAnimationFrame(read)
        return () => cancelAnimationFrame(frame)
    })

    const code = [
        'createDataGrid({',
        '    headerHeight: 56,      // hang header la',
        '    groupHeaderHeight: 22  // moi tang nhom',
        '})'
    ].join('\n')
</script>

<Case
    title="Chiều cao của header"
    what="Trục cột lồng nhau dựng một tầng header cho mỗi trường, cộng một tầng nữa để gọi tên measure. Ba tầng theo chiều cao hàng thì phần header cao hơn cả phần dữ liệu, trong khi chữ trong đó chỉ là những khoá ngắn."
    look="Bấm các nút rồi nhìn bảng số bên dưới: nó đo thẳng từ DOM chứ không in lại con số bạn vừa đặt. Hạ tầng nhóm xuống 22 thì tổng chiều cao header tụt gần một nửa, mà hàng dữ liệu không nhúc nhích."
    {code}
>
    {#snippet controls()}
        <span class="text-xs text-on-surface-variant">Hàng lá</span>
        {#each [undefined, 32, 56, 72] as choice (String(choice))}
            <Button
                variant={header === choice ? 'solid' : 'outline'}
                size="xs"
                label={choice === undefined ? 'theo hàng' : `${choice}px`}
                onclick={() => (header = choice)}
            />
        {/each}
        <span class="ms-3 text-xs text-on-surface-variant">Tầng nhóm</span>
        {#each [undefined, 18, 22, 30] as choice (String(choice))}
            <Button
                variant={group === choice ? 'solid' : 'outline'}
                size="xs"
                label={choice === undefined ? 'theo hàng' : `${choice}px`}
                onclick={() => (group = choice)}
            />
        {/each}
    {/snippet}

    <div bind:this={box}>
        <DataGrid {grid} />
    </div>

    <div class="rounded-lg border border-outline-variant p-4 text-sm" data-dg-measured>
        <h2 class="mb-2 font-medium text-on-surface">Đo thẳng từ DOM</h2>
        <dl class="grid grid-cols-2 gap-1 text-on-surface-variant sm:grid-cols-4">
            <div>
                <dt class="text-xs">Hàng header lá</dt>
                <dd>{measured.leaf}px</dd>
            </div>
            <div>
                <dt class="text-xs">{measured.tiers.length} tầng nhóm</dt>
                <dd>{measured.tiers.join(' + ') || 'không có'}px</dd>
            </div>
            <div>
                <dt class="text-xs">Tổng chiều cao header</dt>
                <dd class="font-medium text-on-surface">{measured.total}px</dd>
            </div>
            <div>
                <dt class="text-xs">Hàng dữ liệu</dt>
                <dd>{measured.row}px</dd>
            </div>
        </dl>
    </div>

    {#snippet after()}
        <div class="space-y-2 rounded-lg border border-outline-variant p-4 text-sm">
            <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
            <p class="text-on-surface-variant">
                Có hai con số, không phải một. <code>headerHeight</code> là hàng header lá, chỗ mang
                tên cột thật và các nút sắp xếp, lọc, menu. <code>groupHeaderHeight</code> là mỗi tầng
                nhóm phía trên nó. Tách ra vì hai chỗ ấy chứa hai loại chữ: hàng lá có thể cần chỗ cho
                một tiêu đề gãy hai dòng, còn tầng nhóm của một phép giao chỉ có Q1 hay Widget.
            </p>
            <p class="text-on-surface-variant">
                <code>groupHeaderHeight</code> đếm
                <strong class="text-on-surface">theo từng tầng</strong>, không phải cho cả khối.
                Trục càng sâu thì càng tiết kiệm được nhiều, và đó đúng là lúc bạn cần tới nó. Bảng
                số ở trên cộng sẵn để bạn thấy phép nhân ấy.
            </p>
            <p class="text-on-surface-variant">
                Không đặt thì cả hai đi theo chiều cao hàng mà <code>density</code> quyết định, nên
                một lưới không khai gì trông y như trước. Đặt rồi thì nó thôi nghe
                <code>density</code>: đổi mật độ không kéo header về nữa.
            </p>
            <p class="text-on-surface-variant">
                Cả hai là biến CSS trên gốc lưới, nên đổi lúc đang chạy không dựng lại gì. Trang này
                đổi đúng theo lối ấy, và các nút ở trên là bằng chứng.
            </p>
            <p class="text-on-surface-variant">
                Hàng lọc không đi theo <code>headerHeight</code>. Nó giữ chiều cao hàng vì nó chứa ô
                nhập, và một ô nhập cao 72px thì không ai muốn.
            </p>
            <p class="text-on-surface-variant">
                Pivot không có con số riêng của mình, và đó là có chủ ý. Tầng header mà phép giao
                sinh ra <strong class="text-on-surface">là</strong> nhóm header thật, nên chúng nhận
                <code>groupHeaderHeight</code> như mọi nhóm khác. Thêm một tuỳ chọn mang tên pivot
                sẽ là hai tên cho cùng một thứ. Trang
                <Link href="/groups">Nhóm cột</Link> cho thấy đúng con số ấy chạy trên nhóm tự khai, không
                có pivot nào trong đó.
            </p>
            <p class="text-on-surface-variant">
                Hai con số này không vào bản chụp trạng thái. Chúng là cách ứng dụng bày lưới, không
                phải thứ người đọc sắp đặt, khác với <code>density</code> vốn có công tắc cho người đọc
                nên mới được lưu.
            </p>
        </div>
    {/snippet}
</Case>
