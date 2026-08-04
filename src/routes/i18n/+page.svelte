<script lang="ts">
    import { Card, Container, Link, ThemeModeButton, ToggleGroup } from 'sv5ui'
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        defaultLabels,
        editing,
        filtering,
        pagination,
        selection,
        sorting,
        type ColumnDef,
        type DataGridLabelsInput,
        type DataGridLocale,
        type GridState
    } from '$lib/index.js'

    interface Order {
        id: number
        customer: string
        status: string
        total: number
        placed: string
        paid: boolean
    }

    const customers = ['Nguyễn An', 'Trần Bình', 'Lê Chi', 'Phạm Dũng', 'Võ Em']
    const statuses = ['Đã thanh toán', 'Chờ xử lý', 'Hoàn tiền']

    const orders: Order[] = Array.from({ length: 60 }, (_, i) => ({
        id: i + 1,
        customer: customers[i % 5],
        status: statuses[i % 3],
        total: 250_000 + (i % 40) * 125_000,
        placed: `2026-0${(i % 9) + 1}-1${i % 9}`,
        paid: i % 3 === 0
    }))

    const columns: ColumnDef<Order>[] = [
        { id: 'id', header: 'Mã', width: 90, align: 'right', sortable: true },
        {
            id: 'customer',
            header: 'Khách hàng',
            flex: 1,
            minWidth: 170,
            sortable: true,
            filter: 'text'
        },
        { id: 'status', header: 'Trạng thái', width: 160, filter: 'set', type: 'badge' },
        {
            id: 'total',
            header: 'Tổng tiền',
            width: 160,
            align: 'right',
            sortable: true,
            filter: 'number',
            type: 'currency',
            typeOptions: { currency: 'VND', locale: 'vi-VN' },
            editable: true,
            editor: 'number'
        },
        {
            id: 'placed',
            header: 'Ngày đặt',
            width: 140,
            sortable: true,
            filter: 'date',
            type: 'date'
        },
        {
            id: 'paid',
            header: 'Đã trả',
            width: 110,
            align: 'center',
            filter: 'boolean',
            type: 'boolean'
        }
    ]

    /** A complete translation — every key of `DataGridLabels`, nothing left over. */
    const vi: DataGridLabelsInput = {
        search: 'Tìm kiếm...',
        activeFilters: 'Bộ lọc đang bật',
        removeFilter: (column) => `Bỏ lọc ${column}`,
        clearAllFilters: 'Xoá hết',
        chooseColumns: 'Chọn cột',
        rowDensity: 'Mật độ dòng',
        densityCompact: 'Dày',
        densityStandard: 'Vừa',
        densityComfortable: 'Thưa',

        columnMenu: (column) => `Menu cột ${column}`,
        resizeColumn: (column) => `Đổi rộng cột ${column}`,
        resizeGroup: (group) => `Đổi rộng nhóm ${group}`,
        sortAscending: 'Sắp xếp tăng dần',
        sortDescending: 'Sắp xếp giảm dần',
        clearSort: 'Bỏ sắp xếp',
        pinLeft: 'Ghim trái',
        pinRight: 'Ghim phải',
        unpin: 'Bỏ ghim',
        openFilter: 'Lọc…',
        autosize: 'Vừa nội dung',
        hideColumn: 'Ẩn cột',

        filterColumn: (column) => `Lọc ${column}`,
        filterOperator: (ordinal) => (ordinal > 1 ? `Toán tử lọc ${ordinal}` : 'Toán tử lọc'),
        filterValue: (ordinal) => (ordinal > 1 ? `Giá trị lọc ${ordinal}` : 'Giá trị lọc'),
        filterUpperBound: (ordinal) => (ordinal > 1 ? `Giá trị đến ${ordinal}` : 'Giá trị đến'),
        valuePlaceholder: 'Giá trị...',
        upperBoundPlaceholder: 'Đến...',
        searchValues: 'Tìm giá trị...',
        blankValue: '(trống)',
        combineConditions: 'Kết hợp điều kiện',
        addCondition: 'Thêm điều kiện',
        removeCondition: 'Bớt điều kiện',
        matchCase: 'Phân biệt hoa thường',
        apply: 'Áp dụng',
        clear: 'Xoá',
        and: 'Và',
        or: 'Hoặc',
        yes: 'Có',
        no: 'Không',
        textOps: {
            contains: 'Chứa',
            notContains: 'Không chứa',
            equals: 'Bằng',
            notEqual: 'Khác',
            startsWith: 'Bắt đầu bằng',
            endsWith: 'Kết thúc bằng',
            blank: 'Đang trống',
            notBlank: 'Không trống'
        },
        numberOps: {
            eq: '=',
            neq: '≠',
            gt: '>',
            gte: '≥',
            lt: '<',
            lte: '≤',
            between: 'Trong khoảng',
            blank: 'Đang trống',
            notBlank: 'Không trống'
        },
        dateOps: {
            equals: 'Đúng ngày',
            before: 'Trước ngày',
            after: 'Sau ngày',
            between: 'Trong khoảng',
            blank: 'Đang trống',
            notBlank: 'Không trống'
        },

        selectRow: (position) => `Chọn dòng ${position}`,
        selectAllRows: 'Chọn tất cả các dòng',
        rowActions: 'Thao tác dòng',
        dragRow: (position) => `Chuyển dòng ${position}`,
        expandRow: 'Mở dòng',
        collapseRow: 'Thu dòng',

        rowsPerPage: 'Số dòng mỗi trang',
        pageSizeOption: (size) => `${size} dòng/trang`,
        pageRange: (from, to, total) =>
            `${from.toLocaleString('vi-VN')}–${to.toLocaleString('vi-VN')} trên ${total.toLocaleString('vi-VN')}`,
        totalRows: (total) => `${total.toLocaleString('vi-VN')} dòng`,
        filteredRows: (filtered, total) =>
            `${filtered.toLocaleString('vi-VN')} / ${total.toLocaleString('vi-VN')} dòng`,
        selectedRows: (count) => `đã chọn ${count.toLocaleString('vi-VN')}`,
        noData: 'Không có dữ liệu',
        retry: 'Thử lại',

        copy: 'Sao chép',
        copyWithHeaders: 'Sao chép kèm tiêu đề',
        exportCsv: 'Xuất CSV',
        clearSelection: 'Bỏ chọn'
    }

    /** What a screen reader says — a separate surface from the visible labels. */
    const viLocale: Partial<DataGridLocale> = {
        sorted: (column, direction) =>
            `đã sắp xếp theo ${column} ${direction === 'asc' ? 'tăng dần' : 'giảm dần'}`,
        sortCleared: () => 'đã bỏ sắp xếp',
        filtered: (count) => `còn ${count} dòng`,
        page: (page) => `trang ${page}`,
        selected: (count) => `đã chọn ${count} dòng`,
        copied: (count) => `đã sao chép ${count} dòng`,
        columnResized: (column, width) => `cột ${column} rộng ${width} pixel`,
        columnMoved: (column, position) => `cột ${column} chuyển tới vị trí ${position}`,
        columnPinned: (column, side) =>
            side ? `đã ghim cột ${column}` : `đã bỏ ghim cột ${column}`,
        columnVisibility: (column, hidden) =>
            hidden ? `đã ẩn cột ${column}` : `đã hiện cột ${column}`
    }

    let lang = $state<'vi' | 'en'>('vi')

    function makeGrid(current: 'vi' | 'en'): GridState<Order> {
        return createDataGrid<Order>({
            data: orders,
            columns,
            getRowId: (order) => String(order.id),
            labels: current === 'vi' ? vi : undefined,
            locale: current === 'vi' ? viLocale : undefined,
            features: [
                sorting(),
                filtering(),
                columnOps(),
                selection(),
                editing(),
                pagination({ pageSize: 8 })
            ]
        })
    }

    // Labels are read when the grid is built, so switching language rebuilds it.
    const grid = $derived(makeGrid(lang))

    const surfaces = [
        'Toolbar: ô tìm kiếm, nút chọn cột, nút mật độ',
        'Chip lọc: nhãn "Bỏ lọc …" và nút "Xoá hết"',
        'Menu cột (chuột phải lên header hoặc Alt+↓): sắp xếp, ghim, ẩn, vừa nội dung',
        'Bảng lọc: toán tử, giá trị, kết hợp điều kiện, phân biệt hoa thường, Áp dụng / Xoá',
        'Lọc theo tập hợp: ô tìm giá trị và mục (trống)',
        'Cột chọn: "Chọn tất cả các dòng" và "Chọn dòng n"',
        'Thanh trạng thái: tổng dòng, số dòng sau lọc, số dòng đã chọn',
        'Chân trang: số dòng mỗi trang và khoảng đang xem',
        'Chuột phải vào lưới: sao chép, xuất CSV, bỏ chọn',
        'Trạng thái rỗng và nút thử lại (xem trang QA)'
    ]

    const missing = $derived(Object.keys(defaultLabels).filter((key) => !(key in vi)))
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">i18n — phủ hết chuỗi hiển thị</h1>
            <p class="max-w-3xl text-sm text-on-surface-variant">
                Cùng một lưới, đổi qua lại giữa bản dịch tiếng Việt đầy đủ và mặc định tiếng Anh.
                Mọi chuỗi lưới tự vẽ đều đến từ <code>labels</code>; phần đọc cho screen reader nằm
                riêng ở <code>locale</code>.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex items-center gap-3">
        <ToggleGroup
            items={[
                { label: 'Tiếng Việt', value: 'vi' },
                { label: 'English', value: 'en' }
            ]}
            bind:value={lang}
            aria-label="Ngôn ngữ"
        />
        <p class="text-sm text-on-surface-variant">
            {missing.length === 0
                ? `Bản dịch phủ đủ ${Object.keys(defaultLabels).length} khoá.`
                : `Còn thiếu: ${missing.join(', ')}`}
        </p>
    </div>

    {#key lang}
        <DataGrid {grid} toolbar />
    {/key}

    <Card class="space-y-2 p-4">
        <h2 class="font-medium text-on-surface">Danh sách cần mở để soi</h2>
        <ul class="list-inside list-disc space-y-1 text-sm text-on-surface-variant">
            {#each surfaces as surface (surface)}
                <li>{surface}</li>
            {/each}
        </ul>
        <p class="pt-1 text-sm text-on-surface-variant">
            Announcer đang đọc: <span class="font-mono text-on-surface"
                >{grid.announcer.message || '—'}</span
            >
        </p>
    </Card>
</Container>
