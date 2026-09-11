<script lang="ts">
    import {
        Grid,
        createDataGrid,
        editing,
        filtering,
        pagination,
        sorting,
        type ColumnDef
    } from '$lib/index.js'
    import { Button, Container, Kbd, Link, ThemeModeButton } from 'sv5ui'
    import { DataGrid, findReplace, getFindReplace, grouping } from '$lib/index.js'

    interface Row {
        id: number
        dept: string
        name: string
        city: string
        note: string

        ref: string
    }

    const CITIES = ['Hà Nội', 'Hà Nam', 'Đà Nẵng', 'Huế']
    const NOTES = ['ship 2026', 'hold 2026', 'ship 2025', 'review 2026']

    function seed(): Row[] {
        return Array.from({ length: 24 }, (_, i) => ({
            id: i + 1,
            dept: i % 2 === 0 ? 'Core' : 'Data',

            name: ['Anna', 'anna', 'ANNA', 'Bình', 'Chi', 'Dũng'][i % 6]!,
            city: CITIES[i % 4]!,
            note: NOTES[i % 4]!,
            ref: `REF-2026-${String(i + 1).padStart(3, '0')}`
        }))
    }

    const columns: ColumnDef<Row>[] = [
        { id: 'dept', header: 'Dept', width: 100 },
        { id: 'name', header: 'Name', width: 130, editable: true, filter: 'text' },
        { id: 'city', header: 'City', width: 140, editable: true, filter: 'text' },
        { id: 'note', header: 'Note', width: 160, editable: true },
        { id: 'ref', header: 'Ref (read-only)', width: 190 }
    ]

    let grouped = $state(false)
    let paged = $state(false)
    let generation = $state(0)

    const grid = $derived.by(() => {
        void generation
        return createDataGrid<Row>({
            columns,
            data: seed(),
            getRowId: (row) => String(row.id),
            features: [
                sorting(),
                filtering(),
                editing(),
                ...(grouped ? [grouping<Row>({ by: ['dept'] })] : []),
                ...(paged ? [pagination<Row>({ pageSize: 8 })] : []),
                findReplace()
            ]
        })
    })

    const find = $derived(getFindReplace(grid)!)

    const readout = $derived({
        open: find.open,
        query: find.query || '-',
        total: find.total,
        current: find.current,
        active: find.active
            ? `${find.active.rowId}.${find.active.columnId} @ ${find.active.row},${find.active.col}`
            : '-'
    })

    const dump = $derived(
        grid.data
            .map(
                (row) =>
                    `${String(row.id).padStart(2)}  ${row.dept.padEnd(5)} ${row.name.padEnd(6)} ${row.city.padEnd(8)} ${row.note.padEnd(13)} ${row.ref}`
            )
            .join('\n')
    )
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Find &amp; replace - bàn thử</h1>
            <p class="text-sm text-on-surface-variant">
                <Kbd size="sm">Ctrl</Kbd>+<Kbd size="sm">F</Kbd> mở ô tìm |
                <Kbd size="sm">Enter</Kbd> / <Kbd size="sm">Shift</Kbd>+<Kbd size="sm">Enter</Kbd>
                đi tới / lùi | <Kbd size="sm">Esc</Kbd> đóng.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
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
                variant="outline"
                icon="lucide:search"
                label="Mở tìm kiếm"
                onclick={find.show}
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
                variant={paged ? 'solid' : 'outline'}
                label="Phân trang (8/trang)"
                aria-pressed={paged}
                onclick={() => (paged = !paged)}
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
        <Grid.FindReplace {grid} />

        {#if grouped}
            <Grid.GroupPanel {grid} />
        {/if}

        <DataGrid {grid} toolbar />
    {/key}

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Trạng thái</h2>
        <dl
            class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-lg border border-outline-variant bg-surface-container p-3 text-xs"
        >
            <dt class="text-on-surface-variant">Panel</dt>
            <dd class="font-mono text-on-surface">{readout.open ? 'mở' : 'đóng'}</dd>
            <dt class="text-on-surface-variant">Query</dt>
            <dd class="font-mono text-on-surface">{readout.query}</dd>
            <dt class="text-on-surface-variant">Số kết quả</dt>
            <dd class="font-mono text-on-surface">
                {readout.total} | sửa được: {find.writableTotal}
            </dd>
            <dt class="text-on-surface-variant">Đang đứng ở</dt>
            <dd class="font-mono text-on-surface">
                {readout.current} | {readout.active}
            </dd>
        </dl>
    </section>

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Dữ liệu thật</h2>
        <p class="text-xs text-on-surface-variant">
            Đọc thẳng từ <code>grid.data</code> theo thứ tự nguồn - nên một phép thay ghi nhầm hàng sẽ
            lộ ra ở đây kể cả khi lưới đang lọc, sắp xếp hay nhóm.
        </p>
        <pre
            class="max-h-72 overflow-auto rounded-lg border border-outline-variant bg-surface-container p-3 font-mono text-xs text-on-surface-variant">{dump}</pre>
    </section>

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Cần thử những gì</h2>
        <ol
            class="list-inside list-decimal space-y-1 text-sm text-on-surface-variant marker:text-on-surface"
        >
            <li>
                Tìm <code>anna</code> → mặc định ra cả <code>Anna</code>, <code>ANNA</code>; bật
                <strong>Phân biệt hoa/thường</strong> thì số kết quả phải giảm
            </li>
            <li>
                Tìm <code>Hà</code> → khớp cả <code>Hà Nội</code> lẫn <code>Hà Nam</code>; bật
                <strong>Khớp cả ô</strong> thì về 0
            </li>
            <li>
                <strong>Enter</strong> liên tục tới cuối rồi phải <strong>quay vòng</strong> về đầu;
                <strong>Shift+Enter</strong>
                lần đầu phải nhảy tới kết quả
                <em>cuối</em>, không phải đầu
            </li>
            <li>Ô đang đứng phải tô khác các ô khớp còn lại, không chỉ đậm hơn</li>
            <li>
                Tìm <code>2026</code> → khớp cả cột <strong>Note</strong> lẫn
                <strong>Ref</strong>. Thay thành <code>2027</code>: Note đổi, Ref
                <strong>không đổi</strong> vì read-only. Ô đếm phải báo
                <em>đã thay bao nhiêu</em>
            </li>
            <li>
                Tìm <code>Core</code> (chỉ có ở cột <strong>Dept</strong>, read-only) → hai nút Thay
                phải <strong>mờ đi</strong> và ô đếm nói
                <em>không ô nào sửa được</em>, chứ không phải bấm mà im lặng
            </li>
            <li>Sau <strong>Thay hết</strong>, một lần <strong>Undo</strong> phải trả lại hết</li>
            <li>Lọc cột City còn <code>Huế</code> rồi tìm <code>Hà</code> → phải ra 0 kết quả</li>
            <li>Sắp xếp theo City rồi Enter → thứ tự đi phải theo đúng thứ tự trên màn hình</li>
            <li>
                Bật <strong>Nhóm theo Dept</strong> rồi tìm <code>Core</code> → không được khớp hàng
                nhóm (hàng nhóm hiện <code>Core (12)</code> nhưng không ghi được)
            </li>
            <li>
                Bật <strong>Phân trang</strong>, tìm thứ nằm ở trang 3 rồi Enter → phải
                <strong>tự nhảy trang</strong>
            </li>
            <li>Tìm <code>(</code> hoặc <code>.</code> → phải coi là chữ, không phải regex</li>
            <li>
                Lưới <code>rowModel: 'server'</code> (xem route <code>/server</code>): find chỉ thấy
                phần <strong>đã tải</strong>, ô đếm ghi rõ <em>đã tải</em>, và Replace bị tắt - vì
                lần fetch sau sẽ ghi đè mất
            </li>
            <li>Đóng panel → mọi highlight biến mất, không còn ô nào tô</li>
        </ol>
    </section>
</Container>
