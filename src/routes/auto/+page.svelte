<script lang="ts">
    import {
        columnOps,
        createDataGrid,
        editing,
        filtering,
        sorting,
        type GridState
    } from '$lib/index.js'
    import { Button, Container, Link, Textarea, ThemeModeButton, useClipboard } from 'sv5ui'
    import { autoColumns, DataGrid, rangeSelection } from '$lib/index.js'

    type Row = Record<string, unknown>

    const orders: Row[] = [
        {
            id: 1,
            customer: 'Alice Nguyen',
            region: 'North',
            total: 1250.5,
            paid: true,
            placedAt: '2026-01-05'
        },
        {
            id: 2,
            customer: 'Bao Tran',
            region: 'South',
            total: 340,
            paid: false,
            placedAt: '2026-02-11'
        },
        {
            id: 3,
            customer: 'Chi Le',
            region: 'North',
            total: 90.25,
            paid: true,
            placedAt: '2026-03-02'
        },
        {
            id: 4,
            customer: 'Dung Pham',
            region: 'East',
            total: 7000,
            paid: false,
            placedAt: '2026-04-19'
        },
        {
            id: 5,
            customer: 'Eva Vo',
            region: 'South',
            total: 512,
            paid: true,
            placedAt: '2026-05-30'
        },
        {
            id: 6,
            customer: 'Giang Ho',
            region: 'East',
            total: 88,
            paid: false,
            placedAt: '2026-06-08'
        }
    ]

    const events: Row[] = [
        {
            at: '2026-08-27T09:14:02Z',
            level: 'info',
            service: 'api',
            ms: 42,
            message: 'GET /orders'
        },
        {
            at: '2026-08-27T09:14:07Z',
            level: 'warn',
            service: 'api',
            ms: 830,
            message: 'slow query'
        },
        {
            at: '2026-08-27T09:15:11Z',
            level: 'error',
            service: 'worker',
            ms: 12,
            message: 'retry 1/3'
        },
        {
            at: '2026-08-27T09:16:44Z',
            level: 'info',
            service: 'worker',
            ms: 61,
            message: 'job done'
        },
        {
            at: '2026-08-27T09:17:03Z',
            level: 'info',
            service: 'api',
            ms: 38,
            message: 'GET /health'
        }
    ]

    const payroll: Row[] = [
        {
            code: '01000',
            name: 'Nguyen An',
            phone: '0912345678',
            gross: 24000000,
            startedOn: '2024-03-01'
        },
        {
            code: '01001',
            name: 'Tran Binh',
            phone: '0987654321',
            gross: 18500000,
            startedOn: '2025-07-15'
        },
        {
            code: '01002',
            name: 'Le Chi',
            phone: '0901122334',
            gross: 31000000,
            startedOn: '2023-11-02'
        }
    ]

    const messy: Row[] = [
        { sku: 'A-1', price: 10.5, tags: ['sale'], __dgSynthetic: true },
        { sku: 'B-2', price: 20, inStock: true, meta: { warehouse: 'HN' } },
        { sku: 'C-3', price: 30, inStock: false, updatedAt: '2026-01-02T03:04:05Z' }
    ]

    const presets: { label: string; hint: string; rows: Row[] }[] = [
        { label: 'Đơn hàng', hint: 'số, ngày, boolean, và một cột lặp lại', rows: orders },
        { label: 'Log sự kiện', hint: 'ISO có giờ thành datetime', rows: events },
        {
            label: 'Bảng lương',
            hint: 'mã 01000 và số điện thoại phải giữ nguyên là text',
            rows: payroll
        },
        { label: 'Dữ liệu lộn xộn', hint: 'thiếu khoá, object lồng, khoá nội bộ', rows: messy }
    ]

    let source = $state(JSON.stringify(orders, null, 2))
    let rows = $state<Row[]>(orders)
    let picked = $state<string | null>(presets[0]!.label)
    let error = $state('')

    const clipboard = useClipboard()

    const columns = $derived(autoColumns<Row>(rows))

    const grid = $derived.by((): GridState<Row> | null => {
        if (columns.length === 0) return null
        return createDataGrid<Row>({
            columns,
            data: rows,
            getRowId: (row: Row) => String(row.id ?? rows.indexOf(row)),
            features: [sorting(), filtering(), columnOps(), editing(), rangeSelection()]
        })
    })

    const code = $derived(
        `const columns = ${JSON.stringify(columns, null, 4)}\n\nconst grid = createDataGrid({ columns, data, getRowId: (row) => row.id })`
    )

    function pick(preset: { label: string; rows: Row[] }) {
        rows = preset.rows
        source = JSON.stringify(preset.rows, null, 2)
        picked = preset.label
        error = ''
    }

    function build() {
        try {
            const parsed: unknown = JSON.parse(source)
            if (!Array.isArray(parsed)) throw new TypeError('JSON phải là một mảng các object')
            rows = parsed as Row[]
            picked = null
            error = ''
        } catch (cause) {
            error = cause instanceof Error ? cause.message : String(cause)
        }
    }
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">
                Sinh cột từ dữ liệu - @sv5ui/datagrid
            </h1>
            <p class="text-sm text-on-surface-variant">
                Anh có một mảng JSON và chưa có dòng <code>ColumnDef</code> nào.
                <code>autoColumns(rows)</code> đọc thử vài dòng, đoán kiểu từng cột và trả về danh sách
                cột - việc anh vẫn phải ngồi gõ tay mỗi lần dựng lưới cho một cấu trúc dữ liệu mới.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/">← Grouping</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium text-on-surface">Thử với:</span>
        {#each presets as preset (preset.label)}
            <Button
                variant={picked === preset.label ? 'solid' : 'outline'}
                size="sm"
                label={preset.label}
                onclick={() => pick(preset)}
            />
        {/each}
        <span class="text-xs text-on-surface-variant">
            {presets.find((preset) => preset.label === picked)?.hint ?? 'dữ liệu anh tự dán'}
        </span>
    </div>

    <div class="space-y-3">
        <div class="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h2 class="text-sm font-medium text-on-surface">
                Lưới dựng ra: {columns.length} cột từ {rows.length} dòng, không viết dòng cột nào
            </h2>
            <span class="text-xs text-on-surface-variant">
                sort, filter, sửa ô và chọn vùng đều chạy như lưới viết tay
            </span>
        </div>

        {#if grid}
            {#key grid}
                <DataGrid {grid} toolbar class="h-100" />
            {/key}
        {:else}
            <p class="text-sm text-on-surface-variant">
                Không có cột nào dựng được từ dữ liệu này.
            </p>
        {/if}
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
        <div class="space-y-2">
            <h2 class="text-sm font-medium text-on-surface">Nó đoán ra gì</h2>
            <div class="overflow-x-auto rounded-lg border border-outline-variant">
                <table class="w-full text-left text-xs">
                    <thead class="bg-surface-container text-on-surface">
                        <tr>
                            <th class="px-3 py-2 font-medium">Khoá trong JSON</th>
                            <th class="px-3 py-2 font-medium">Tiêu đề</th>
                            <th class="px-3 py-2 font-medium">type</th>
                            <th class="px-3 py-2 font-medium">filter</th>
                        </tr>
                    </thead>
                    <tbody class="text-on-surface-variant">
                        {#each columns as column (column.id)}
                            <tr class="border-t border-outline-variant">
                                <td class="px-3 py-2"><code>{column.id}</code></td>
                                <td class="px-3 py-2">{column.header}</td>
                                <td class="px-3 py-2"><code>{column.type}</code></td>
                                <td class="px-3 py-2"><code>{String(column.filter)}</code></td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
            <p class="text-xs text-on-surface-variant">
                Khoá nào không có ở đây là bị bỏ có chủ ý: giá trị là object hay mảng thì không ô
                nào vẽ được, còn khoá bắt đầu bằng <code>__</code> là chỗ package này đánh dấu hàng của
                riêng nó.
            </p>
        </div>

        <div class="space-y-2">
            <div class="flex items-center justify-between">
                <h2 class="text-sm font-medium text-on-surface">Thứ anh khỏi phải gõ</h2>
                <Button
                    variant="outline"
                    size="xs"
                    label={clipboard.copied ? 'Đã chép' : 'Chép code'}
                    onclick={() => void clipboard.copy(code)}
                />
            </div>
            <pre
                class="max-h-80 overflow-auto rounded-lg border border-outline-variant bg-surface-container p-3 text-xs text-on-surface-variant">{code}</pre>
        </div>
    </div>

    <div class="space-y-2">
        <h2 class="text-sm font-medium text-on-surface">
            Dữ liệu vào (sửa được, rồi bấm Dựng lại)
        </h2>
        <Textarea bind:value={source} rows={10} class="font-mono text-xs" aria-label="JSON" />
        <div class="flex items-center gap-2">
            <Button size="sm" label="Dựng lại" onclick={build} />
            {#if error}
                <span class="text-xs text-error">{error} - lưới bên trên vẫn giữ dữ liệu cũ</span>
            {/if}
        </div>
    </div>

    <p class="text-xs text-on-surface-variant">
        Quy tắc đoán: toàn số thì <code>number</code> + căn phải, toàn boolean thì
        <code>boolean</code>, chuỗi <code>YYYY-MM-DD</code> thì <code>date</code>, có phần giờ hoặc
        là <code>Date</code> thì <code>datetime</code>. Chuỗi lặp lại nhiều (tối đa 8 giá trị khác
        nhau và không quá một nửa số mẫu) thì cho <code>badge</code> + bộ lọc <code>set</code>, còn
        lại là text. Chuỗi <em>trông như số</em> vẫn là text - xem preset Bảng lương: mã
        <code>01000</code> mà đoán thành số là mất số 0 đầu, và số điện thoại không phải số tiền.
    </p>
</Container>
