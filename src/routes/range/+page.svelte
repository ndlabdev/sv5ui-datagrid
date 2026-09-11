<script lang="ts">
    import {
        Grid,
        columnOps,
        createDataGrid,
        editing,
        filtering,
        sorting,
        type ColumnDef
    } from '$lib/index.js'
    import { Button, Container, Input, Kbd, Link, ThemeModeButton } from 'sv5ui'
    import { DataGrid, getRangeSelection, rangeSelection } from '$lib/index.js'

    interface Quarter {
        id: number
        region: string
        q1: number
        q2: number
        q3: number
        q4: number
    }

    const regions = [
        'North',
        'South',
        'East',
        'West',
        'Central',
        'Nordics',
        'Iberia',
        'Benelux',
        'DACH',
        'APAC',
        'LATAM',
        'MENA'
    ]

    const quarters: Quarter[] = regions.map((region, i) => ({
        id: i + 1,
        region,
        q1: 1000 + i * 130,
        q2: 1200 + i * 90,
        q3: 900 + i * 175,
        q4: 1500 + i * 60
    }))

    const numberColumn = (id: 'q1' | 'q2' | 'q3' | 'q4', header: string): ColumnDef<Quarter> => ({
        id,
        header,
        sortable: true,
        align: 'right',
        width: 140,
        editable: true,
        editor: 'number',
        parse: (input) => (input === null || input === '' ? null : Number(input))
    })

    const columns: ColumnDef<Quarter>[] = [
        { id: 'region', header: 'Region', sortable: true, flex: 1, minWidth: 160 },
        numberColumn('q1', 'Q1'),
        numberColumn('q2', 'Q2'),
        numberColumn('q3', 'Q3'),
        numberColumn('q4', 'Q4')
    ]

    const grid = createDataGrid<Quarter>({
        data: quarters,
        columns,
        getRowId: (row) => String(row.id),
        features: [filtering(), sorting(), columnOps(), editing(), rangeSelection()]
    })
    const range = getRangeSelection(grid)!

    let copied = $state('')
    let bulkValue = $state('0')

    function applyToSelection() {
        void range.applyToRange(bulkValue)
    }

    async function copy() {
        copied = range.getRangeTsv()
        await range.copyRange()
    }

    async function paste() {
        await range.pasteFromClipboard()
    }

    async function cut() {
        await range.cutRange()
    }

    function dropAtTop() {
        const to = range.primary
        if (to) void range.moveRange(to.top, to.left)
    }
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">
                Cell range selection - @sv5ui/datagrid
            </h1>
            <p class="text-sm text-on-surface-variant">
                Kéo chuột để chọn vùng | <Kbd size="sm">Shift</Kbd> + phím mũi tên để mở rộng |
                <Kbd size="sm">Ctrl</Kbd> + kéo để thêm vùng thứ hai | gõ trong vùng rồi
                <Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">Enter</Kbd> để ghi cả vùng | copy/paste TSV
                round-trip với Excel.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Grouping</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
        <Button
            variant="outline"
            size="sm"
            icon="lucide:copy"
            label="Copy range"
            disabled={range.ranges.length === 0}
            onclick={copy}
        />
        <Button
            variant="outline"
            size="sm"
            icon="lucide:clipboard-paste"
            label="Paste into range"
            disabled={range.ranges.length === 0}
            onclick={paste}
        />
        <Button
            variant="outline"
            size="sm"
            icon="lucide:scissors"
            label="Cut range"
            disabled={range.ranges.length === 0}
            onclick={cut}
        />
        <Button
            variant="outline"
            size="sm"
            label="Drop here"
            disabled={range.cutSource === null}
            onclick={dropAtTop}
        />
        <Button
            variant="outline"
            size="sm"
            icon="lucide:arrow-down-to-line"
            label="Fill down"
            disabled={(range.primary?.bottom ?? 0) === (range.primary?.top ?? 0)}
            onclick={() => void range.fillWithin('down')}
        />
        <Button
            variant="outline"
            size="sm"
            icon="lucide:arrow-right-to-line"
            label="Fill right"
            disabled={(range.primary?.right ?? 0) === (range.primary?.left ?? 0)}
            onclick={() => void range.fillWithin('right')}
        />
        <Input
            bind:value={bulkValue}
            class="w-28"
            aria-label="Giá trị ghi vào cả vùng"
            disabled={range.ranges.length === 0}
        />
        <Button
            variant="outline"
            size="sm"
            label="Apply to selection"
            disabled={range.ranges.length === 0}
            onclick={applyToSelection}
        />
        <Button variant="ghost" size="sm" label="Select all cells" onclick={range.selectAll} />
        <Button
            variant="ghost"
            size="sm"
            label="Clear"
            disabled={range.ranges.length === 0}
            onclick={range.clear}
        />
    </div>

    <DataGrid {grid} toolbar />

    <Grid.RangeStatusBar {grid} />

    {#if copied}
        <pre
            class="max-h-40 overflow-auto rounded-lg border border-outline-variant bg-surface-container p-3 text-xs text-on-surface-variant">{copied}</pre>
    {/if}

    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
        <span><Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">C</Kbd> copy</span>
        <span
            ><Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">V</Kbd> paste (chạy validation từng ô)</span
        >
        <span
            ><Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">Enter</Kbd> ghi giá trị đang gõ vào cả vùng</span
        >
        <span
            ><Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">X</Kbd> cắt, rồi
            <Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">V</Kbd> ở chỗ mới để dời</span
        >
        <span><Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">D</Kbd> điền xuống</span>
        <span><Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">R</Kbd> điền sang phải</span>
        <span><Kbd size="sm">Esc</Kbd> bỏ chọn</span>
        <span><Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">Z</Kbd> hoàn tác cả lô paste</span>
    </div>

    <p class="text-xs text-on-surface-variant">
        <strong>Sửa cả vùng:</strong> chọn một khối rồi <em>gõ thẳng</em>, hoặc nhấn
        <Kbd size="sm">F2</Kbd> để mở ô đang focus mà giữ nguyên giá trị cũ; xong thì
        <Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">Enter</Kbd> - giá trị vào mọi ô ghi được của vùng,
        đi qua đúng <code>parse</code> và validation của từng cột, và hoàn tác một lần là về hết.
        <strong>Đừng bấm chuột vào ô</strong> để mở editor: một cú bấm là một vùng chọn mới một ô,
        đúng như Excel, và lúc đó không còn vùng nào để ghi. Vùng một ô thì phím này vẫn là "commit
        không di chuyển" của Community. Nút <em>Apply to selection</em> gọi cùng đường đó qua
        <code>grid.api.applyToRange(value)</code>, cho trường hợp đã có sẵn giá trị và không cần mở
        editor.
    </p>

    <p class="text-xs text-on-surface-variant">
        <strong>Dời dữ liệu:</strong>
        <Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">X</Kbd> đánh dấu vùng bằng viền đứt, rồi chọn ô đích
        và <Kbd size="sm">Ctrl</Kbd> + <Kbd size="sm">V</Kbd> - giá trị sang chỗ mới, chỗ cũ bị xoá, tất
        cả trong một bước hoàn tác. Hoặc
        <strong>kéo thẳng viền vùng chọn</strong> sang chỗ khác: khung xem trước chạy theo con trỏ và
        luôn nằm gọn trong lưới. Ô nguồn nào không có chỗ đáp (rơi ra ngoài lưới, hay trúng hàng không
        phải dữ liệu) thì giữ nguyên giá trị chứ không bị xoá oan.
    </p>

    <p class="text-xs text-on-surface-variant">
        Ô trống được ghi bằng <code>null</code>, và nó vẫn đi qua <code>parse</code> của cột như mọi
        lần ghi khác. Cột <code>parse: Number</code> sẽ biến ô trống thành <code>0</code> vì
        <code>Number(null)</code> là <code>0</code> - bốn cột ở đây dùng
        <code>(input) =&gt; (input === null || input === "" ? null : Number(input))</code> để ô trống
        vẫn là trống.
    </p>

    <p class="text-xs text-on-surface-variant">
        <strong>Copy giờ ghi hai định dạng:</strong> <code>text/plain</code> là TSV để dán ngược vào
        lưới hoặc vào Excel, <code>text/html</code> là một bảng thật để dán sang Word hay Google
        Docs mà không mất hàng cột. Ô nào bắt đầu bằng <code>=</code>, <code>+</code>,
        <code>@</code> hay dấu trừ không đứng trước số thì được ép về dạng text trong bản HTML, để bảng
        tính bên kia không diễn giải nó thành công thức.
    </p>

    <p class="text-xs text-on-surface-variant">
        Ô vuông nhỏ ở góc dưới-phải vùng chọn là <strong>fill handle</strong>: kéo nó để nối tiếp
        dãy. Chọn hai ô <code>1, 2</code> rồi kéo xuống ra <code>3, 4, 5</code>; chọn
        <code>Item 1, Item 2</code> ra <code>Item 3</code>; ngày theo bước ngày hoặc bước tháng. Thứ
        không nhận ra được thì lặp lại khối - như Excel, và như một cái sai nhìn thấy ngay thay vì
        một phép ngoại suy sai không ai để ý.
    </p>
</Container>
