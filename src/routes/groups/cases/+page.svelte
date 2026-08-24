<script lang="ts">
    import { Button, Container, Link, ThemeModeButton } from 'sv5ui'
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        rowPinning,
        rowsToMatrix,
        sorting,
        virtualization,
        type ColumnDef,
        type GridSnapshot,
        type GridState
    } from '$lib/index.js'
    import CaseCard from './CaseCard.svelte'

    interface Row {
        id: number
        region: string
        rep: string
        q1: number
        q2: number
        q3: number
        q4: number
        plan: number
        gap: number
    }

    const regions = ['Miền Bắc', 'Miền Trung', 'Miền Nam', 'Tây Nguyên', 'Đông Nam Bộ']
    const reps = ['An', 'Bình', 'Cường', 'Dung', 'Én']

    function makeRows(count: number): Row[] {
        return Array.from({ length: count }, (_, i) => {
            const q1 = 40 + ((i * 13) % 60)
            const q2 = 35 + ((i * 29) % 70)
            const q3 = 50 + ((i * 7) % 55)
            const q4 = 45 + ((i * 17) % 65)
            const plan = 200 + ((i * 11) % 60)
            return {
                id: i + 1,
                region: regions[i % 5],
                rep: `${reps[i % 5]} ${i + 1}`,
                q1,
                q2,
                q3,
                q4,
                plan,
                gap: q1 + q2 + q3 + q4 - plan
            }
        })
    }

    const rows = makeRows(24)

    /** Mọi lưới ở đây đều cần nút gập, nên gom lại một chỗ. */
    function gridOf(columns: ColumnDef<Row>[], data: Row[] = rows, extra: unknown[] = []) {
        return createDataGrid<Row>({
            data,
            columns,
            getRowId: (row) => String(row.id),
            features: [columnOps(), sorting(), ...(extra as never[])]
        })
    }

    const num = { align: 'right', minWidth: 70 } as const

    // 1. Bốn tầng nhóm, tầng nào cũng có bản tóm tắt của riêng nó.
    const deep: GridState<Row> = gridOf([
        { id: 'id', header: '#', width: 56, align: 'right' },
        { id: 'region', header: 'Vùng', flex: 2, minWidth: 110 },
        {
            id: 'all',
            header: 'Toàn bộ',
            children: [
                { id: 'gap', header: 'Chênh lệch', columnGroupShow: 'closed', ...num },
                {
                    id: 'rev',
                    header: 'Doanh thu',
                    columnGroupShow: 'open',
                    children: [
                        { id: 'plan', header: 'Chỉ tiêu', columnGroupShow: 'closed', ...num },
                        {
                            id: 'firstHalf',
                            header: 'Nửa đầu',
                            columnGroupShow: 'open',
                            children: [
                                { id: 'q1', header: 'Q1', columnGroupShow: 'open', ...num },
                                { id: 'q2', header: 'Q2', columnGroupShow: 'open', ...num }
                            ]
                        },
                        {
                            id: 'secondHalf',
                            header: 'Nửa sau',
                            columnGroupShow: 'open',
                            children: [
                                { id: 'q3', header: 'Q3', columnGroupShow: 'open', ...num },
                                { id: 'q4', header: 'Q4', columnGroupShow: 'open', ...num }
                            ]
                        }
                    ]
                }
            ]
        }
    ])

    // 2. Một dải nằm trong lòng một nhóm lớn hơn.
    const railInside: GridState<Row> = gridOf([
        { id: 'id', header: '#', width: 56, align: 'right' },
        {
            id: 'block',
            header: 'Khối kế hoạch',
            children: [
                { id: 'rep', header: 'Phụ trách', flex: 2, minWidth: 120 },
                {
                    id: 'planning',
                    header: 'Kế hoạch',
                    collapseMode: 'rail',
                    children: [
                        { id: 'plan', header: 'Chỉ tiêu', ...num },
                        { id: 'gap', header: 'Chênh lệch', ...num }
                    ]
                }
            ]
        },
        { id: 'q1', header: 'Q1', ...num },
        { id: 'q2', header: 'Q2', ...num }
    ])

    // 3. Hai dải đứng cạnh nhau, mỗi dải một cửa.
    const twoRails: GridState<Row> = gridOf([
        { id: 'id', header: '#', width: 56, align: 'right' },
        { id: 'region', header: 'Vùng', flex: 2, minWidth: 110 },
        {
            id: 'planning',
            header: 'Kế hoạch',
            collapseMode: 'rail',
            children: [
                { id: 'plan', header: 'Chỉ tiêu', ...num },
                { id: 'gap', header: 'Chênh lệch', ...num }
            ]
        },
        {
            id: 'firstHalf',
            header: 'Nửa đầu',
            collapseMode: 'rail',
            children: [
                { id: 'q1', header: 'Q1', ...num },
                { id: 'q2', header: 'Q2', ...num }
            ]
        },
        { id: 'q3', header: 'Q3', ...num },
        { id: 'q4', header: 'Q4', ...num }
    ])

    // 4. Dải của nhóm ghim, ở cả hai mép, với phần giữa đủ rộng để phải cuộn.
    // Cột chữ để ở cuối phần cuộn: cột bị cắt dở ở mép luôn là cột chữ, đọc
    // được từ bên trái, chứ không phải một cột số căn phải trông như ô rỗng.
    const pinnedRails: GridState<Row> = gridOf([
        { id: 'id', header: '#', width: 56, align: 'right', pinned: 'left' },
        {
            id: 'planning',
            header: 'Kế hoạch',
            collapseMode: 'rail',
            children: [
                { id: 'plan', header: 'Chỉ tiêu', width: 120, align: 'right', pinned: 'left' },
                { id: 'gap', header: 'Chênh lệch', width: 130, align: 'right', pinned: 'left' }
            ]
        },
        { id: 'q1', header: 'Q1', width: 160, align: 'right' },
        { id: 'rep', header: 'Phụ trách', width: 480 },
        { id: 'region', header: 'Vùng', width: 480 },
        {
            id: 'secondHalf',
            header: 'Nửa sau',
            collapseMode: 'rail',
            children: [
                { id: 'q3', header: 'Q3', width: 120, align: 'right', pinned: 'right' },
                { id: 'q4', header: 'Q4', width: 120, align: 'right', pinned: 'right' }
            ]
        }
    ])

    // 5. Dải chạy qua cả hàng ghim trên và hàng ghim dưới.
    const withPinnedRows: GridState<Row> = gridOf(
        [
            { id: 'id', header: '#', width: 56, align: 'right' },
            { id: 'rep', header: 'Phụ trách', flex: 2, minWidth: 120 },
            {
                id: 'planning',
                header: 'Kế hoạch',
                collapseMode: 'rail',
                children: [
                    { id: 'plan', header: 'Chỉ tiêu', ...num },
                    { id: 'gap', header: 'Chênh lệch', ...num }
                ]
            },
            { id: 'q1', header: 'Q1', ...num },
            { id: 'q2', header: 'Q2', ...num }
        ],
        rows,
        [
            rowPinning<Row>({
                isRowPinned: (row) => (row.id === 1 ? 'top' : row.id === 3 ? 'bottom' : null)
            })
        ]
    )

    // 6. Dải khi cả hàng lẫn cột đều được ảo hoá.
    const manyRows = makeRows(400)
    const virtualRail: GridState<Row> = gridOf(
        [
            { id: 'id', header: '#', width: 70, align: 'right' },
            {
                id: 'planning',
                header: 'Kế hoạch',
                collapseMode: 'rail',
                children: [
                    { id: 'plan', header: 'Chỉ tiêu', width: 140, align: 'right' },
                    { id: 'gap', header: 'Chênh lệch', width: 140, align: 'right' }
                ]
            },
            { id: 'q1', header: 'Q1', width: 150, align: 'right' },
            { id: 'q2', header: 'Q2', width: 150, align: 'right' },
            { id: 'q3', header: 'Q3', width: 150, align: 'right' },
            { id: 'q4', header: 'Q4', width: 150, align: 'right' },
            // Chữ ở cuối, vì đây là lưới phải cuộn ngang: cột bị cắt dở ở mép
            // phải đọc được từ bên trái.
            { id: 'rep', header: 'Phụ trách', width: 260 },
            { id: 'region', header: 'Vùng', width: 260 }
        ],
        manyRows,
        [virtualization<Row>({ rowHeight: 40, columns: true })]
    )

    // 7. Nhóm mà không cột nào chịu nhường chỗ: gập là mất sạch, nên không gập.
    const cannotFold: GridState<Row> = gridOf([
        { id: 'id', header: '#', width: 56, align: 'right' },
        {
            id: 'rev',
            header: 'Doanh thu',
            children: [
                { id: 'q1', header: 'Q1', columnGroupShow: 'open', ...num },
                { id: 'q2', header: 'Q2', columnGroupShow: 'open', ...num }
            ]
        },
        {
            id: 'plans',
            header: 'Kế hoạch',
            children: [
                { id: 'plan', header: 'Chỉ tiêu', ...num },
                { id: 'gap', header: 'Chênh lệch', ...num }
            ]
        }
    ])

    // 8. Gập sẵn từ lúc khai, và một vòng lưu rồi khôi phục.
    const preFolded: GridState<Row> = gridOf([
        { id: 'id', header: '#', width: 56, align: 'right' },
        { id: 'region', header: 'Vùng', flex: 2, minWidth: 110 },
        {
            id: 'rev',
            header: 'Doanh thu',
            collapsed: true,
            children: [
                { id: 'q4', header: 'Cả năm', columnGroupShow: 'closed', ...num },
                { id: 'q1', header: 'Q1', columnGroupShow: 'open', ...num },
                { id: 'q2', header: 'Q2', columnGroupShow: 'open', ...num }
            ]
        },
        {
            id: 'planning',
            header: 'Kế hoạch',
            collapseMode: 'rail',
            collapsed: true,
            children: [
                { id: 'plan', header: 'Chỉ tiêu', ...num },
                { id: 'gap', header: 'Chênh lệch', ...num }
            ]
        }
    ])
    let saved = $state<GridSnapshot | null>(null)

    // 9. Cũng chừng ấy thứ, đọc từ phải sang trái.
    const rtl: GridState<Row> = gridOf([
        { id: 'id', header: '#', width: 56, align: 'right' },
        { id: 'region', header: 'Vùng', flex: 2, minWidth: 110 },
        {
            id: 'planning',
            header: 'Kế hoạch',
            collapseMode: 'rail',
            children: [
                { id: 'plan', header: 'Chỉ tiêu', ...num },
                { id: 'gap', header: 'Chênh lệch', ...num }
            ]
        },
        { id: 'q1', header: 'Q1', ...num }
    ])

    // 10. Dữ liệu rời khỏi lưới trong lúc đang gập.
    const exporting: GridState<Row> = gridOf([
        { id: 'id', header: '#', width: 56, align: 'right' },
        { id: 'rep', header: 'Phụ trách', flex: 2, minWidth: 120 },
        {
            id: 'planning',
            header: 'Kế hoạch',
            collapseMode: 'rail',
            children: [
                { id: 'plan', header: 'Chỉ tiêu', ...num },
                { id: 'gap', header: 'Chênh lệch', ...num }
            ]
        },
        {
            id: 'rev',
            header: 'Doanh thu',
            children: [
                { id: 'q4', header: 'Cả năm', columnGroupShow: 'closed', ...num },
                { id: 'q1', header: 'Q1', columnGroupShow: 'open', ...num },
                { id: 'q2', header: 'Q2', columnGroupShow: 'open', ...num }
            ]
        }
    ])
    let exported = $state<string>('chưa xuất')

    function exportNow() {
        const matrix = rowsToMatrix(exporting.nodes.slice(0, 1), exporting.columns.visible)
        exported = `${exporting.columns.visible.map((column) => column.id).join(' | ')}  =>  ${matrix[0]?.join(' | ')}`
    }

    /** Nhóm nào đang gập, đọc thẳng từ lưới chứ không giữ bản sao. */
    function folded(grid: GridState<Row>, ...ids: string[]): string {
        const shut = ids.filter((id) => grid.columns.isCollapsed(id))
        return shut.length === 0 ? 'đang mở hết' : `đang gập: ${shut.join(', ')}`
    }

    const deepState = $derived(folded(deep, 'all', 'rev', 'firstHalf', 'secondHalf'))
    const railInsideState = $derived(folded(railInside, 'block', 'planning'))
    const twoRailsState = $derived(folded(twoRails, 'planning', 'firstHalf'))
    const pinnedState = $derived(folded(pinnedRails, 'planning', 'secondHalf'))
    const pinnedRowsState = $derived(folded(withPinnedRows, 'planning'))
    const virtualState = $derived(folded(virtualRail, 'planning'))
    const cannotFoldState = $derived(folded(cannotFold, 'rev', 'plans'))
    const preFoldedState = $derived(folded(preFolded, 'rev', 'planning'))
    const rtlState = $derived(folded(rtl, 'planning'))
    const exportState = $derived(folded(exporting, 'planning', 'rev'))
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">
                Nhóm header gập được: các trường hợp
            </h1>
            <p class="max-w-3xl text-sm text-on-surface-variant">
                Mười trường hợp để nghiệm thu, mỗi thẻ nói rõ cần nhìn thấy gì. Ô chữ nhỏ bên phải
                mỗi tiêu đề là trạng thái thật của lưới đó, đọc thẳng từ
                <code>columns.isCollapsed()</code>, nên nó và những gì bạn thấy phải khớp nhau.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/groups">← Nhóm header</Link>
            <ThemeModeButton />
        </div>
    </div>

    <CaseCard
        index={1}
        title="Bốn tầng nhóm, tầng nào cũng gập được"
        expects="Mỗi tầng có nút gập của riêng nó. Gập tầng ngoài kéo theo tầng trong; mở ra thì tầng trong trở lại đúng trạng thái bạn để nó, chứ không bung hết."
        state={deepState}
    >
        <DataGrid grid={deep} />
    </CaseCard>

    <CaseCard
        index={2}
        title="Dải nằm trong lòng một nhóm lớn hơn"
        expects="Gập Kế hoạch thành dải thì nhóm cha Khối kế hoạch vẫn còn header của nó và co lại vừa đúng phần còn lại. Dải chạy suốt chiều cao, kể cả qua tầng header của nhóm cha."
        state={railInsideState}
    >
        <DataGrid grid={railInside} />
    </CaseCard>

    <CaseCard
        index={3}
        title="Hai dải đứng cạnh nhau"
        expects="Hai dải riêng biệt, mỗi dải mở lại đúng nhóm của nó, và giữa hai dải có đúng một đường kẻ chứ không phải hai."
        state={twoRailsState}
    >
        <DataGrid grid={twoRails} />
    </CaseCard>

    <CaseCard
        index={4}
        title="Dải của nhóm ghim, hai mép, khi cuộn ngang"
        expects="Lưới này rộng hơn khung nên phải cuộn ngang. Gập cả hai nhóm rồi cuộn: dải bên trái và dải bên phải đứng yên cùng với cột ghim của chúng, không trôi theo phần giữa."
        state={pinnedState}
    >
        <DataGrid grid={pinnedRails} />
    </CaseCard>

    <CaseCard
        index={5}
        title="Dải chạy qua hàng ghim trên và dưới"
        expects="Hàng 1 ghim trên, hàng 3 ghim dưới. Gập Kế hoạch: nền dải liền một mạch qua cả hai hàng ghim, và hai hàng đó cũng không còn dữ liệu của nhóm đã gập."
        state={pinnedRowsState}
    >
        <DataGrid grid={withPinnedRows} />
    </CaseCard>

    <CaseCard
        index={6}
        title="Dải khi hàng và cột đều được ảo hoá"
        expects="400 dòng và lưới rộng hơn khung. Cuộn dọc: tên nhóm đứng yên ở trên cùng. Cuộn ngang: dải biến mất và hiện lại đúng chỗ của nó, không lệch một pixel nào so với cột."
        state={virtualState}
    >
        <DataGrid grid={virtualRail} class="h-72" />
    </CaseCard>

    <CaseCard
        index={7}
        title="Nhóm không có gì để gập vào"
        expects="Doanh thu có hai cột đều khai 'open', gập là mất sạch, nên nó không có nút gập. Kế hoạch không khai gì nên cũng không có. Cả hai vẫn là header nhóm bình thường."
        state={cannotFoldState}
    >
        <DataGrid grid={cannotFold} />
    </CaseCard>

    <CaseCard
        index={8}
        title="Gập sẵn từ lúc khai, và một vòng lưu rồi khôi phục"
        expects="Lưới mở ra đã gập sẵn cả hai nhóm. Mở chúng ra, bấm Lưu, gập lại, rồi bấm Khôi phục: lưới trở lại đúng trạng thái lúc lưu."
        state={preFoldedState}
    >
        <div class="mb-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onclick={() => (saved = preFolded.getState())}>
                Lưu
            </Button>
            <Button
                size="sm"
                variant="outline"
                disabled={!saved}
                onclick={() => saved && preFolded.setState(saved)}
            >
                Khôi phục
            </Button>
            <span class="text-xs text-on-surface-variant">
                {saved
                    ? `đã lưu: ${JSON.stringify(saved.columns?.collapsed ?? {})}`
                    : 'chưa lưu gì'}
            </span>
        </div>
        <DataGrid grid={preFolded} />
    </CaseCard>

    <CaseCard
        index={9}
        title="Đọc từ phải sang trái"
        expects="Cột chạy từ phải sang trái, dải nằm đúng vị trí của nhóm nó thay thế, và chữ dọc vẫn đọc được theo chiều của nó."
        state={rtlState}
    >
        <div dir="rtl">
            <DataGrid grid={rtl} />
        </div>
    </CaseCard>

    <CaseCard
        index={10}
        title="Dữ liệu rời khỏi lưới trong lúc đang gập"
        expects="Gập cả hai nhóm rồi bấm Xuất: kết quả không có cột dải, chỉ có những cột đang thật sự mang dữ liệu."
        state={exportState}
    >
        <div class="mb-3 flex flex-wrap items-center gap-2">
            <Button size="sm" variant="outline" onclick={exportNow}>Xuất một dòng</Button>
            <code class="text-xs text-on-surface-variant">{exported}</code>
        </div>
        <DataGrid grid={exporting} />
    </CaseCard>
</Container>
