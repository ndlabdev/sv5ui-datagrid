<script lang="ts">
    import { Button, Card, Checkbox, Container, Link, Select, ThemeModeButton } from 'sv5ui'
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        filtering,
        getSelection,
        pickColumns,
        rowsToMatrix,
        selection,
        sorting,
        toCsv,
        withHeaderRow,
        type ColumnDef,
        type ExportCsvOptions,
        type GridState
    } from '$lib/index.js'

    interface Sale {
        id: number
        customer: string
        region: string
        note: string
        amount: number
        signed: string
        internal: string
    }

    // Every awkward case a CSV has to survive, on purpose:
    // a comma, a semicolon, a quote, a newline, a leading `=`, and a blank.
    const sales: Sale[] = [
        {
            id: 1,
            customer: 'Nguyễn Văn A',
            region: 'Miền Bắc',
            note: 'Có, dấu phẩy',
            amount: 12_500_000,
            signed: '2026-01-15',
            internal: 'chỉ nội bộ'
        },
        {
            id: 2,
            customer: 'Trần Thị B',
            region: 'Miền Nam',
            note: 'Có; dấu chấm phẩy',
            amount: 8_400_000,
            signed: '2026-02-03',
            internal: 'chỉ nội bộ'
        },
        {
            id: 3,
            customer: 'Lê "Bé" C',
            region: 'Miền Trung',
            note: 'Có "ngoặc kép"',
            amount: 21_000_000,
            signed: '2026-02-27',
            internal: 'chỉ nội bộ'
        },
        {
            id: 4,
            customer: 'Phạm D',
            region: 'Miền Nam',
            note: 'Hai\ndòng',
            amount: 3_200_000,
            signed: '2026-03-11',
            internal: 'chỉ nội bộ'
        },
        {
            id: 5,
            customer: 'Võ E',
            region: 'Miền Bắc',
            note: '=SUM(A1:A9)',
            amount: 0,
            signed: '2026-03-19',
            internal: 'chỉ nội bộ'
        },
        {
            id: 6,
            customer: 'Đặng F',
            region: 'Miền Trung',
            note: '',
            amount: 5_750_000,
            signed: '2026-04-02',
            internal: 'chỉ nội bộ'
        }
    ]

    const columns: ColumnDef<Sale>[] = [
        { id: 'id', header: 'Mã', width: 80, align: 'right', sortable: true },
        { id: 'customer', header: 'Khách hàng', width: 170, sortable: true, filter: 'text' },
        { id: 'region', header: 'Vùng', width: 130, filter: 'set' },
        { id: 'note', header: 'Ghi chú', flex: 1, minWidth: 200, filter: 'text' },
        {
            id: 'amount',
            header: 'Doanh số',
            width: 160,
            align: 'right',
            sortable: true,
            filter: 'number',
            type: 'currency',
            typeOptions: { currency: 'VND', locale: 'vi-VN' }
        },
        { id: 'signed', header: 'Ngày ký', width: 130, sortable: true, type: 'date' },
        // Hidden in the grid, still exportable by naming it explicitly.
        { id: 'internal', header: 'Ghi chú nội bộ', width: 160, hidden: true }
    ]

    const grid: GridState<Sale> = createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: (sale) => String(sale.id),
        features: [sorting(), filtering(), columnOps(), selection()]
    })
    const selectionState = getSelection(grid)!

    const delimiters = [
        { label: 'Dấu phẩy  ,', value: ',' },
        { label: 'Chấm phẩy  ;', value: ';' },
        { label: 'Tab', value: '\t' }
    ]
    const columnSets = [
        { label: 'Cột đang hiện', value: 'visible' },
        { label: 'Chỉ Khách hàng + Doanh số', value: 'short' },
        { label: 'Kèm cột ẩn (Ghi chú nội bộ)', value: 'hidden' }
    ]

    let delimiter = $state(',')
    let columnSet = $state('visible')
    let headers = $state(true)
    let allRows = $state(true)
    let formatted = $state(false)

    const money = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' })

    const chosenColumns = $derived(
        columnSet === 'short'
            ? ['customer', 'amount']
            : columnSet === 'hidden'
              ? ['id', 'customer', 'amount', 'internal']
              : undefined
    )

    const options = $derived<ExportCsvOptions<Sale>>({
        filename: 'doanh-so.csv',
        delimiter,
        headers,
        allRows,
        columns: chosenColumns,
        formatValue: formatted
            ? ({ value, column }) =>
                  column.id === 'amount' ? money.format(Number(value)) : String(value ?? '')
            : undefined
    })

    /**
     * The same pieces `exportCsv` uses, so what is shown is what lands in the
     * file — minus the BOM, which is a byte and not a character.
     */
    const preview = $derived.by(() => {
        const selected = selectionState.selectedNodes
        const nodes = allRows || selected.length === 0 ? grid.preWindowNodes : selected
        const source = chosenColumns ? grid.columns.all : grid.columns.visible
        const picked = pickColumns(source, chosenColumns)
        if (nodes.length === 0 || picked.length === 0) return '(không có gì để xuất)'
        const matrix = rowsToMatrix(nodes, picked, options.formatValue)
        return toCsv(headers ? withHeaderRow(matrix, picked) : matrix, delimiter)
    })
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Xuất CSV</h1>
            <p class="max-w-3xl text-sm text-on-surface-variant">
                Dữ liệu cố tình chứa dấu phẩy, chấm phẩy, ngoặc kép, xuống dòng, ô trống và một
                chuỗi <code>=SUM(...)</code> mà bảng tính sẽ chạy như công thức. Khung xem trước
                dựng bằng đúng các hàm mà <code>exportCsv</code> dùng, nên nó là nội dung thật của file
                — trừ BOM UTF-8 vốn là byte chứ không phải ký tự.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <Card class="flex flex-wrap items-center gap-4 p-3">
        <Select items={delimiters} bind:value={delimiter} aria-label="Dấu phân cách" class="w-52" />
        <Select items={columnSets} bind:value={columnSet} aria-label="Cột xuất" class="w-64" />
        <div class="flex flex-wrap items-center gap-x-5 gap-y-2">
            <Checkbox bind:checked={headers} label="Dòng tiêu đề" />
            <Checkbox bind:checked={allRows} label="Mọi dòng (bỏ tick = chỉ dòng đã chọn)" />
            <Checkbox bind:checked={formatted} label="Định dạng tiền tệ khi xuất" />
        </div>
        <span class="grow"></span>
        <Button
            label="Tải file"
            icon="lucide:download"
            size="sm"
            onclick={() => selectionState.exportCsv(options)}
        />
    </Card>

    <DataGrid {grid} toolbar />

    <Card class="space-y-2 p-4">
        <h2 class="font-medium text-on-surface">Nội dung file</h2>
        <p class="text-sm text-on-surface-variant">
            Cần thấy: ô chứa dấu phân cách đang dùng thì được bọc ngoặc kép, ngoặc kép bên trong bị
            nhân đôi, ô bắt đầu bằng <code>=</code> được thêm dấu nháy đơn, xuống dòng giữ nguyên trong
            ô đã bọc, dòng kết thúc bằng CRLF.
        </p>
        <pre
            class="max-h-72 overflow-auto rounded bg-surface-container-lowest p-3 font-mono text-xs whitespace-pre text-on-surface">{preview}</pre>
    </Card>
</Container>
