<script lang="ts">
    import {
        Grid,
        columnOps,
        createDataGrid,
        filtering,
        sorting,
        type ColumnDef,
        type RowNode
    } from '$lib/index.js'
    import { Button, Container, Link, ThemeModeButton } from 'sv5ui'
    import { DataGrid, getShowValuesAs, grouping, showValuesAs, type ShowAs } from '$lib/index.js'

    interface Sale {
        id: number
        region: string
        rep: string
        q1: number
        q2: number
        q3: number
        q4: number
        year: number
    }

    const REGIONS = ['Bắc', 'Trung', 'Nam']
    const REPS = ['An', 'Bình', 'Chi', 'Dũng', 'Giang']

    const sales: Sale[] = Array.from({ length: 36 }, (_, i) => {
        const q1 = 12_000 + ((i * 977) % 9_000)
        const q2 = 9_000 + ((i * 613) % 14_000)
        const q3 = 15_000 + ((i * 431) % 11_000)
        const q4 = 8_000 + ((i * 787) % 17_000)

        return {
            id: i + 1,
            region: REGIONS[i % 3]!,
            rep: REPS[i % REPS.length]!,
            q1,
            q2,
            q3,
            q4,
            year: q1 + q2 + q3 + q4
        }
    })

    const QUARTERS = ['q1', 'q2', 'q3', 'q4']

    const MODES: { id: string; label: string; hint: string; showAs: ShowAs | null }[] = [
        {
            id: 'raw',
            label: 'Giá trị thật',
            hint: 'Số tiền như dữ liệu ghi.',
            showAs: null
        },
        {
            id: 'grand',
            label: '% tổng chung',
            hint: 'Mỗi ô chia cho tổng cả cột sau khi lọc. Cột cộng lại đúng 100%.',
            showAs: 'percentOfGrandTotal'
        },
        {
            id: 'parent',
            label: '% nhóm cha',
            hint: 'Hàng chia cho nhóm chứa nó, nhóm chia cho toàn bảng. Mỗi nhóm cộng lại 100%.',
            showAs: 'percentOfParent'
        },
        {
            id: 'row',
            label: '% theo hàng',
            hint: 'Bốn quý chia cho tổng năm của chính hàng đó - đọc ngang thay vì đọc dọc.',
            showAs: { kind: 'percentOfRow', of: QUARTERS }
        }
    ]

    let mode = $state('raw')
    const current = $derived(MODES.find((entry) => entry.id === mode)!)

    const asPercent = $derived(mode !== 'raw')

    function moneyOrShare(id: string): ColumnDef<Sale> {
        return {
            id,
            header: id === 'year' ? 'Cả năm' : id.toUpperCase(),
            width: 150,
            align: 'right',
            sortable: true,
            get type() {
                return asPercent ? ('percent' as const) : ('currency' as const)
            }
        }
    }

    const columns: ColumnDef<Sale>[] = [
        { id: 'region', header: 'Khu vực', width: 220, sortable: true, filter: 'text' },
        { id: 'rep', header: 'Nhân viên', width: 150, sortable: true, filter: 'text' },
        moneyOrShare('q1'),
        moneyOrShare('q2'),
        moneyOrShare('q3'),
        moneyOrShare('q4'),
        moneyOrShare('year')
    ]

    const grid = createDataGrid<Sale>({
        columns,
        data: sales,
        getRowId: (row) => String(row.id),
        features: [
            filtering(),
            sorting(),
            columnOps(),
            grouping<Sale>({
                by: ['region'],
                grandTotal: true,
                aggregations: {
                    q1: 'sum',
                    q2: 'sum',
                    q3: 'sum',
                    q4: 'sum',
                    year: 'sum'
                }
            }),
            showValuesAs<Sale>()
        ]
    })

    const shares = getShowValuesAs(grid)!

    interface Check {
        label: string
        detail: string
        ok: boolean
    }

    const ROUNDING = 1e-9

    const isWhole = (value: number) => Math.abs(value - 1) < ROUNDING
    const numberOf = (value: unknown) => (typeof value === 'number' ? value : null)
    const yearOf = (node: RowNode<Sale>) => numberOf(node.row.year) ?? 0

    const groupNodes = $derived(grid.preWindowNodes.filter((node) => node.id.startsWith('group:')))
    const leafNodes = $derived(
        grid.preWindowNodes.filter(
            (node) => !node.id.startsWith('group:') && node.id !== 'total:grand'
        )
    )

    function childrenSum(group: RowNode<Sale>): number {
        const nodes = grid.preWindowNodes
        const level = group.meta?.level ?? 0
        let sum = 0
        for (let at = nodes.indexOf(group) + 1; at < nodes.length; at++) {
            const node = nodes[at]!
            const nodeLevel = node.meta?.level ?? 0
            if (nodeLevel <= level) break
            if (nodeLevel === level + 1) sum += yearOf(node)
        }
        return sum
    }

    function rawChecks(): Check[] {
        const first = numberOf(leafNodes[0]?.row.year)
        return [
            {
                label: 'Đang là số tiền, chưa phải tỉ lệ',
                detail: `hàng đầu: ${first ?? '-'}`,
                ok: first !== null && first > 1
            }
        ]
    }

    function grandChecks(): Check[] {
        const sum = leafNodes.reduce((total, node) => total + yearOf(node), 0)
        return [
            {
                label: 'Cộng cả cột Cả năm lại bằng 100%',
                detail: `${(sum * 100).toFixed(4)}%`,
                ok: isWhole(sum)
            }
        ]
    }

    function parentChecks(): Check[] {
        const perGroup = groupNodes.map(childrenSum)
        const top = groupNodes.filter((group) => (group.meta?.level ?? 0) === 0)
        const topSum = top.reduce((total, group) => total + yearOf(group), 0)

        return [
            {
                label: 'Mỗi nhóm: các hàng ngay dưới nó cộng lại 100%',
                detail: perGroup.map((sum) => `${(sum * 100).toFixed(2)}%`).join(' | '),
                ok: perGroup.every(isWhole)
            },
            {
                label: 'Các nhóm tầng ngoài cùng cộng lại cũng 100%',
                detail: `${(topSum * 100).toFixed(4)}% trên ${groupNodes.length} nhóm, ${top.length} ở tầng ngoài`,
                ok: isWhole(topSum)
            }
        ]
    }

    function rowChecks(): Check[] {
        const rowSums = leafNodes.map((node) =>
            QUARTERS.reduce(
                (total, columnId) =>
                    total +
                    (numberOf((node.row as unknown as Record<string, unknown>)[columnId]) ?? 0),
                0
            )
        )
        const years = leafNodes.map((node) => numberOf(node.row.year))
        const whole = years.filter((year) => year !== null && isWhole(year)).length

        return [
            {
                label: 'Mỗi hàng: bốn quý cộng lại 100%',
                detail: `${rowSums.length} hàng, lệch lớn nhất ${(
                    Math.max(...rowSums.map((sum) => Math.abs(sum - 1))) * 100
                ).toFixed(6)}%`,
                ok: rowSums.every(isWhole)
            },
            {
                label: 'Cột Cả năm là mẫu số của chính nó, nên bằng 100%',
                detail: `${whole}/${years.length} hàng`,
                ok: whole === years.length
            }
        ]
    }

    const checks = $derived.by<Check[]>(() => {
        if (mode === 'raw') return rawChecks()
        if (mode === 'grand') return grandChecks()
        if (mode === 'parent') return parentChecks()
        return rowChecks()
    })

    const allPass = $derived(checks.every((check) => check.ok))

    function pick(id: string): void {
        mode = id
        const chosen = MODES.find((entry) => entry.id === id)!
        const columnIds = chosen.showAs === null ? [] : [...QUARTERS, 'year']

        shares.clear()
        for (const columnId of columnIds) {
            if (chosen.showAs !== null) shares.set(columnId, chosen.showAs)
        }
    }
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Show values as - bàn thử</h1>
            <p class="text-sm text-on-surface-variant">
                Cùng một bảng, bốn cách đọc. Phần trăm là <strong>giá trị của ô</strong>, không phải
                lớp sơn: sắp xếp, copy và xuất file đều thấy đúng cái đang hiện.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Cách hiển thị</h2>
        <div class="flex flex-wrap items-center gap-2">
            {#each MODES as entry (entry.id)}
                <Button
                    size="sm"
                    variant={mode === entry.id ? 'solid' : 'outline'}
                    label={entry.label}
                    aria-pressed={mode === entry.id}
                    onclick={() => pick(entry.id)}
                />
            {/each}
        </div>
        <p class="text-sm text-on-surface-variant">{current.hint}</p>
    </section>

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Tự kiểm chứng</h2>
        <p class="text-sm text-on-surface-variant">
            Đọc thẳng từ lưới đang hiện, tính lại bằng tay và so. Lọc hay đổi nhóm thì mấy dòng này
            phải vẫn xanh - nếu đỏ là tính sai thật, không phải do mắt nhìn.
        </p>
        <ul data-demo="checks" class="space-y-1 text-sm">
            {#each checks as check (check.label)}
                <li class="flex flex-wrap items-baseline gap-2">
                    <span class={check.ok ? 'text-success' : 'text-error'}>
                        {check.ok ? '✓' : '✗'}
                    </span>
                    <span class="text-on-surface">{check.label}</span>
                    <span class="font-mono text-xs text-on-surface-variant">{check.detail}</span>
                </li>
            {/each}
        </ul>
        <p data-demo="verdict" class="text-xs text-on-surface-variant">
            {allPass ? 'Tất cả khớp.' : 'Có dòng không khớp - xem chi tiết ở trên.'}
        </p>
    </section>

    <Grid.GroupPanel {grid} />

    <DataGrid {grid} toolbar />

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Cần thử những gì</h2>
        <ol
            class="list-inside list-decimal space-y-1 text-sm text-on-surface-variant marker:text-on-surface"
        >
            <li>
                <strong>% nhóm cha</strong>: cộng các hàng trong một khu vực → đúng 100%; cộng ba
                khu vực → cũng 100%
            </li>
            <li>
                <strong>% theo hàng</strong>: cộng Q1..Q4 trên một hàng → 100%; cột
                <strong>Cả năm</strong> thành 100% ở mọi hàng, vì nó chính là mẫu số
            </li>
            <li>
                Lọc bớt một khu vực → mọi phần trăm tính lại theo phần còn lại, không theo bản gốc
            </li>
            <li>
                Sắp xếp theo Q3 khi đang ở chế độ phần trăm → thứ tự theo tỉ trọng, không theo tiền
            </li>
            <li>Copy một vùng rồi dán sang bảng tính → nhận đúng phần trăm đang nhìn thấy</li>
            <li>
                Kéo <strong>Nhân viên</strong> vào GroupPanel → nhóm hai tầng, % nhóm cha đo theo tầng
                ngay trên nó
            </li>
        </ol>
        <p class="text-xs text-on-surface-variant">
            Tỉ lệ là phân số (0,34) chứ không phải 34, nên cột phải khai <code>type: 'percent'</code
            >
            - route này đổi kiểu cột theo chế độ để thấy rõ.
        </p>
    </section>
</Container>
