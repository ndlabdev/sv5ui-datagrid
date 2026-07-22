<script lang="ts">
    import { Button, Container, Link, ThemeModeButton } from 'sv5ui'
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        defineDataGridConfig,
        filtering,
        pagination,
        resetDataGridConfig,
        sorting,
        type ColumnDef,
        type DataGridUi
    } from '$lib/index.js'

    interface Invoice {
        id: number
        client: string
        status: string
        amount: number
        dueInDays: number
    }

    const clients = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Soylent', 'Hooli']
    const statuses = ['paid', 'pending', 'overdue']

    const invoices: Invoice[] = Array.from({ length: 60 }, (_, i) => ({
        id: i + 1,
        client: `${clients[i % clients.length]} #${100 + i}`,
        status: statuses[i % statuses.length],
        // Credit notes are negative, so the cellClass demo has something to catch.
        amount: (i % 7 === 0 ? -1 : 1) * (250 + ((i * 137) % 4000)),
        dueInDays: ((i * 13) % 45) - 15
    }))

    const columns: ColumnDef<Invoice>[] = [
        { id: 'client', header: 'Client', sortable: true, filter: 'text', flex: 2 },
        {
            id: 'status',
            header: 'Status',
            sortable: true,
            filter: 'set',
            type: 'badge',
            typeOptions: {
                colors: { paid: 'success', pending: 'warning', overdue: 'error' }
            }
        },
        {
            id: 'amount',
            header: 'Amount',
            sortable: true,
            filter: 'number',
            align: 'right',
            type: 'currency',
            // Data-driven cell styling: a credit note reads as a credit note.
            cellClass: (ctx) => (Number(ctx.value) < 0 ? 'text-error font-medium' : undefined)
        },
        {
            id: 'dueInDays',
            header: 'Due (days)',
            sortable: true,
            filter: 'number',
            align: 'right',
            cellClass: (ctx) => Number(ctx.value) < 0 && 'text-error'
        }
    ]

    const grid = createDataGrid<Invoice>({
        columns,
        data: invoices,
        getRowId: (invoice) => String(invoice.id),
        // Row-level styling reads the whole row, not one cell.
        rowClass: (node) => node.row.status === 'overdue' && 'bg-error-container/30',
        features: [filtering(), sorting(), columnOps(), pagination({ pageSize: 12 })]
    })

    // ── Per-instance `ui` ────────────────────────────────────────────────
    const presets = {
        none: undefined,
        compactMono: {
            headerCell: 'uppercase tracking-wider text-[11px]',
            cell: 'font-mono text-[13px]'
        },
        bordered: {
            cell: 'border-e border-outline-variant',
            headerCell: 'border-e border-outline-variant',
            viewport: 'rounded-none border-2 border-primary'
        },
        zebra: {
            row: 'even:bg-surface-container-lowest',
            headerRow: 'bg-primary-container',
            headerCell: 'text-on-primary-container font-semibold'
        }
    } satisfies Record<string, DataGridUi | undefined>

    type PresetName = keyof typeof presets
    let preset = $state<PresetName>('none')
    const ui = $derived(presets[preset])

    // ── App-wide config ──────────────────────────────────────────────────
    let configOn = $state(false)

    function toggleConfig() {
        configOn = !configOn
        if (configOn) {
            defineDataGridConfig({
                defaultVariants: { density: 'compact' },
                slots: { statusBar: 'font-medium text-primary' }
            })
        } else {
            resetDataGridConfig()
        }
        // The config is read when a grid mounts, so show the effect immediately.
        grid.density = configOn ? 'compact' : 'standard'
    }

    const presetLabels: Record<PresetName, string> = {
        none: 'Mặc định',
        compactMono: 'Mono',
        bordered: 'Bordered',
        zebra: 'Zebra'
    }
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Theming — §9</h1>
            <p class="text-sm text-on-surface-variant">
                Ba tầng ghi đè, từ rộng tới hẹp: <code>defineDataGridConfig</code> cho cả app →
                <code>ui</code> cho một grid →
                <code>cellClass</code>/<code>rowClass</code> cho từng ô, từng hàng. Tất cả đi qua tailwind-merge
                nên class của bạn thắng class mặc định thay vì chồng lên nó.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <section class="space-y-3">
        <div class="space-y-1">
            <h2 class="text-lg font-medium text-on-surface">1. Per-instance <code>ui</code></h2>
            <p class="text-sm text-on-surface-variant">
                Ghi đè theo slot cho riêng grid này. Đổi preset để thấy cùng một grid đổi hình mà
                không remount.
            </p>
        </div>
        <div class="flex flex-wrap items-center gap-2">
            {#each Object.keys(presets) as name (name)}
                <Button
                    size="sm"
                    variant={preset === name ? 'solid' : 'outline'}
                    label={presetLabels[name as PresetName]}
                    onclick={() => (preset = name as PresetName)}
                />
            {/each}
        </div>
    </section>

    <section class="space-y-3">
        <div class="space-y-1">
            <h2 class="text-lg font-medium text-on-surface">2. App-wide config</h2>
            <p class="text-sm text-on-surface-variant">
                <code>defineDataGridConfig</code> đặt mặc định cho mọi grid — ở đây là density
                <code>compact</code> và một status bar in đậm. Grid nào tự khai báo density thì giữ nguyên
                lựa chọn của nó.
            </p>
        </div>
        <Button
            size="sm"
            variant={configOn ? 'solid' : 'outline'}
            label={configOn ? 'Đang bật config compact' : 'Bật config compact'}
            onclick={toggleConfig}
        />
    </section>

    <section class="space-y-3">
        <div class="space-y-1">
            <h2 class="text-lg font-medium text-on-surface">
                3. <code>cellClass</code> / <code>rowClass</code>
            </h2>
            <p class="text-sm text-on-surface-variant">
                Hàng <strong>overdue</strong> có nền đỏ nhạt (rowClass). Ô
                <strong>Amount</strong>
                và <strong>Due</strong> âm chuyển sang màu error (cellClass) — chú ý màu chữ mặc định
                bị thay hẳn chứ không cộng dồn.
            </p>
        </div>
        <DataGrid {grid} {ui} toolbar />
    </section>

    <p class="text-xs text-on-surface-variant">
        Thứ tự merge: class của variant → <code>defineDataGridConfig().slots</code> →
        <code>ui</code>
        của instance → <code>cellClass</code>/<code>rowClass</code>. Cái sau luôn thắng cái trước.
        <code>cellClass</code> chỉ chạy cho cột có khai báo nó, nên grid không dùng thì không tốn gì.
    </p>
</Container>
