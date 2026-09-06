<script lang="ts">
    import {
        Grid,
        columnOps,
        createDataGrid,
        filtering,
        sorting,
        virtualization,
        type ColumnDef
    } from '$lib/index.js'
    import { Button, Container, Link, Textarea, ThemeModeButton } from 'sv5ui'
    import { advancedFilter, DataGrid, getAdvancedFilter, type FilterGroup } from '$lib/index.js'

    interface Sale {
        id: number
        region: string
        rep: string
        status: string
        total: number
        closedAt: string
    }

    const regions = ['Bắc', 'Trung', 'Nam']
    const reps = ['An', 'Bình', 'Chi', 'Dũng']
    const statuses = ['mới', 'đang xử lý', 'đã chốt', 'huỷ']

    const rows: Sale[] = Array.from({ length: 120 }, (_, i) => ({
        id: i + 1,
        region: regions[i % 3]!,
        rep: reps[i % 4]!,
        status: statuses[i % 4]!,
        total: 200 + ((i * 137) % 9_500),
        closedAt: new Date(Date.UTC(2026, i % 12, (i % 27) + 1)).toISOString().slice(0, 10)
    }))

    const columns: ColumnDef<Sale>[] = [
        { id: 'id', header: '#', width: 80, align: 'right' },
        { id: 'region', header: 'Vùng', width: 120, type: 'badge', filter: 'set' },
        { id: 'rep', header: 'Phụ trách', width: 140, filter: 'text' },
        { id: 'status', header: 'Trạng thái', width: 150, filter: 'set' },
        {
            id: 'total',
            header: 'Giá trị',
            width: 140,
            align: 'right',
            type: 'currency',
            filter: 'number'
        },
        { id: 'closedAt', header: 'Ngày chốt', width: 150, type: 'date', filter: 'date' }
    ]

    const presets: { label: string; hint: string; model: FilterGroup }[] = [
        {
            label: '(Bắc VÀ ≥ 5000) HOẶC Chi',
            hint: 'đúng câu mà mô hình lọc theo từng cột không viết được',
            model: {
                kind: 'group',
                join: 'or',
                children: [
                    {
                        kind: 'group',
                        join: 'and',
                        children: [
                            { kind: 'condition', columnId: 'region', op: 'equals', value: 'Bắc' },
                            { kind: 'condition', columnId: 'total', op: 'gte', value: 5000 }
                        ]
                    },
                    { kind: 'condition', columnId: 'rep', op: 'equals', value: 'Chi' }
                ]
            }
        },
        {
            label: 'KHÔNG (huỷ HOẶC mới)',
            hint: 'phủ định cả một nhóm bằng cờ not',
            model: {
                kind: 'group',
                join: 'or',
                not: true,
                children: [
                    { kind: 'condition', columnId: 'status', op: 'equals', value: 'huỷ' },
                    { kind: 'condition', columnId: 'status', op: 'equals', value: 'mới' }
                ]
            }
        },
        {
            label: 'Chốt trong quý I/2026',
            hint: 'between trên ngày, so theo ngày lịch nên vẫn giữ trọn ngày cuối',
            model: {
                kind: 'group',
                join: 'and',
                children: [
                    {
                        kind: 'condition',
                        columnId: 'closedAt',
                        op: 'between',
                        value: '2026-01-01',
                        to: '2026-03-31'
                    }
                ]
            }
        },
        {
            label: 'Phụ trách thuộc danh sách',
            hint: 'in nhận cả mảng giá trị',
            model: {
                kind: 'group',
                join: 'and',
                children: [{ kind: 'condition', columnId: 'rep', op: 'in', values: ['An', 'Dũng'] }]
            }
        }
    ]

    const grid = createDataGrid<Sale>({
        columns,
        data: rows,
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            filtering(),
            columnOps(),
            advancedFilter<Sale>(),
            virtualization({ rowHeight: 40, overscan: 8 })
        ]
    })

    const filterState = getAdvancedFilter(grid)!

    let source = $state(JSON.stringify(presets[0]!.model, null, 2))
    let mirrored = $state(JSON.stringify(filterState.model))
    let picked = $state<string | null>(null)
    let error = $state('')

    $effect(() => {
        const current = JSON.stringify(filterState.model)
        if (current === mirrored) return
        mirrored = current
        source = JSON.stringify(filterState.model, null, 2)
    })

    function pick(preset: (typeof presets)[number]) {
        filterState.setModel(preset.model)
        source = JSON.stringify(preset.model, null, 2)
        picked = preset.label
        error = ''
    }

    function apply() {
        try {
            filterState.setModel(JSON.parse(source) as FilterGroup)
            picked = null
            error = ''
        } catch (cause) {
            error = cause instanceof Error ? cause.message : String(cause)
        }
    }

    function clear() {
        filterState.clear()
        source = JSON.stringify(filterState.model, null, 2)
        picked = null
        error = ''
    }
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Lọc nâng cao - @sv5ui/datagrid</h1>
            <p class="text-sm text-on-surface-variant">
                Lọc theo từng cột của Community là một map <code>cột → điều kiện</code>, nên mọi cột
                luôn nối bằng VÀ. <code>advancedFilter()</code> mang một <strong>cây</strong>: nhóm
                lồng nhau, VÀ / HOẶC, phủ định cả nhóm.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/">← Grouping</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium text-on-surface">Thử:</span>
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
        {presets.find((preset) => preset.label === picked)?.hint ?? 'cây do anh tự sửa bên dưới'} |
        <strong class="text-on-surface">{grid.preWindowNodes.length}</strong>
        / {rows.length} dòng còn lại | {filterState.activeCount} / {filterState.conditionCount} điều kiện
        đang lọc
    </p>

    <Grid.FilterBuilder {grid} />

    <DataGrid {grid} toolbar class="h-120" />

    <div class="grid gap-4 lg:grid-cols-2">
        <div class="space-y-2">
            <h2 class="text-sm font-medium text-on-surface">Cây lọc dạng JSON (sửa được)</h2>
            <Textarea bind:value={source} rows={14} class="font-mono text-xs" aria-label="JSON" />
            <div class="flex items-center gap-2">
                <Button size="sm" label="Áp dụng" onclick={apply} />
                {#if error}
                    <span class="text-xs text-error">{error}</span>
                {/if}
            </div>
        </div>

        <div class="space-y-2">
            <h2 class="text-sm font-medium text-on-surface">Vì sao cần cây</h2>
            <p class="text-xs text-on-surface-variant">
                Mô hình của Community lưu <code>columns: Record&lt;columnId, entry&gt;</code>. Một
                cột có thể có hai điều kiện nối VÀ/HOẶC, nhưng giữa các cột thì luôn là VÀ. Câu
                <em>"vùng Bắc mà giá trị lớn, hoặc bất kỳ đơn nào của Chi"</em> vì thế không viết được:
                nó cần HOẶC ở cấp trên cùng, ôm một nhóm VÀ bên trong.
            </p>
            <p class="text-xs text-on-surface-variant">
                Feature này chạy ở <code>PIPELINE_ORDER.filter + 1</code>, tức là
                <strong>sau</strong> bộ lọc của Community chứ không thay thế: gõ vào ô tìm nhanh rồi áp
                cây thì hai thứ cùng thu hẹp. Nó chạy trước grouping, nên hàng nhóm đếm đúng phần còn
                lại. Cây là JSON thuần nên đi thẳng vào saved view, và app gửi nó cho server cũng được.
            </p>
            <p class="text-xs text-on-surface-variant">
                Bảng <strong>Bộ lọc</strong> phía trên dựng cây bằng chuột: thêm điều kiện, thêm
                nhóm lồng, đổi VÀ/HOẶC, phủ định cả nhóm. Ô JSON ở đây là cùng một cây - sửa bên nào
                thì bên kia đổi theo, vì cả hai đọc ghi cùng một
                <code>advancedFilter()</code>. Mười sáu toán tử đã dịch cho mười hai ngôn ngữ.
            </p>
        </div>
    </div>
</Container>
