<script lang="ts">
    import { Card, Container, Link, Select, ThemeModeButton } from 'sv5ui'
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
        type GridState
    } from '$lib/index.js'
    import {
        deDE,
        enUS,
        esES,
        frFR,
        idID,
        jaJP,
        koKR,
        ptBR,
        ruRU,
        thTH,
        viVN,
        zhCN
    } from '$lib/locales/index.js'

    const packs = [enUS, viVN, zhCN, jaJP, koKR, frFR, deDE, esES, ptBR, ruRU, idID, thTH]

    /** Each language names itself, the way a language picker should read. */
    const languages = [
        { value: 'en-US', label: 'English' },
        { value: 'vi-VN', label: 'Tiếng Việt' },
        { value: 'zh-CN', label: '简体中文' },
        { value: 'ja-JP', label: '日本語' },
        { value: 'ko-KR', label: '한국어' },
        { value: 'fr-FR', label: 'Français' },
        { value: 'de-DE', label: 'Deutsch' },
        { value: 'es-ES', label: 'Español' },
        { value: 'pt-BR', label: 'Português (Brasil)' },
        { value: 'ru-RU', label: 'Русский' },
        { value: 'id-ID', label: 'Bahasa Indonesia' },
        { value: 'th-TH', label: 'ไทย' }
    ]

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
            // No `locale` here on purpose: the column inherits the grid's, so
            // the amounts reformat when the language changes.
            typeOptions: { currency: 'VND' },
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

    // The packs handed in are the whole configuration: the grid takes the
    // page's language from here. Assigning `grid.locale` switches it in place —
    // the sort, filter and selection on screen all survive.
    const grid: GridState<Order> = createDataGrid<Order>({
        data: orders,
        columns,
        getRowId: (order) => String(order.id),
        locales: packs,
        features: [
            sorting(),
            filtering(),
            columnOps(),
            selection(),
            editing(),
            pagination({ pageSize: 8 })
        ]
    })

    let lang = $state(grid.locale ?? 'vi-VN')
    $effect(() => {
        grid.locale = lang
    })

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

    const active = $derived(packs.find((pack) => pack.tag === lang) ?? enUS)
    const missing = $derived(Object.keys(defaultLabels).filter((key) => !(key in active.labels)))
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">i18n — phủ hết chuỗi hiển thị</h1>
            <p class="max-w-3xl text-sm text-on-surface-variant">
                Chỉ khai báo <code>locales: [enUS, viVN, …]</code> — không cấu hình chuỗi nào. Lưới
                tự chọn theo ngôn ngữ của trang, và đổi <code>grid.locale</code> là đổi tại chỗ: sort,
                lọc, dòng đang chọn đều giữ nguyên, số tiền cũng định dạng lại theo.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex items-center gap-3">
        <div class="w-56">
            <Select items={languages} bind:value={lang} aria-label="Ngôn ngữ" />
        </div>
        <p class="text-sm text-on-surface-variant">
            {missing.length === 0
                ? `${active.tag} phủ đủ ${Object.keys(defaultLabels).length} khoá — ${packs.length} ngôn ngữ đóng sẵn.`
                : `Còn thiếu: ${missing.join(', ')}`}
        </p>
    </div>

    <DataGrid {grid} toolbar />

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
