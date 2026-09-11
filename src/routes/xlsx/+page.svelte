<script lang="ts">
    import { createDataGrid, filtering, sorting, type ColumnDef } from '$lib/index.js'
    import { Button, Container, Link, ThemeModeButton } from 'sv5ui'
    import { DataGrid } from '$lib/index.js'
    import { buildGridXlsx, downloadGridXlsx, type XlsxStyle } from '$lib/xlsx.js'

    interface Sale {
        id: number
        region: string
        rep: string
        booked: string
        amount: number
        margin: number
    }

    const REGIONS = ['Bắc', 'Trung', 'Nam']
    const REPS = ['An', 'Bình', 'Chi', 'Dũng']

    const sales: Sale[] = Array.from({ length: 40 }, (_, i) => ({
        id: i + 1,
        region: REGIONS[i % 3]!,
        rep: REPS[i % 4]!,
        booked: `2026-0${(i % 9) + 1}-15`,
        amount: (i % 7 === 0 ? -1 : 1) * (500 + i * 137),
        margin: ((i % 11) - 3) / 20
    }))

    const columns: ColumnDef<Sale>[] = [
        { id: 'region', header: 'Khu vực', width: 140, sortable: true, filter: 'text' },
        { id: 'rep', header: 'Nhân viên', width: 140, sortable: true },
        { id: 'booked', header: 'Ngày', width: 140, type: 'date' },
        { id: 'amount', header: 'Doanh số', width: 160, align: 'right', type: 'currency' },
        { id: 'margin', header: 'Biên', width: 120, align: 'right', type: 'percent' }
    ]

    const grid = createDataGrid<Sale>({
        columns,
        data: sales,
        getRowId: (row) => String(row.id),
        features: [filtering(), sorting()]
    })

    let styled = $state(true)
    let live = $state(false)
    let size = $state<number | null>(null)
    let styleCount = $state<number | null>(null)
    let firstFormula = $state<string | null>(null)

    const headerStyle: XlsxStyle = {
        font: { bold: true, color: 'FFFFFF' },
        fill: '1F4E79',
        alignment: { horizontal: 'center', vertical: 'middle' },
        border: { bottom: { style: 'medium', color: '0F2B44' } }
    }

    const bookedTotal = sales.reduce((total, sale) => total + sale.amount, 0)
    const lastRow = sales.length + 1

    const shareCell = (row: Sale) => ({
        formula: `D${sales.indexOf(row) + 2}/SUM($D$2:$D$${lastRow})`,
        value: row.amount / bookedTotal
    })

    const liveMargin = $derived(
        live
            ? {
                  value: (row: Sale, column: { id: string }) =>
                      column.id === 'margin' ? shareCell(row) : undefined
              }
            : {}
    )

    const options = $derived(
        styled
            ? {
                  ...liveMargin,
                  filename: 'doanh-so',
                  sheetName: 'Doanh số',
                  headerStyle,
                  columnStyle: (column: { id: string }) =>
                      column.id === 'amount'
                          ? ({ numberFormat: '#,##0 "₫"' } satisfies XlsxStyle)
                          : undefined,
                  cellStyle: (value: unknown) =>
                      typeof value === 'number' && value < 0
                          ? ({
                                font: { color: 'C00000', bold: true },
                                fill: 'FDE9E9'
                            } satisfies XlsxStyle)
                          : undefined
              }
            : { ...liveMargin, filename: 'doanh-so-plain', sheetName: 'Doanh số' }
    )

    function measure() {
        const bytes = buildGridXlsx(grid, options)
        size = bytes.byteLength

        const text = new TextDecoder().decode(bytes)
        styleCount = Number(/<cellXfs count="(\d+)"/.exec(text)?.[1] ?? 0) || null
        firstFormula = /<f>([^<]*)<\/f>/.exec(text)?.[1] ?? null
    }
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">XLSX có style - bàn thử</h1>
            <p class="text-sm text-on-surface-variant">
                Writer tự viết, không thư viện bảng tính. Style gom vào một bảng khử trùng lặp:
                nghìn ô cùng kiểu chỉ tốn <strong>một</strong> bản ghi.
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
                variant={styled ? 'solid' : 'outline'}
                label="Có style"
                aria-pressed={styled}
                onclick={() => (styled = !styled)}
            />
            <Button
                size="sm"
                variant="outline"
                icon="lucide:download"
                label="Tải .xlsx"
                onclick={() => void downloadGridXlsx(grid, options)}
            />
            <Button
                size="sm"
                variant={live ? 'solid' : 'outline'}
                label="Biên là công thức"
                aria-pressed={live}
                onclick={() => (live = !live)}
            />
            <Button size="sm" variant="outline" label="Đo kích thước" onclick={measure} />
            {#if size !== null}
                <span data-demo="measure" class="text-xs text-on-surface-variant">
                    {(size / 1024).toFixed(1)} KB | {styleCount} bản ghi style |
                    {firstFormula ? `công thức đầu tiên: ${firstFormula}` : 'không có <f> nào'}
                </span>
            {/if}
        </div>
    </section>

    <DataGrid {grid} toolbar />

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Cần thử những gì</h2>
        <ol
            class="list-inside list-decimal space-y-1 text-sm text-on-surface-variant marker:text-on-surface"
        >
            <li>Tải file rồi mở bằng Excel / Numbers / Google Sheets - không được hỏi sửa lỗi</li>
            <li>Hàng tiêu đề nền xanh, chữ trắng đậm, canh giữa, có viền dưới</li>
            <li>
                Cột <strong>Doanh số</strong> hiện <code>1.234 ₫</code> nhưng vẫn là <em>số</em>:
                thử <code>SUM</code> lên nó
            </li>
            <li>Ô âm nền hồng chữ đỏ đậm, mà <em>vẫn</em> giữ định dạng tiền của cột</li>
            <li>
                Cột <strong>Biên</strong> hiện phần trăm; <strong>Ngày</strong> so sánh được với
                <code>DATE()</code>
            </li>
            <li>Tắt <strong>Có style</strong> rồi tải lại → file trơn, vẫn mở được</li>
            <li>
                Bấm <strong>Đo kích thước</strong> ở cả hai chế độ → số bản ghi style phải nhỏ (một chữ
                số), không tăng theo số hàng
            </li>
            <li>Lọc hoặc sắp xếp rồi tải → file chứa đúng thứ lưới đang hiện, đúng thứ tự</li>
        </ol>
        <p class="text-xs text-on-surface-variant">
            Bật <strong>Biên là công thức</strong> → cột Biên ghi <code>=D2/SUM($D$2:$D$41)</code>,
            Excel tự tính lại khi ai đó sửa Doanh số. Chuỗi dữ liệu vẫn không bao giờ tự thành công
            thức: chỉ ô nào app bọc trong <code>{'{ formula }'}</code> mới là công thức, còn
            <code>=1+1</code> gõ trong dữ liệu vẫn ra chữ.
        </p>
    </section>
</Container>
