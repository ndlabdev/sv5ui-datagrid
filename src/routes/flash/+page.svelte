<script lang="ts">
    import { Button, Card, Container, Link, ThemeModeButton } from 'sv5ui'
    import {
        conditionalFormatting,
        createDataGrid,
        DataGrid,
        flashCells,
        getFlashCells,
        grouping,
        virtualization,
        type ColumnDef,
        type GridState
    } from '$lib/index.js'

    interface Tick {
        id: number
        symbol: string
        desk: string
        price: number
        size: number
        note: string
    }

    const DESKS = ['Sàn A', 'Sàn B']

    const seed = (): Tick[] =>
        Array.from({ length: 60 }, (_, at) => ({
            id: at + 1,
            symbol: `MÃ${String(at + 1).padStart(2, '0')}`,
            desk: DESKS[at % 2] ?? 'Sàn A',
            price: 100 + ((at * 7) % 40),
            size: 10 + ((at * 3) % 20),
            note: 'chưa đổi'
        }))

    const columns: ColumnDef<Tick>[] = [
        { id: 'symbol', header: 'Mã', width: 110 },
        { id: 'desk', header: 'Sàn' },
        { id: 'price', header: 'Giá', type: 'number' },
        { id: 'size', header: 'Khối lượng', type: 'number' },
        { id: 'note', header: 'Ghi chú', width: 140 }
    ]

    const everything = createDataGrid<Tick>({
        data: seed(),
        columns,
        getRowId: (row) => String(row.id),
        features: [virtualization<Tick>({ rowHeight: 40 }), flashCells<Tick>()]
    })

    const priceOnly = createDataGrid<Tick>({
        data: seed(),
        columns,
        getRowId: (row) => String(row.id),
        features: [
            virtualization<Tick>({ rowHeight: 40 }),
            flashCells<Tick>({ columns: ['price'], duration: 1200 })
        ]
    })

    const noDirection = createDataGrid<Tick>({
        data: seed(),
        columns,
        getRowId: (row) => String(row.id),
        features: [virtualization<Tick>({ rowHeight: 40 }), flashCells<Tick>({ direction: false })]
    })

    const withScale = createDataGrid<Tick>({
        data: seed(),
        columns,
        getRowId: (row) => String(row.id),
        features: [
            virtualization<Tick>({ rowHeight: 40 }),
            flashCells<Tick>(),
            conditionalFormatting<Tick>({ rules: [{ kind: 'colorScale', column: 'price' }] })
        ]
    })

    const grouped = createDataGrid<Tick>({
        data: seed(),
        columns,
        getRowId: (row) => String(row.id),
        features: [
            virtualization<Tick>({ rowHeight: 40 }),
            flashCells<Tick>(),
            grouping<Tick>({ by: ['desk'], aggregations: { price: 'sum', size: 'sum' } })
        ]
    })

    const grids: GridState<Tick>[] = [everything, priceOnly, noDirection, withScale, grouped]

    let ticks = $state(0)

    const jolt = (grid: GridState<Tick>, howMany: number) => {
        const picked: number[] = []
        while (picked.length < howMany) {
            const id = 1 + Math.floor(Math.random() * 60)
            if (!picked.includes(id)) picked.push(id)
        }

        grid.data = grid.data.map((row) => {
            if (!picked.includes(row.id)) return row
            const step = Math.random() < 0.5 ? -1 : 1
            return { ...row, price: row.price + step * (1 + Math.floor(Math.random() * 4)) }
        })
    }

    const oneRound = () => {
        ticks += 1
        for (const grid of grids) jolt(grid, 6)
    }

    const sameAgain = () => {
        ticks += 1
        for (const grid of grids) grid.data = grid.data.map((row) => ({ ...row }))
    }

    const touchNote = () => {
        ticks += 1
        for (const grid of grids) {
            grid.data = grid.data.map((row) =>
                row.id <= 3 ? { ...row, note: `đổi lần ${ticks}` } : row
            )
        }
    }

    const addRow = () => {
        ticks += 1
        for (const grid of grids) {
            const next = grid.data.length + 1
            grid.data = [
                {
                    id: 500 + next,
                    symbol: `MỚI${next}`,
                    desk: 'Sàn A',
                    price: 100,
                    size: 10,
                    note: 'vừa thêm'
                },
                ...grid.data
            ]
        }
    }

    let running = $state(false)

    $effect(() => {
        if (!running) return
        const timer = setInterval(oneRound, 900)
        return () => clearInterval(timer)
    })

    const muted = $derived(getFlashCells(everything)?.muted ?? false)

    const cases = [
        {
            title: 'Mọi cột đang thấy',
            what: 'Không khai cột nào thì mọi cột trên màn hình đều được canh. Giá lên viền xanh, xuống viền đỏ.',
            grid: everything
        },
        {
            title: 'Chỉ cột Giá, và giữ lâu hơn',
            what: 'Khai columns để thu hẹp. Bấm "Đổi ghi chú" thì lưới này im, vì ghi chú không nằm trong danh sách canh.',
            grid: priceOnly
        },
        {
            title: 'Không phân biệt chiều',
            what: 'direction false thì mọi thay đổi cùng một màu. Dùng khi con số không có nghĩa lên xuống.',
            grid: noDirection
        },
        {
            title: 'Cùng ô với thang màu',
            what: 'Thang màu dùng background, dấu đổi dùng outline, nên hai thứ không giành nhau. Cả hai cùng thấy được.',
            grid: withScale
        },
        {
            title: 'Hàng gom cũng đổi theo',
            what: 'Giá trị trên hàng gom là tổng của con, nên con đổi thì tổng đổi và hàng gom cũng được canh.',
            grid: grouped
        }
    ]
</script>

<Container class="space-y-6 py-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Ô vừa đổi giá trị thì nói ra</h1>
            <p class="text-sm text-on-surface-variant">
                Một lưới nhận dữ liệu từ socket hay từ poll thì con số nhảy mà không ai kịp thấy cái
                nào vừa nhảy. Năm lưới dưới đây cùng nhận một đợt thay đổi.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm" label="Trang chủ" href="/" />
            <ThemeModeButton />
        </div>
    </div>

    <Card class="space-y-3 p-4">
        <div class="flex flex-wrap items-center gap-2">
            <Button
                variant={running ? 'solid' : 'outline'}
                size="sm"
                label={running ? 'Đang chạy, bấm để dừng' : 'Chạy liên tục'}
                onclick={() => (running = !running)}
            />
            <Button variant="outline" size="sm" label="Một đợt, 6 ô" onclick={oneRound} />
            <Button variant="outline" size="sm" label="Đổi ghi chú" onclick={touchNote} />
            <Button
                variant="outline"
                size="sm"
                label="Thay dữ liệu, cùng giá trị"
                onclick={sameAgain}
            />
            <Button variant="outline" size="sm" label="Thêm một hàng mới" onclick={addRow} />
            <span class="text-sm text-on-surface-variant">đã {ticks} đợt</span>
        </div>
        <p class="text-sm text-on-surface-variant">
            Hai nút đáng thử nhất là hai nút không làm gì cả. <strong class="text-on-surface"
                >Thay dữ liệu, cùng giá trị</strong
            >
            cấp một mảng mới nhưng mọi con số y nguyên, nên không ô nào được canh.
            <strong class="text-on-surface">Thêm một hàng mới</strong> thì hàng mới vào im lặng, vì
            nó không phải hàng vừa đổi. Nhưng để ý lưới cuối: tổng của nhóm và số đếm trong nhãn
            nhóm <strong class="text-on-surface">đổi thật</strong>, nên chúng được canh. Đó đúng là
            thứ nên canh.
        </p>
        {#if muted}
            <p class="text-sm text-on-surface">
                Máy bạn đang đặt giảm hiệu ứng chuyển động, nên tính năng này tự tắt. Đó là có chủ
                ý.
            </p>
        {/if}
    </Card>

    {#each cases as one, at (one.title)}
        <Card class="space-y-2 p-4">
            <h2 class="font-medium text-on-surface">{at + 1}. {one.title}</h2>
            <p class="text-sm text-on-surface-variant">{one.what}</p>
            <DataGrid grid={one.grid} class="h-[280px]" />
        </Card>
    {/each}

    <Card class="space-y-2 p-4 text-sm">
        <h2 class="font-medium text-on-surface">Cốt lõi của vấn đề</h2>
        <p class="text-on-surface-variant">
            Một ô là cặp (id hàng, id cột) và một giá trị. Muốn biết nó
            <strong class="text-on-surface">đổi</strong> thì phải có giá trị cũ. Nhưng
            <code>data</code> của lưới là một tham chiếu: thay cả mảng thì biết có gì đổi, không biết
            cái gì đổi. Giữ giá trị cũ của mọi ô là tốn bộ nhớ bằng số hàng nhân số cột, điều một lưới
            chịu được triệu dòng không thể trả.
        </p>
        <p class="text-on-surface-variant">
            Chỗ mở nút là nhận ra rằng một dấu đổi
            <strong class="text-on-surface">chỉ có nghĩa với người đang nhìn ô đó</strong>. Nên chỉ
            cần nhớ các ô đang hiện trên màn hình. Bộ nhớ vì thế bằng cỡ khung nhìn, không bằng cỡ
            dữ liệu.
        </p>
        <p class="text-on-surface-variant">
            Và điều ấy sinh ra đúng một luật, gỡ được mọi ca khó cùng lúc:
            <strong class="text-on-surface">không có giá trị cũ thì không canh</strong>. Luật ấy lo
            hết lần vẽ đầu, hàng mới cuộn vào, hàng cuộn ra rồi cuộn lại, và hàng vừa được thêm. Ở
            mỗi ca ấy tính năng không có bằng chứng nào về một thay đổi, mà canh khi không có bằng
            chứng thì sẽ chỉ vào những ô không ai chạm.
        </p>
        <p class="text-on-surface-variant">
            Vài chi tiết đi theo. So bằng <code>Object.is</code>, nên 0 và -0 là khác nhau và NaN
            bằng chính nó. Chiều chỉ đọc được khi cả hai phía là số, nên số đầu tiên xuất hiện ở chỗ
            trước đó trống thì chỉ là "đã đổi". Một đợt thay đổi dùng
            <strong class="text-on-surface">một</strong> hẹn giờ, nên nghìn ô đổi cùng lúc cũng chỉ một.
            Và dấu đổi dùng outline chứ không dùng background, để thang màu hay thanh dữ liệu dưới nó
            vẫn còn thấy.
        </p>
        <p class="text-on-surface-variant">
            Một giới hạn phải nói thẳng: phải <strong class="text-on-surface">cấp mảng mới</strong>
            cho <code>data</code>. Sửa tại chỗ từng dòng thì pipeline vẫn giữ nguyên các node và
            không gì ở đây nhận ra được.
        </p>
        <p class="text-on-surface-variant">
            Ai đặt giảm hiệu ứng chuyển động thì không canh gì cả, nhưng vẫn
            <strong class="text-on-surface">tiếp tục ghi nhớ</strong>. Nhờ vậy bật lại không làm
            nháy một loạt thay đổi cũ dồn lại. Xem thêm
            <Link href="/sticky">hàng nhóm dính</Link> nếu bạn đang đọc dữ liệu dài.
        </p>
    </Card>
</Container>
