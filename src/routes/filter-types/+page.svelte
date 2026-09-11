<script lang="ts">
    import { Grid, createDataGrid, virtualization, type ColumnDef } from '$lib/index.js'
    import { Badge, Button, Container, Link, ThemeModeButton } from 'sv5ui'
    import { advancedFilter, DataGrid, getAdvancedFilter, type FilterGroup } from '$lib/index.js'
    import { isFilterable, kindOf, opsFor } from '$lib/features/advanced-filter/operators.js'

    interface Order {
        id: number
        code: string
        qty: number
        total: number
        margin: number
        orderedAt: string
        updatedAt: string
        paid: boolean
        status: string
        owner: string
        done: number
        stars: number
        docUrl: string
        note: string
    }

    const statuses = ['mới', 'đang giao', 'hoàn tất', 'huỷ']
    const owners = ['An', 'Bình', 'Chi', 'Dũng']

    const rows: Order[] = Array.from({ length: 90 }, (_, i) => ({
        id: i + 1,
        code: `DH-${String(1000 + i)}`,
        qty: 1 + ((i * 7) % 40),
        total: 250_000 + ((i * 137_000) % 9_500_000),
        margin: ((i * 13) % 60) / 100,
        orderedAt: new Date(Date.UTC(2026, i % 12, (i % 27) + 1)).toISOString().slice(0, 10),
        updatedAt: new Date(Date.UTC(2026, i % 12, (i % 27) + 1, i % 24, 30)).toISOString(),
        paid: i % 3 !== 0,
        status: statuses[i % 4]!,
        owner: owners[i % 4]!,
        done: (i * 11) % 101,
        stars: 1 + (i % 5),
        docUrl: `https://example.com/don-hang/${i + 1}`,
        note: i % 5 === 0 ? 'cần gọi lại' : ''
    }))

    const columns: ColumnDef<Order>[] = [
        { id: 'code', header: 'Mã đơn', width: 120, type: 'text' },
        { id: 'qty', header: 'SL', width: 90, align: 'right', type: 'number' },
        {
            id: 'total',
            header: 'Giá trị',
            width: 150,
            align: 'right',
            type: 'currency',
            typeOptions: { currency: 'VND' }
        },
        { id: 'margin', header: 'Biên LN', width: 110, align: 'right', type: 'percent' },
        { id: 'orderedAt', header: 'Ngày đặt', width: 130, type: 'date' },
        { id: 'updatedAt', header: 'Cập nhật', width: 180, type: 'datetime' },
        { id: 'paid', header: 'Đã trả', width: 100, type: 'boolean' },
        {
            id: 'status',
            header: 'Trạng thái',
            width: 140,
            type: 'badge',
            typeOptions: {
                colors: {
                    'hoàn tất': 'success',
                    'đang giao': 'info',
                    huỷ: 'error'
                }
            }
        },
        { id: 'owner', header: 'Phụ trách', width: 150, type: 'user', filter: 'set' },
        { id: 'done', header: 'Tiến độ', width: 140, type: 'progress' },
        { id: 'stars', header: 'Đánh giá', width: 130, type: 'rating' },
        {
            id: 'docUrl',
            header: 'Chứng từ',
            width: 150,
            type: 'link',
            typeOptions: { target: '_blank' }
        },
        { id: 'note', header: 'Ghi chú', width: 140, filter: false },
        {
            id: 'act',
            header: '',
            width: 60,
            type: 'actions',
            typeOptions: { actions: () => [{ label: 'Mở', onSelect: () => {} }] }
        }
    ]

    const grid = createDataGrid<Order>({
        columns,
        data: rows,
        getRowId: (row) => String(row.id),
        features: [advancedFilter<Order>(), virtualization({ rowHeight: 44, overscan: 8 })]
    })

    const filterState = getAdvancedFilter(grid)!
    const t = $derived(grid.labels)

    const EDITORS: Record<string, string> = {
        text: 'ô chữ (debounce)',
        number: 'ô số (debounce), hai ô cho between',
        date: 'DatePicker của sv5ui, hai ô cho between',
        boolean: 'chọn Có / Không',
        set: 'chọn từ các giá trị cột đang có'
    }

    const reference = $derived(
        columns.map((def) => {
            const offered = isFilterable(def)
            const kind = kindOf(def)
            return {
                header: String(def.header || def.id),
                type: def.type ?? 'text',
                declared: def.filter === false ? 'filter: false' : (def.filter ?? '-'),
                offered,
                kind,
                ops: offered ? opsFor(kind).map((op) => t.filterOp(op)) : [],
                editor: offered ? EDITORS[kind]! : 'không mời vào bộ lọc'
            }
        })
    )

    const one = (
        columnId: string,
        op: string,
        value?: unknown,
        extra: Record<string, unknown> = {}
    ): FilterGroup => ({
        kind: 'group',
        join: 'and',
        children: [{ kind: 'condition', columnId, op, value, ...extra } as never]
    })

    const presets: { label: string; hint: string; model: FilterGroup }[] = [
        {
            label: 'text: mã kết thúc bằng 7',
            hint: 'type "text" → kind text: chứa / bắt đầu / kết thúc, so không phân biệt hoa thường',
            model: one('code', 'endsWith', '7')
        },
        {
            label: 'number: SL ≥ 30',
            hint: 'type "number" → kind number: so bằng số, không so chuỗi, nên 9 < 30',
            model: one('qty', 'gte', 30)
        },
        {
            label: 'currency: 1tr-5tr',
            hint: 'type "currency" cũng là kind number - between lấy cả hai đầu',
            model: one('total', 'between', 1_000_000, { to: 5_000_000 })
        },
        {
            label: 'percent: biên > 30%',
            hint: 'type "percent" là kind number, và so trên giá trị thô 0.3 chứ không phải chuỗi "30%"',
            model: one('margin', 'gt', 0.3)
        },
        {
            label: 'date: đặt trong quý I',
            hint: 'type "date" → kind date: so theo ngày lịch, giữ trọn ngày 31/3',
            model: one('orderedAt', 'between', '2026-01-01', { to: '2026-03-31' })
        },
        {
            label: 'datetime: cập nhật sau 1/6',
            hint: 'type "datetime" cũng là kind date - phần giờ bị bỏ qua, so theo ngày',
            model: one('updatedAt', 'after', '2026-06-01')
        },
        {
            label: 'boolean: chưa trả',
            hint: 'type "boolean" → kind boolean: chỉ bằng / khác, giá trị là true hoặc false',
            model: one('paid', 'equals', false)
        },
        {
            label: 'badge: hoàn tất hoặc huỷ',
            hint: 'type "badge" mặc định là kind text - khai báo filter: "set" nếu muốn danh sách chọn',
            model: {
                kind: 'group',
                join: 'or',
                children: [
                    { kind: 'condition', columnId: 'status', op: 'equals', value: 'hoàn tất' },
                    { kind: 'condition', columnId: 'status', op: 'equals', value: 'huỷ' }
                ]
            }
        },
        {
            label: 'set: phụ trách An/Chi',
            hint: 'cột "user" khai báo filter: "set" → toán tử in, chọn từ giá trị cột đang có',
            model: one('owner', 'in', undefined, { values: ['An', 'Chi'] })
        },
        {
            label: 'progress: tiến độ < 20',
            hint: 'type "progress" là kind number, so trên số phía sau thanh tiến độ',
            model: one('done', 'lt', 20)
        },
        {
            label: 'rating: 5 sao',
            hint: 'type "rating" cũng là kind number, so trên số sao',
            model: one('stars', 'equals', 5)
        },
        {
            label: 'link: chứng từ có 8',
            hint: 'type "link" là kind text - lọc trên chính giá trị ô, không phải trên chữ hiển thị',
            model: one('docUrl', 'contains', '8')
        },
        {
            label: 'rỗng: ghi chú trống',
            hint: 'blank / notBlank có ở mọi kind, và không cần giá trị nào',
            model: one('note', 'blank')
        }
    ]

    let picked = $state<string | null>(null)

    function pick(preset: (typeof presets)[number]) {
        filterState.setModel(preset.model)
        picked = preset.label
    }

    function clear() {
        filterState.clear()
        picked = null
    }
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">
                Lọc theo từng kiểu cột - @sv5ui/datagrid
            </h1>
            <p class="text-sm text-on-surface-variant">
                Mỗi cột dưới đây là một <code>type</code> mà Community hỗ trợ. Bộ lọc nâng cao quy
                mười ba kiểu cột về <strong>năm nhóm toán tử</strong>, và bảng cuối trang nói rõ cột
                nào rơi vào nhóm nào - bảng đó sinh thẳng từ
                <code>kindOf()</code> nên không thể lệch với code.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/filter">← Lọc nâng cao</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
        {#each presets as preset (preset.label)}
            <Button
                variant={picked === preset.label ? 'solid' : 'outline'}
                size="sm"
                label={preset.label}
                onclick={() => pick(preset)}
            />
        {/each}
        <Button variant="ghost" size="sm" label="Bỏ lọc" onclick={clear} />
    </div>

    <p class="text-xs text-on-surface-variant">
        {presets.find((preset) => preset.label === picked)?.hint ??
            'chọn một kiểu để xem nó lọc ra sao'}
        |
        <strong class="text-on-surface">{grid.preWindowNodes.length}</strong>
        / {rows.length} dòng còn lại
    </p>

    <Grid.FilterBuilder {grid} />

    <DataGrid {grid} toolbar class="h-110" />

    <div class="space-y-2">
        <h2 class="text-sm font-medium text-on-surface">Kiểu cột nào ra toán tử nào</h2>
        <div class="overflow-x-auto rounded-lg border border-outline-variant">
            <table class="w-full text-left text-xs">
                <thead class="bg-surface-container text-on-surface-variant">
                    <tr>
                        <th class="px-3 py-2 font-medium">Cột</th>
                        <th class="px-3 py-2 font-medium">type</th>
                        <th class="px-3 py-2 font-medium">filter khai báo</th>
                        <th class="px-3 py-2 font-medium">nhóm toán tử</th>
                        <th class="px-3 py-2 font-medium">toán tử được mời</th>
                        <th class="px-3 py-2 font-medium">ô nhập</th>
                    </tr>
                </thead>
                <tbody>
                    {#each reference as entry (entry.header + entry.type)}
                        <tr class="border-t border-outline-variant/60">
                            <td class="px-3 py-2 text-on-surface"
                                >{entry.header || '(không tên)'}</td
                            >
                            <td class="px-3 py-2"><code>{entry.type}</code></td>
                            <td class="px-3 py-2 text-on-surface-variant"
                                ><code>{entry.declared}</code></td
                            >
                            <td class="px-3 py-2">
                                {#if entry.offered}
                                    <Badge color="info" size="sm" label={entry.kind} />
                                {:else}
                                    <Badge color="surface" size="sm" label="-" />
                                {/if}
                            </td>
                            <td class="px-3 py-2 text-on-surface-variant">
                                {entry.ops.join(', ') || '-'}
                            </td>
                            <td class="px-3 py-2 text-on-surface-variant">{entry.editor}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
        </div>
        <p class="text-xs text-on-surface-variant">
            Hai dòng cuối là hai cách một cột <strong>không</strong> được mời vào bộ lọc:
            <code>filter: false</code> là lời từ chối rõ ràng của app, và
            <code>type: "actions"</code> thì không có giá trị nào để so - nó vẽ nút, không giữ dữ
            liệu. Mọi cột còn lại đều lọc được kể cả khi không khai báo <code>filter</code>, khác
            với bộ lọc theo cột của Community vốn đòi khai báo mới hiện.
        </p>
    </div>
</Container>
