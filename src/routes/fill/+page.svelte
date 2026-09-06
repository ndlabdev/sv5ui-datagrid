<script lang="ts">
    import { Grid, createDataGrid, editing, sorting, type ColumnDef } from '$lib/index.js'
    import { Button, Container, Kbd, Link, ThemeModeButton } from 'sv5ui'
    import { DataGrid, getRangeSelection, grouping, rangeSelection } from '$lib/index.js'

    interface Row {
        id: number
        dept: string

        stt: number

        ngay: string

        thang: string

        ma: string

        khu: string

        chot: string
    }

    const DEPTS = ['Core', 'Data']
    const KHU = ['Bắc', 'Trung', 'Nam']

    function seed(): Row[] {
        return Array.from({ length: 14 }, (_, i) => ({
            id: i + 1,
            dept: DEPTS[Math.floor(i / 7)]!,
            stt: i + 1,
            ngay: `2026-03-${String(i + 1).padStart(2, '0')}`,
            thang: `2026-${String(i + 1).padStart(2, '0')}-01`,
            ma: `SP-${String(i + 1).padStart(3, '0')}`,
            khu: KHU[i % 3]!,
            chot: `khoá-${i + 1}`
        }))
    }

    const isoDate = (value: unknown): string | null =>
        typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
            ? null
            : 'Phải là ngày dạng YYYY-MM-DD'

    const columns: ColumnDef<Row>[] = [
        { id: 'dept', header: 'Dept', width: 100 },
        {
            id: 'stt',
            header: 'STT',
            width: 90,
            align: 'right',
            editable: true,
            parse: Number,
            validate: (value) =>
                typeof value === 'number' && Number.isInteger(value) && value > 0
                    ? null
                    : 'Phải là số nguyên dương'
        },
        { id: 'ngay', header: 'Ngày', width: 130, editable: true, validate: isoDate },
        { id: 'thang', header: 'Tháng', width: 130, editable: true, validate: isoDate },
        {
            id: 'ma',
            header: 'Mã',
            width: 120,
            editable: true,
            validate: (value) =>
                typeof value === 'string' && /^SP-\d{3}$/.test(value) ? null : 'Phải dạng SP-000'
        },
        {
            id: 'khu',
            header: 'Khu vực',
            width: 120,
            editable: true,
            validate: (value) =>
                KHU.includes(value as string) ? null : `Phải là ${KHU.join(' / ')}`
        },
        { id: 'chot', header: 'Chốt (read-only)', width: 160 }
    ]

    let grouped = $state(false)
    let fillEnabled = $state(true)
    let generation = $state(0)

    const grid = $derived.by(() => {
        void generation
        return createDataGrid<Row>({
            columns,
            data: seed(),
            getRowId: (row) => String(row.id),
            features: [
                sorting(),
                editing(),
                ...(grouped ? [grouping<Row>({ by: ['dept'] })] : []),
                rangeSelection({ fill: fillEnabled })
            ]
        })
    })

    const range = $derived(getRangeSelection(grid)!)

    const readout = $derived.by(() => {
        const primary = range.primary
        const target = range.fillTarget
        return {
            selected: primary
                ? `${primary.top},${primary.left} → ${primary.bottom},${primary.right}`
                : '-',
            cells: range.cellCount,
            preview: target
                ? `${target.axis}: ${target.range.top},${target.range.left} → ${target.range.bottom},${target.range.right}`
                : '-'
        }
    })

    const dump = $derived(
        grid.data
            .map(
                (row) =>
                    `${String(row.id).padStart(2)}  ${row.dept.padEnd(5)} ${String(row.stt).padStart(3)}  ${row.ngay}  ${row.thang}  ${row.ma}  ${row.khu.padEnd(6)} ${row.chot}`
            )
            .join('\n')
    )
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Fill handle - bàn thử</h1>
            <p class="text-sm text-on-surface-variant">
                Mỗi cột là một kiểu suy luận khác nhau. Chọn vài ô rồi kéo ô vuông ở góc dưới-phải,
                hoặc dùng <Kbd size="sm">Ctrl</Kbd>+<Kbd size="sm">D</Kbd> /
                <Kbd size="sm">Ctrl</Kbd>+<Kbd size="sm">R</Kbd>.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/range">← Range selection</Link>
            <ThemeModeButton />
        </div>
    </div>

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Điều khiển</h2>
        <div class="flex flex-wrap items-center gap-2">
            <Button
                size="sm"
                variant="outline"
                icon="lucide:rotate-ccw"
                label="Reset dữ liệu"
                onclick={() => generation++}
            />
            <Button
                size="sm"
                variant={grouped ? 'solid' : 'outline'}
                label="Nhóm theo Dept"
                aria-pressed={grouped}
                onclick={() => (grouped = !grouped)}
            />
            <Button
                size="sm"
                variant={fillEnabled ? 'solid' : 'outline'}
                label="fill: {fillEnabled}"
                aria-pressed={fillEnabled}
                onclick={() => (fillEnabled = !fillEnabled)}
            />
            <Button
                size="sm"
                variant="outline"
                icon="lucide:arrow-down-to-line"
                label="Ctrl+D"
                onclick={() => void range.fillWithin('down')}
            />
            <Button
                size="sm"
                variant="outline"
                icon="lucide:arrow-right-to-line"
                label="Ctrl+R"
                onclick={() => void range.fillWithin('right')}
            />
            <Button
                size="sm"
                variant="ghost"
                icon="lucide:undo-2"
                label="Undo"
                onclick={() => (grid.api.undo as (() => void) | undefined)?.()}
            />
        </div>
    </section>

    {#key grid}
        {#if grouped}
            <Grid.GroupPanel {grid} />
        {/if}

        <DataGrid {grid} toolbar />

        <Grid.RangeStatusBar {grid} />
    {/key}

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Trạng thái</h2>
        <dl
            class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-outline-variant bg-surface-container p-3 text-xs"
        >
            <dt class="text-on-surface-variant">Vùng chọn</dt>
            <dd class="font-mono text-on-surface">{readout.selected} ({readout.cells} ô)</dd>
            <dt class="text-on-surface-variant">Preview khi kéo</dt>
            <dd class="font-mono text-on-surface">{readout.preview}</dd>
        </dl>
    </section>

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Dữ liệu thật</h2>
        <p class="text-xs text-on-surface-variant">
            Đọc thẳng từ <code>grid.data</code> theo thứ tự nguồn, không qua pipeline - nên một phép fill
            ghi nhầm hàng sẽ lộ ra ở đây kể cả khi lưới đang sắp xếp hay đang nhóm.
        </p>
        <pre
            class="max-h-72 overflow-auto rounded-lg border border-outline-variant bg-surface-container p-3 font-mono text-xs text-on-surface-variant">{dump}</pre>
    </section>

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Cần thử những gì</h2>
        <ol
            class="list-inside list-decimal space-y-1 text-sm text-on-surface-variant marker:text-on-surface"
        >
            <li><strong>STT</strong>: chọn 2 ô đầu, kéo xuống → phải ra 3, 4, 5...</li>
            <li>
                <strong>STT</strong>: chọn <em>một</em> ô, kéo xuống → phải <em>lặp</em>, không đếm
                lên
            </li>
            <li><strong>Ngày</strong>: chọn 2 ô, kéo → bước 1 ngày</li>
            <li>
                <strong>Tháng</strong>: chọn 2 ô, kéo → phải sang tháng kế, ngày giữ nguyên 01 (đọc
                theo số ngày sẽ trôi thành 02, 03...)
            </li>
            <li>
                <strong>Mã</strong>: <code>SP-001, SP-002</code> → <code>SP-003</code>, giữ 3 chữ số
            </li>
            <li><strong>Khu vực</strong>: không có quy luật → lặp lại khối</li>
            <li><strong>Chốt</strong>: cột read-only → fill phải bỏ qua, giá trị không đổi</li>
            <li>Kéo <strong>lên / sang trái</strong> → dãy chạy ngược đúng chiều kéo</li>
            <li>Chọn nhiều cột rồi kéo → mỗi cột một dãy riêng, không trộn</li>
            <li>Sau mỗi lần fill, <strong>Undo</strong> một lần phải trả lại nguyên trạng</li>
            <li>Tắt <code>fill</code> → không còn ô vuông ở góc, Ctrl+D/R không làm gì</li>
            <li>
                Bật <strong>Nhóm theo Dept</strong> rồi kéo qua ranh giới nhóm → dãy chạy liên tục trên
                các hàng dữ liệu; hàng nhóm không nhận giá trị và cũng không nuốt mất một bước
            </li>
            <li>
                Kéo trên cột <strong>Chốt</strong> → không có ô vuông ở góc và không có preview, vì không
                ô nào trong vùng ghi được
            </li>
            <li>
                Copy <strong>một cột</strong> rồi dán vào vùng <strong>hai cột</strong> → khối lặp
                ngang, đúng như Excel. Nhưng giá trị sai kiểu bị <strong>validate chặn</strong> chứ không
                ghi im lặng: mọi cột sửa được ở đây đều có ràng buộc, nên thứ gì lọt vào là thứ đã được
                cho phép
            </li>
        </ol>
    </section>
</Container>
