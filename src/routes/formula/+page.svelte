<script lang="ts">
    import { createDataGrid, editing, filtering, sorting, type ColumnDef } from '$lib/index.js'
    import { Button, Container, Input, Link, ThemeModeButton } from 'sv5ui'
    import { DataGrid, formula, FUNCTION_NAMES, getFormula, grouping, tree } from '$lib/index.js'
    import { downloadGridXlsx } from '$lib/xlsx.js'

    interface Line {
        id: number
        item: string
        region: string
        unit: number
        qty: number
        discount: number
        total?: number
        band?: string
    }

    const items = ['Bơm', 'Van', 'Ống', 'Gioăng', 'Trục']
    const regions = ['Bắc', 'Trung', 'Nam']

    const rows: Line[] = Array.from({ length: 60 }, (_, i) => ({
        id: i + 1,
        item: `${items[i % 5]} ${100 + i}`,
        region: regions[i % 3]!,
        unit: 50 + ((i * 37) % 900),
        qty: 1 + (i % 12),
        discount: (i % 5) / 20
    }))

    const columns: ColumnDef<Line>[] = [
        { id: 'item', header: 'Mặt hàng', width: 150, sortable: true, filter: 'text' },
        { id: 'region', header: 'Vùng', width: 110, sortable: true, type: 'badge' },
        { id: 'unit', header: 'Đơn giá', width: 120, align: 'right', type: 'currency' },
        { id: 'qty', header: 'SL', width: 90, align: 'right', editable: true },
        { id: 'discount', header: 'CK', width: 90, align: 'right', type: 'percent' },
        {
            id: 'total',
            header: 'Thành tiền',
            width: 150,
            align: 'right',
            sortable: true,
            filter: 'number',
            editable: true
        },
        { id: 'band', header: 'Xếp loại', width: 130, sortable: true, filter: 'text' }
    ]

    const TOTAL_DEFAULT = 'unit * qty * (1 - discount)'
    const BAND_DEFAULT = 'IF(total > 5000, "lớn", IF(total > 1500, "vừa", "nhỏ"))'

    let totalSource = $state(TOTAL_DEFAULT)
    let bandSource = $state(BAND_DEFAULT)
    let parseErrors = $state<string[]>([])
    let groupOn = $state(false)

    const grid = createDataGrid<Line>({
        columns,
        data: rows,
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            filtering(),
            editing(),
            formula<Line>({
                columns: { total: TOTAL_DEFAULT, band: BAND_DEFAULT },
                onParseError: (columnId, message, at) => {
                    parseErrors = [...parseErrors, `${columnId} @${at}: ${message}`]
                }
            }),
            grouping<Line>({ aggregations: { total: 'sum', qty: 'sum' } })
        ]
    })

    const formulaState = $derived(getFormula(grid))

    function applyFormulas() {
        parseErrors = []
        grid.api.setFormula?.('total', totalSource)
        grid.api.setFormula?.('band', bandSource)
    }

    function toggleGroup() {
        groupOn = !groupOn
        grid.api.setGroupBy?.(groupOn ? ['band'] : [])
    }

    let writeReport = $state<string | null>(null)

    function tryToOverwrite(columnId: 'total' | 'qty') {
        const node = grid.preWindowNodes[0]
        if (!node) return

        const shown = node.row[columnId]
        grid.api.applyEdits?.([{ rowId: node.id, changes: { [columnId]: 999_999 } }])

        const stored = (
            grid.data.find((row) => String(row.id) === node.id) as
                Record<string, unknown> | undefined
        )?.[columnId]

        writeReport =
            columnId === 'total'
                ? `Ghi 999.999 vào cột công thức "total": lưới vẫn hiện ${shown}, và hàng gốc giữ ${String(stored)} - không có gì lọt xuống dữ liệu.`
                : `Ghi 999.999 vào cột thường "qty": hàng gốc giờ là ${String(stored)}, và Thành tiền tính lại theo nó.`
    }

    interface Task {
        id: number
        name: string
        rate: number
        hours: number
        cost?: number
        children?: Task[]
    }

    const taskColumns: ColumnDef<Task>[] = [
        { id: 'name', header: 'Hạng mục', flex: 1, minWidth: 220 },
        { id: 'rate', header: 'Đơn giá', width: 120, align: 'right', type: 'currency' },
        { id: 'hours', header: 'Giờ', width: 90, align: 'right' },
        { id: 'cost', header: 'Chi phí', width: 150, align: 'right', type: 'currency' }
    ]

    const tasks: Task[] = [
        {
            id: 1,
            name: 'Thiết kế',
            rate: 100,
            hours: 12,
            children: [
                {
                    id: 2,
                    name: 'Phác thảo',
                    rate: 50,
                    hours: 8,
                    children: [{ id: 3, name: 'Sửa vòng 2', rate: 20, hours: 6 }]
                }
            ]
        },
        { id: 4, name: 'Thi công', rate: 80, hours: 40 }
    ]

    const taskGrid = createDataGrid<Task>({
        columns: taskColumns,
        data: tasks,
        getRowId: (row) => String(row.id),
        features: [
            formula<Task>({ columns: { cost: 'rate * hours' } }),
            tree<Task>({ getChildren: (row) => row.children, defaultExpandedDepth: 3 })
        ]
    })

    const deepest = $derived(
        taskGrid.preWindowNodes.find((node) => (node.meta?.level ?? 0) === 2)?.row.cost ?? null
    )

    const samples = [
        ['Thành tiền', 'unit * qty * (1 - discount)'],
        ['Chia cho 0', 'unit / (qty - qty)'],
        ['Vòng lặp', 'band'],
        ['Sai cú pháp', 'unit * * qty'],
        ['Ghép chuỗi', 'item & " - " & region'],
        ['Trông như công thức', '"=1+1" & item']
    ]

    const errorCount = $derived(
        grid.preWindowNodes.filter((node) => String(node.row.total ?? '').startsWith('#')).length
    )
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Cột công thức - bàn thử</h1>
            <p class="text-sm text-on-surface-variant">
                Parser tự viết, <strong>không</strong>
                <code>eval</code>. Công thức là <em>chuỗi</em>, nên nó đi được vào saved view và
                link chia sẻ - callback thì không.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <section class="space-y-3">
        <h2 class="text-lg font-medium text-on-surface">Sửa công thức</h2>
        <div class="grid gap-3 sm:grid-cols-2">
            <label class="space-y-1">
                <span class="text-xs text-on-surface-variant">Cột <code>total</code></span>
                <Input bind:value={totalSource} class="font-mono text-sm" />
            </label>
            <label class="space-y-1">
                <span class="text-xs text-on-surface-variant">Cột <code>band</code></span>
                <Input bind:value={bandSource} class="font-mono text-sm" />
            </label>
        </div>

        <div class="flex flex-wrap items-center gap-2">
            <Button size="sm" variant="solid" label="Áp dụng" onclick={applyFormulas} />
            <Button
                size="sm"
                variant={groupOn ? 'solid' : 'outline'}
                label="Gộp nhóm theo Xếp loại"
                aria-pressed={groupOn}
                onclick={toggleGroup}
            />
            <Button
                size="sm"
                variant="outline"
                icon="lucide:download"
                label="Tải .xlsx"
                onclick={() => void downloadGridXlsx(grid, { filename: 'cong-thuc' })}
            />
            <span class="text-xs text-on-surface-variant">
                {errorCount} ô lỗi | {formulaState?.columnIds.length ?? 0} cột công thức
            </span>
        </div>

        <div class="flex flex-wrap gap-2">
            {#each samples as [label, source] (label)}
                <Button
                    size="xs"
                    variant="ghost"
                    label={String(label)}
                    onclick={() => {
                        totalSource = String(source)
                        applyFormulas()
                    }}
                />
            {/each}
        </div>

        {#if parseErrors.length > 0}
            <ul class="space-y-1 rounded-md bg-error-container p-3 text-xs text-on-error-container">
                {#each parseErrors as message, i (`${i}-${message}`)}
                    <li class="font-mono">{message}</li>
                {/each}
            </ul>
        {/if}
    </section>

    <DataGrid {grid} toolbar />

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Cột công thức không nhận ghi</h2>
        <p class="text-sm text-on-surface-variant">
            Cột <code>total</code> ở đây khai <code>editable: true</code> <em>cố ý</em>. Lưới vẫn từ
            chối mọi phép ghi vào nó, vì giá trị người dùng nhìn thấy là giá trị feature thay vào -
            mở editor lên rồi commit thì sẽ ghi đè cái đang tính. Cột <code>SL</code> ngay bên cạnh thì
            ghi bình thường.
        </p>
        <div class="flex flex-wrap items-center gap-2">
            <Button
                size="sm"
                variant="outline"
                label="Ghi 999.999 vào Thành tiền"
                onclick={() => tryToOverwrite('total')}
            />
            <Button
                size="sm"
                variant="outline"
                label="Ghi 999.999 vào SL"
                onclick={() => tryToOverwrite('qty')}
            />
        </div>
        {#if writeReport}
            <p
                data-demo="write-report"
                class="rounded-md bg-surface-container p-3 text-sm text-on-surface"
            >
                {writeReport}
            </p>
        {/if}
        <p class="text-xs text-on-surface-variant">
            Thử thêm bằng tay: nháy đúp vào một ô <strong>Thành tiền</strong> - không editor nào mở
            ra. Nháy đúp vào <strong>SL</strong> thì có.
        </p>
    </section>

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Công thức chạy trên cây lồng</h2>
        <p class="text-sm text-on-surface-variant">
            Cây này dựng bằng <code>getChildren</code>, nghĩa là hàng con chỉ xuất hiện ở stage 300
            - sau khi stage công thức (50) đã chạy xong. Hàng con vẫn phải có
            <strong>Chi phí</strong>, kể cả hàng ở tầng thứ ba.
        </p>
        <DataGrid grid={taskGrid} />
        <p data-demo="deepest-cost" class="text-xs text-on-surface-variant">
            Hàng sâu nhất (tầng 3) tính ra: <strong>{deepest ?? 'chưa tính được'}</strong> - phải là 120,
            tức 20 x 6.
        </p>
    </section>

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Cần thử những gì</h2>
        <ol
            class="list-inside list-decimal space-y-1 text-sm text-on-surface-variant marker:text-on-surface"
        >
            <li>
                Sắp xếp theo <strong>Thành tiền</strong> - thứ tự phải theo giá trị đã tính, không phải
                theo đơn giá
            </li>
            <li>
                Lọc <strong>Thành tiền</strong> lớn hơn 3000 → chỉ còn dòng thoả, chứng tỏ filter thấy
                giá trị công thức
            </li>
            <li>
                Bấm <strong>Gộp nhóm theo Xếp loại</strong> → gộp theo một cột công thức, và dòng nhóm
                cộng đúng tổng
            </li>
            <li>
                Đổi <code>total</code> thành <code>unit * qty</code> → cột Xếp loại đổi theo, vì nó
                phụ thuộc <code>total</code>
            </li>
            <li>Bấm <strong>Chia cho 0</strong> → mọi ô hiện <code>#DIV/0</code>, lưới vẫn chạy</li>
            <li>Bấm <strong>Vòng lặp</strong> → <code>#CYCLE</code>, <em>không</em> được treo</li>
            <li>Bấm <strong>Sai cú pháp</strong> → hộp lỗi đỏ nói sai ở vị trí nào</li>
            <li>
                Bấm <strong>Trông như công thức</strong> rồi tải .xlsx → mở Excel, ô phải là
                <em>chữ</em> <code>=1+1...</code>, tuyệt đối không được tự tính
            </li>
            <li>
                Gõ <code>constructor</code> hay <code>toString(1)</code> → phải ra
                <code>#NAME</code> hoặc rỗng, không rò gì của JavaScript
            </li>
        </ol>
        <p class="text-xs text-on-surface-variant">
            Hàm có sẵn: <code>{FUNCTION_NAMES.join(', ')}</code>
        </p>
        <p class="text-xs text-on-surface-variant">
            Khác Excel một chỗ có chủ ý: <code>-2^2</code> ở đây là <code>-4</code> (toán học),
            Excel cho <code>4</code>. Muốn cách của Excel thì viết <code>(-2)^2</code>.
        </p>
    </section>
</Container>
