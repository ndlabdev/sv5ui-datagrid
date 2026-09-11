<script lang="ts">
    import {
        Grid,
        createDataGrid,
        filtering,
        sorting,
        virtualization,
        type ColumnDef
    } from '$lib/index.js'
    import { Button, Container, Input, Link, ThemeModeButton } from 'sv5ui'
    import {
        conditionalFormatting,
        DataGrid,
        formula,
        getConditionalFormatting,
        type FormatRule
    } from '$lib/index.js'
    import { downloadGridXlsx } from '$lib/xlsx.js'

    interface Deal {
        id: number
        owner: string
        region: string
        status: string
        email: string
        unit: number
        qty: number
        total?: number
    }

    const owners = ['Ánh', 'Bảo', 'Chi', 'Dũng', 'Hà']
    const regions = ['Bắc', 'Trung', 'Nam']
    const statuses = ['đang mở', 'quá hạn', 'đã chốt']

    const rows: Deal[] = Array.from({ length: 80 }, (_, i) => ({
        id: i + 1,
        owner: owners[i % 5]!,
        region: regions[i % 3]!,
        status: statuses[i % 3]!,
        email: `${owners[i % 5]!.toLowerCase()}${i % 7}@vidu.vn`,
        unit: 200 + ((i * 137) % 4000),
        qty: 1 + (i % 9)
    }))

    const columns: ColumnDef<Deal>[] = [
        { id: 'owner', header: 'Phụ trách', width: 130, sortable: true, filter: 'text' },
        { id: 'region', header: 'Vùng', width: 110, sortable: true, type: 'badge' },
        { id: 'status', header: 'Trạng thái', width: 130, sortable: true, filter: 'text' },
        { id: 'email', header: 'Email', width: 190, sortable: true },
        { id: 'unit', header: 'Đơn giá', width: 130, align: 'right', type: 'currency' },
        { id: 'qty', header: 'SL', width: 90, align: 'right' },
        {
            id: 'total',
            header: 'Thành tiền',
            width: 150,
            align: 'right',
            sortable: true,
            filter: 'number'
        }
    ]

    const presets: [string, FormatRule][] = [
        ['Thang màu - Thành tiền', { kind: 'colorScale', id: 'scale', column: 'total' }],
        ['Thanh dữ liệu - Đơn giá', { kind: 'dataBar', id: 'bar', column: 'unit' }],
        ['Trùng email', { kind: 'duplicates', id: 'dupes', column: 'email' }],
        ['Top 5 thành tiền', { kind: 'topN', id: 'top', column: 'total', n: 5 }],
        [
            'Ba màu - Số lượng',
            {
                kind: 'colorScale',
                id: 'three',
                column: 'qty',
                from: 'var(--color-error)',
                via: 'transparent',
                to: 'var(--color-primary)'
            }
        ]
    ]

    let expression = $state('status = "quá hạn" AND total > 8000')
    let parseError = $state<string | null>(null)

    const grid = createDataGrid<Deal>({
        columns,
        data: rows,
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            filtering(),
            virtualization({ rowHeight: 40 }),
            formula<Deal>({ columns: { total: 'unit * qty' } }),
            conditionalFormatting<Deal>({
                rules: [presets[0]![1], presets[1]![1]],
                onParseError: (id, message, at) => {
                    parseError = `${id} @${at}: ${message}`
                }
            })
        ]
    })

    const formatting = $derived(getConditionalFormatting(grid))
    const rules = $derived(formatting?.rules ?? [])
    const activeIds = $derived(new Set(rules.map((rule) => rule.id)))

    function toggle(rule: FormatRule) {
        if (activeIds.has(rule.id)) grid.api.removeFormatRule?.(rule.id!)
        else grid.api.addFormatRule?.(rule)
    }

    function applyExpression() {
        parseError = null
        grid.api.removeFormatRule?.('expr')
        grid.api.addFormatRule?.({
            kind: 'expression',
            id: 'expr',
            when: expression,
            class: 'font-semibold text-error'
        })
    }

    const snapshot = $derived(JSON.stringify(rules, null, 2))
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Định dạng có điều kiện - bàn thử</h1>
            <p class="text-sm text-on-surface-variant">
                Luật là <em>dữ liệu</em>, không phải code: thang màu, thanh dữ liệu, trùng lặp, top
                N và biểu thức - tất cả đều serialize được nên đi thẳng vào saved view và link chia
                sẻ.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <Grid.FormatPanel {grid} />

    <section class="space-y-3">
        <h2 class="text-lg font-medium text-on-surface">Luật dựng sẵn</h2>
        <div class="flex flex-wrap gap-2">
            {#each presets as [label, rule] (rule.id)}
                <Button
                    size="sm"
                    variant={activeIds.has(rule.id) ? 'solid' : 'outline'}
                    {label}
                    aria-pressed={activeIds.has(rule.id)}
                    onclick={() => toggle(rule)}
                />
            {/each}
        </div>
    </section>

    <section class="space-y-3">
        <h2 class="text-lg font-medium text-on-surface">Luật theo biểu thức</h2>
        <div class="flex flex-wrap items-end gap-2">
            <label class="grow space-y-1">
                <span class="text-xs text-on-surface-variant">Điều kiện</span>
                <Input bind:value={expression} class="font-mono text-sm" />
            </label>
            <Button size="sm" variant="solid" label="Áp dụng" onclick={applyExpression} />
        </div>
        {#if parseError}
            <p class="text-xs text-error">{parseError}</p>
        {/if}
        <p class="text-xs text-on-surface-variant">
            Cùng parser với cột công thức - <strong>không</strong>
            <code>eval</code>. Biểu thức đọc được cả cột công thức
            <code>total</code>, thứ mà lưới khác tắt công thức khi đang group hoặc đang server.
        </p>
    </section>

    <div class="flex flex-wrap items-center gap-2">
        <Button
            size="sm"
            variant="outline"
            icon="lucide:download"
            label="Tải .xlsx"
            onclick={() => void downloadGridXlsx(grid, { filename: 'dinh-dang-co-dieu-kien' })}
        />
        <span class="text-xs text-on-surface-variant">
            File mang theo chính các luật này: mở bằng Excel rồi sửa một con số, Excel tự tính lại
            thang màu. Luật biểu thức không xuất được.
        </span>
    </div>

    <DataGrid {grid} class="h-[420px]" />

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Luật đang chạy, dưới dạng JSON</h2>
        <pre
            class="overflow-x-auto rounded-lg bg-surface-container p-3 text-xs text-on-surface-variant">{snapshot}</pre>
    </section>
</Container>
