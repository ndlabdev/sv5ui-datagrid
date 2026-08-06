<script lang="ts">
    import { Button, Card, Container, Link, Select, ThemeModeButton } from 'sv5ui'
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        filtering,
        getVirtualization,
        selection,
        sorting,
        virtualization,
        type ColumnDef,
        type GridState
    } from '$lib/index.js'

    interface Record_ {
        id: number
        ref: string
        customer: string
        email: string
        country: string
        city: string
        status: string
        tier: string
        owner: string
        channel: string
        total: number
        margin: number
        units: number
        discount: number
        score: number
        rating: number
        opened: string
        closed: string
        active: boolean
        flagged: boolean
        note: string
        region: string
        segment: string
        source: string
        currency: string
        stage: string
        priority: string
        renewal: string
        lastSeen: string
        seats: number
        licences: number
        arr: number
        churn: number
        nps: number
        tickets: number
        latency: number
        uptime: number
        invoiced: boolean
        trial: boolean
    }

    const countries = ['VN', 'US', 'DE', 'JP', 'SG', 'AU', 'BR', 'FR']
    const cities = ['Hanoi', 'Austin', 'Berlin', 'Osaka', 'Singapore', 'Sydney', 'Rio', 'Lyon']
    const statuses = ['Open', 'Won', 'Lost', 'Pending']
    const tiers = ['Free', 'Pro', 'Enterprise']
    const owners = ['Ada', 'Linus', 'Grace', 'Alan', 'Margaret', 'Edsger']
    const channels = ['Direct', 'Partner', 'Web', 'Referral']
    const regions = ['APAC', 'EMEA', 'AMER']
    const segments = ['SMB', 'Mid-market', 'Enterprise']
    const sources = ['Ads', 'Organic', 'Event', 'Outbound', 'Reseller']
    const currencies = ['USD', 'EUR', 'JPY', 'VND']
    const stages = ['Discovery', 'Trial', 'Negotiation', 'Closed']
    const priorities = ['P1', 'P2', 'P3']

    /**
     * Built as a plain loop over preallocated storage: at a million rows the
     * difference between this and `Array.from` is seconds, and the point of
     * the page is to measure the grid rather than the generator.
     */
    function build(count: number): Record_[] {
        const rows = new Array<Record_>(count)
        for (let i = 0; i < count; i++) {
            rows[i] = {
                id: i + 1,
                ref: `REF-${(i + 1).toString(36).toUpperCase()}`,
                customer: `Customer ${i % 5000}`,
                email: `user${i % 5000}@example.com`,
                country: countries[i % 8],
                city: cities[(i + 3) % 8],
                status: statuses[i % 4],
                tier: tiers[i % 3],
                owner: owners[i % 6],
                channel: channels[i % 4],
                total: 1000 + ((i * 977) % 900_000),
                margin: (i % 60) / 100,
                units: (i % 400) + 1,
                discount: (i % 35) / 100,
                score: (i * 37) % 100,
                rating: (i % 5) + 1,
                opened: `202${4 + (i % 3)}-0${(i % 9) + 1}-1${i % 9}`,
                closed: `202${5 + (i % 2)}-0${(i % 9) + 1}-2${i % 8}`,
                active: i % 3 !== 0,
                flagged: i % 17 === 0,
                note: i % 4 === 0 ? 'Needs review before the quarter closes.' : '',
                region: regions[i % 3],
                segment: segments[(i + 1) % 3],
                source: sources[i % 5],
                currency: currencies[i % 4],
                stage: stages[(i + 2) % 4],
                priority: priorities[i % 3],
                renewal: `202${6 + (i % 2)}-0${(i % 9) + 1}-0${(i % 8) + 1}`,
                lastSeen: `2026-0${(i % 9) + 1}-1${i % 9}`,
                seats: (i % 900) + 1,
                licences: (i % 1200) + 5,
                arr: 5000 + ((i * 613) % 2_000_000),
                churn: (i % 45) / 100,
                nps: (i % 101) - 0,
                tickets: i % 60,
                latency: 20 + (i % 480),
                uptime: 0.9 + (i % 100) / 1000,
                invoiced: i % 5 !== 0,
                trial: i % 11 === 0
            }
        }
        return rows
    }

    const columns: ColumnDef<Record_>[] = [
        { id: 'id', header: '#', width: 90, align: 'right', sortable: true, pinned: 'left' },
        { id: 'ref', header: 'Ref', width: 130, sortable: true, filter: 'text' },
        { id: 'customer', header: 'Customer', width: 190, sortable: true, filter: 'text' },
        { id: 'email', header: 'Email', width: 230, filter: 'text' },
        { id: 'country', header: 'Country', width: 110, filter: 'set' },
        { id: 'city', header: 'City', width: 140, filter: 'set' },
        {
            id: 'status',
            header: 'Status',
            width: 130,
            type: 'badge',
            filter: 'set',
            typeOptions: {
                colors: { Open: 'info', Won: 'success', Lost: 'error', Pending: 'warning' }
            }
        },
        { id: 'tier', header: 'Tier', width: 130, type: 'badge', filter: 'set' },
        { id: 'owner', header: 'Owner', width: 140, sortable: true, filter: 'set' },
        { id: 'channel', header: 'Channel', width: 130, filter: 'set' },
        {
            id: 'total',
            header: 'Total',
            width: 150,
            align: 'right',
            sortable: true,
            filter: 'number',
            type: 'currency',
            typeOptions: { currency: 'USD', numberFormat: { maximumFractionDigits: 0 } }
        },
        {
            id: 'margin',
            header: 'Margin',
            width: 120,
            align: 'right',
            sortable: true,
            type: 'percent'
        },
        { id: 'units', header: 'Units', width: 110, align: 'right', sortable: true },
        { id: 'discount', header: 'Discount', width: 120, align: 'right', type: 'percent' },
        { id: 'score', header: 'Score', width: 150, type: 'progress' },
        { id: 'rating', header: 'Rating', width: 150, type: 'rating' },
        { id: 'opened', header: 'Opened', width: 140, sortable: true, type: 'date' },
        { id: 'closed', header: 'Closed', width: 140, type: 'date' },
        { id: 'active', header: 'Active', width: 100, align: 'center', type: 'boolean' },
        { id: 'flagged', header: 'Flagged', width: 110, align: 'center', type: 'boolean' },
        { id: 'note', header: 'Note', width: 280 },
        { id: 'region', header: 'Region', width: 110, filter: 'set' },
        { id: 'segment', header: 'Segment', width: 140, filter: 'set' },
        { id: 'source', header: 'Source', width: 130, filter: 'set' },
        { id: 'currency', header: 'Currency', width: 110, filter: 'set' },
        { id: 'stage', header: 'Stage', width: 140, type: 'badge', filter: 'set' },
        { id: 'priority', header: 'Priority', width: 110, type: 'badge', filter: 'set' },
        { id: 'renewal', header: 'Renewal', width: 140, sortable: true, type: 'date' },
        { id: 'lastSeen', header: 'Last seen', width: 150, type: 'datetime' },
        { id: 'seats', header: 'Seats', width: 110, align: 'right', sortable: true },
        { id: 'licences', header: 'Licences', width: 120, align: 'right', sortable: true },
        {
            id: 'arr',
            header: 'ARR',
            width: 160,
            align: 'right',
            sortable: true,
            filter: 'number',
            type: 'currency',
            typeOptions: { currency: 'USD', numberFormat: { maximumFractionDigits: 0 } }
        },
        { id: 'churn', header: 'Churn', width: 120, align: 'right', type: 'percent' },
        { id: 'nps', header: 'NPS', width: 150, type: 'progress' },
        { id: 'tickets', header: 'Tickets', width: 110, align: 'right', sortable: true },
        { id: 'latency', header: 'Latency', width: 120, align: 'right', sortable: true },
        { id: 'uptime', header: 'Uptime', width: 130, align: 'right', type: 'percent' },
        { id: 'invoiced', header: 'Invoiced', width: 110, align: 'center', type: 'boolean' },
        { id: 'trial', header: 'Trial', width: 100, align: 'center', type: 'boolean' }
    ]

    const sizes = [
        { label: '100.000 dòng', value: '100000' },
        { label: '500.000 dòng', value: '500000' },
        { label: '1.000.000 dòng', value: '1000000' }
    ]

    let size = $state('100000')
    let buildMs = $state(0)
    let mountMs = $state(0)
    let loading = $state(false)

    const grid: GridState<Record_> = createDataGrid<Record_>({
        data: [],
        columns,
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            filtering(),
            columnOps(),
            selection(),
            virtualization({ rowHeight: 40, overscan: 6, columns: true })
        ]
    })

    const virt = getVirtualization(grid)!

    const nextFrame = () =>
        new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))

    async function load() {
        loading = true
        // Building a million rows holds the main thread, so the skeleton only
        // reaches the screen if the browser is given a frame first.
        await nextFrame()

        const count = Number(size)
        const t0 = performance.now()
        const rows = build(count)
        buildMs = Math.round(performance.now() - t0)

        const t1 = performance.now()
        grid.data = rows
        loading = false
        await nextFrame()
        mountMs = Math.round(performance.now() - t1)
    }

    $effect(() => {
        void size
        load()
    })

    const rendered = $derived(virt.virtualizer.range.end - virt.virtualizer.range.start)
    const renderedCols = $derived(
        virt.columnVirtualizer
            ? virt.columnVirtualizer.range.end - virt.columnVirtualizer.range.start
            : columns.length
    )
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Stress — nhiều dòng, nhiều cột</h1>
            <p class="max-w-3xl text-sm text-on-surface-variant">
                39 cột với đủ kiểu hiển thị (tiền tệ, phần trăm, ngày, badge, progress, rating,
                boolean) trên tối đa một triệu dòng. Ảo hoá cả hai chiều, nên số ô thực sự nằm trong
                DOM không đổi theo lượng dữ liệu. Sắp xếp, lọc và cuộn đều chạy trên toàn bộ tập.
                Quá một triệu dòng thì tổng chiều cao vượt mức trình duyệt chịu vẽ, nên thanh cuộn
                được nén lại — dòng cuối vẫn tới được, chỉ là mỗi pixel cuộn đi xa hơn.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-3">
        <div class="w-48"><Select items={sizes} bind:value={size} aria-label="Số dòng" /></div>
        <Button size="sm" variant="outline" onclick={load}>Nạp lại</Button>
        <dl class="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-on-surface-variant">
            <div>
                <dt class="inline">Sinh dữ liệu:</dt>
                <dd class="inline font-medium text-on-surface">{buildMs}ms</dd>
            </div>
            <div>
                <dt class="inline">Vào lưới:</dt>
                <dd class="inline font-medium text-on-surface">{mountMs}ms</dd>
            </div>
            <div>
                <dt class="inline">Dòng vẽ:</dt>
                <dd class="inline font-medium text-on-surface">{rendered}</dd>
            </div>
            <div>
                <dt class="inline">Cột vẽ:</dt>
                <dd class="inline font-medium text-on-surface">{renderedCols}/{columns.length}</dd>
            </div>
            <div>
                <dt class="inline">Tổng:</dt>
                <dd class="inline font-medium text-on-surface">
                    {grid.totalRows.toLocaleString('vi-VN')}
                </dd>
            </div>
        </dl>
    </div>

    <DataGrid {grid} {loading} toolbar class="h-[560px]" />

    <Card class="space-y-2 p-4">
        <h2 class="font-medium text-on-surface">Cần soi</h2>
        <ul class="list-inside list-disc space-y-1 text-sm text-on-surface-variant">
            <li>Số dòng và cột được vẽ giữ nguyên dù chọn 100k hay 1 triệu.</li>
            <li>Cuộn dọc và ngang cùng lúc — cột <code>#</code> ghim trái phải đứng yên.</li>
            <li>Sắp theo Total (số) và Customer (chuỗi) trên toàn bộ tập.</li>
            <li>Lọc nhanh chạy trên mọi cột đang hiện, không chỉ trang đang xem.</li>
            <li>Chọn hết rồi xem thanh trạng thái đếm đúng tổng.</li>
            <li>Ở 1 triệu dòng, kéo thanh cuộn xuống đáy phải chạm được dòng cuối cùng.</li>
        </ul>
    </Card>
</Container>
