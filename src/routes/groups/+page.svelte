<script lang="ts">
    import { Badge, Card, Container, Kbd, Link, ThemeModeButton } from 'sv5ui'
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        sorting,
        type ColumnDef,
        type GridState,
        type HeaderGroupContext
    } from '$lib/index.js'

    interface Region {
        id: number
        region: string
        rep: string
        q1: number
        q2: number
        q3: number
        q4: number
        h1: number
        h2: number
        plan: number
        gap: number
        actual: number
    }

    const regions = ['Miền Bắc', 'Miền Trung', 'Miền Nam', 'Tây Nguyên', 'Đông Nam Bộ']
    const reps = ['An', 'Bình', 'Cường', 'Dung', 'Én']

    const rows: Region[] = Array.from({ length: 40 }, (_, i) => {
        const q1 = 40 + ((i * 13) % 60)
        const q2 = 35 + ((i * 29) % 70)
        const q3 = 50 + ((i * 7) % 55)
        const q4 = 45 + ((i * 17) % 65)
        return {
            id: i + 1,
            region: regions[i % 5],
            rep: `${reps[i % 5]} ${i + 1}`,
            q1,
            q2,
            q3,
            q4,
            h1: q1 + q2,
            h2: q3 + q4,
            plan: 200 + ((i * 11) % 60),
            gap: q1 + q2 + q3 + q4 - (200 + ((i * 11) % 60)),
            actual: q1 + q2 + q3 + q4
        }
    })

    /**
     * Three groups, each folding a different way:
     * - Doanh thu: quý là chi tiết, cả năm là bản tóm tắt
     * - Kế hoạch: chỉ có chi tiết, nên gập là mất sạch, và lưới không cho gập
     * - Định danh: không khai gì, nên không có nút
     */
    const columns: ColumnDef<Region>[] = [
        {
            id: 'identity',
            header: 'Định danh',
            children: [
                { id: 'id', header: '#', width: 70, align: 'right', sortable: true },
                {
                    id: 'region',
                    header: 'Vùng',
                    flex: 2,
                    minWidth: 120,
                    sortable: true,
                    cell: regionCell
                },
                { id: 'rep', header: 'Phụ trách', flex: 2, minWidth: 120, sortable: true }
            ]
        },
        {
            id: 'revenue',
            header: 'Doanh thu',
            headerGroupCell: revenueHeader,
            children: [
                {
                    id: 'actual',
                    header: 'Cả năm',
                    columnGroupShow: 'closed',
                    // Room enough that the group above it still reads when
                    // everything below folds away into it.
                    flex: 2,
                    minWidth: 140,
                    align: 'right',
                    sortable: true
                },
                // Two nested groups, each folding on its own account, and both
                // folding away when the group over them does.
                {
                    id: 'first-half',
                    header: 'Nửa đầu',
                    columnGroupShow: 'open',
                    children: [
                        {
                            id: 'h1',
                            header: 'H1',
                            columnGroupShow: 'closed',
                            minWidth: 90,
                            align: 'right'
                        },
                        {
                            id: 'q1',
                            header: 'Q1',
                            columnGroupShow: 'open',
                            minWidth: 70,
                            align: 'right'
                        },
                        {
                            id: 'q2',
                            header: 'Q2',
                            columnGroupShow: 'open',
                            minWidth: 70,
                            align: 'right'
                        }
                    ]
                },
                {
                    id: 'second-half',
                    header: 'Nửa sau',
                    columnGroupShow: 'open',
                    children: [
                        {
                            id: 'h2',
                            header: 'H2',
                            columnGroupShow: 'closed',
                            minWidth: 90,
                            align: 'right'
                        },
                        {
                            id: 'q3',
                            header: 'Q3',
                            columnGroupShow: 'open',
                            minWidth: 70,
                            align: 'right'
                        },
                        {
                            id: 'q4',
                            header: 'Q4',
                            columnGroupShow: 'open',
                            minWidth: 70,
                            align: 'right'
                        }
                    ]
                }
            ]
        },
        {
            // Id của nhóm phải khác id của mọi cột: cả hai cùng sống trong một
            // không gian tên, nhóm này trước đây trùng tên với cột trong nó.
            id: 'planning',
            header: 'Kế hoạch',
            // Gập kiểu dải: không cột nào phải khai `columnGroupShow`, cả nhóm
            // thu lại thành một dải dọc và chính dải đó là đường mở ra lại.
            collapseMode: 'rail',
            children: [
                { id: 'plan', header: 'Chỉ tiêu', minWidth: 100, align: 'right', sortable: true },
                { id: 'gap', header: 'Chênh lệch', minWidth: 110, align: 'right', sortable: true }
            ]
        }
    ]

    const grid: GridState<Region> = createDataGrid<Region>({
        data: rows,
        columns,
        getRowId: (row) => String(row.id),
        features: [sorting(), columnOps()]
    })

    const revenueFolded = $derived(grid.columns.isCollapsed('revenue'))
    const firstHalfFolded = $derived(grid.columns.isCollapsed('first-half'))
    const planFolded = $derived(grid.columns.isCollapsed('planning'))

    let log = $state<string[]>([])
    grid.events.on('columnGroupToggled', ({ groupId, collapsed }) => {
        log = [`${groupId}: ${collapsed ? 'gập' : 'mở'}`, ...log].slice(0, 5)
    })
</script>

{#snippet regionCell({ value }: { value: unknown })}
    <Badge label={String(value)} color="primary" size="sm" />
{/snippet}

{#snippet revenueHeader({ cell }: HeaderGroupContext)}
    <!-- Header nhóm do app tự vẽ. Không bọc trong nút: ô nhóm đã là chỗ nhận
         focus, và nút gập của lưới nằm ngay cạnh. -->
    <span class="truncate font-semibold text-on-surface">{cell.header}</span>
    <Badge
        label={cell.collapsed ? 'tóm tắt' : `${cell.span} quý`}
        color={cell.collapsed ? 'warning' : 'success'}
        size="xs"
        class="shrink-0"
    />
{/snippet}

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Nhóm header gập được</h1>
            <p class="max-w-3xl text-sm text-on-surface-variant">
                Cột nào gập theo là do chính cột đó khai <code>columnGroupShow</code>:
                <code>'open'</code> là chi tiết, <code>'closed'</code> là bản tóm tắt hiện ra khi gập,
                không khai gì thì luôn hiện. Mọi tầng đều có nút của riêng nó, và một nhóm con trả lời
                cho nhóm ngay trên nó chứ không phải cho nhóm ngoài cùng.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/groups/cases">Các case để nghiệm thu →</Link>
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="grid gap-4 md:grid-cols-3">
        <Card class="space-y-1 p-4">
            <h2 class="font-medium text-on-surface">Đổi sang cột tóm tắt</h2>
            <p class="text-sm text-on-surface-variant">
                <em>Doanh thu</em> chứa <em>Nửa đầu</em> và <em>Nửa sau</em>, mỗi nhóm con có nút
                riêng: gập <em>Nửa đầu</em> thì Q1 Q2 nhường chỗ cho H1, tầng trên không đụng gì.
                Gập <em>Doanh thu</em> thì cả hai nhóm con đi theo, còn lại cột <em>Cả năm</em>; mở
                ra thì nhóm con trở lại đúng trạng thái bạn để nó. Header nhóm này do trang tự vẽ
                bằng <code>headerGroupCell</code>.
            </p>
            <p class="text-sm text-on-surface">
                Doanh thu: <strong>{revenueFolded ? 'gập' : 'mở'}</strong> · Nửa đầu:
                <strong>{firstHalfFolded ? 'gập' : 'mở'}</strong>
            </p>
        </Card>
        <Card class="space-y-1 p-4">
            <h2 class="font-medium text-on-surface">Gập thành dải dọc</h2>
            <p class="text-sm text-on-surface-variant">
                <em>Kế hoạch</em> khai <code>collapseMode: 'rail'</code>. Gập là
                <strong>cả nhóm biến mất</strong>, kể cả dữ liệu từng dòng, chỉ còn một dải hẹp chạy
                suốt chiều cao lưới, tính cả phần header, với tên nhóm xoay dọc bám lại khi cuộn.
                Trên header không còn nút gập nào cả: bấm vào bất kỳ đâu trên dải là mở lại. Không
                cột nào phải khai <code>columnGroupShow</code>, vì chính dải đó là đường mở ra lại.
            </p>
            <p class="text-sm text-on-surface">
                Kế hoạch: <strong>{planFolded ? 'dải' : 'mở'}</strong>
            </p>
        </Card>
        <Card class="space-y-1 p-4">
            <h2 class="font-medium text-on-surface">Bàn phím</h2>
            <p class="text-sm text-on-surface-variant">
                Từ header lá bấm <Kbd size="sm">↑</Kbd> để lên tầng nhóm,
                <Kbd size="sm">←</Kbd>
                <Kbd size="sm">→</Kbd> đi giữa các nhóm cùng tầng,
                <Kbd size="sm">Enter</Kbd> hoặc <Kbd size="sm">Space</Kbd> để gập,
                <Kbd size="sm">↓</Kbd> để quay xuống. Cột không thuộc nhóm nào thì
                <Kbd size="sm">↑</Kbd> không đi đâu cả. Dải dọc cũng mở lại được bằng phím, vì ô nhóm
                phía trên nó vẫn còn.
            </p>
        </Card>
    </div>

    <DataGrid {grid} />

    <Card class="space-y-2 p-4">
        <h2 class="font-medium text-on-surface">Sự kiện</h2>
        <p class="text-sm text-on-surface-variant">
            Nút trên header, mục trong column menu, phím Enter và
            <code>grid.api.toggleGroup()</code> đều đi qua một cửa, nên đều phát
            <code>columnGroupToggled</code> và đều được đọc lên cho trình đọc màn hình.
        </p>
        {#if log.length === 0}
            <p class="text-sm text-on-surface-variant" data-testid="group-log">chưa có gì</p>
        {:else}
            <ul class="space-y-1 text-sm text-on-surface" data-testid="group-log">
                {#each log as entry, i (i)}
                    <li>{entry}</li>
                {/each}
            </ul>
        {/if}
    </Card>
</Container>
