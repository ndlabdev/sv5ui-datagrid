<script lang="ts">
    import { Button, Card, Container, Link, ThemeModeButton } from 'sv5ui'
    import {
        createDataGrid,
        DataGrid,
        grouping,
        tree,
        virtualization,
        type ColumnDef,
        type GridState
    } from '$lib/index.js'

    interface Sale {
        id: number
        region: string
        product: string
        rep: string
        amount: number
    }

    const REGIONS = ['Bắc', 'Trung', 'Nam']
    const PRODUCTS = ['Widget', 'Gadget']

    const sales: Sale[] = REGIONS.flatMap((region, r) =>
        PRODUCTS.flatMap((product, p) =>
            Array.from({ length: 40 }, (_, at) => ({
                id: r * 1000 + p * 100 + at,
                region,
                product,
                rep: `NV ${String(at + 1).padStart(2, '0')}`,
                amount: (at + 1) * 10 + p * 5
            }))
        )
    )

    const columns: ColumnDef<Sale>[] = [
        { id: 'rep', header: 'Người bán', width: 150 },
        { id: 'region', header: 'Vùng' },
        { id: 'product', header: 'Hàng' },
        { id: 'amount', header: 'Tiền', type: 'number' }
    ]

    const make = (by: string[]) =>
        createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (row) => String(row.id),
            stickyGroups: true,
            features: [virtualization<Sale>({ rowHeight: 40 }), grouping<Sale>({ by })]
        })

    let on = $state(true)

    const oneLevel = make(['region'])
    const twoLevels = make(['region', 'product'])

    interface Folder {
        id: number
        parent: number | null
        name: string
        size: number
    }

    const folders: Folder[] = [1, 2, 3].flatMap((root) => [
        { id: root, parent: null, name: `Thư mục ${root}`, size: 0 },
        ...Array.from({ length: 30 }, (_, at) => ({
            id: root * 1000 + at,
            parent: root,
            name: `tệp ${at + 1}.txt`,
            size: (at + 1) * 3
        }))
    ])

    const treeGrid: GridState<Folder> = createDataGrid<Folder>({
        data: folders,
        columns: [
            { id: 'name', header: 'Tên', width: 240 },
            { id: 'size', header: 'KB', type: 'number' }
        ],
        getRowId: (row) => String(row.id),
        stickyGroups: true,
        features: [
            virtualization<Folder>({ rowHeight: 40 }),
            tree<Folder>({
                getParentId: (row) => (row.parent === null ? null : String(row.parent))
            })
        ]
    })

    $effect(() => {
        for (const node of treeGrid.preWindowNodes) {
            if (node.meta?.expandable) treeGrid.expansion.expand(node.id)
        }
    })

    $effect(() => {
        oneLevel.stickyGroups = on
        twoLevels.stickyGroups = on
        treeGrid.stickyGroups = on
    })

    const code = ['createDataGrid({', '    stickyGroups: true', '})'].join('\n')
</script>

<Container class="space-y-6 py-6">
    <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Hàng nhóm dính</h1>
            <p class="text-sm text-on-surface-variant">
                Cuộn sâu vào một nhóm dài thì câu hỏi "tôi đang ở nhóm nào" không còn phải cuộn
                ngược lên mới trả lời được.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Button variant="ghost" size="sm" label="Bản trộn" href="/sticky/mixed" />
            <Button variant="ghost" size="sm" label="Trang chủ" href="/" />
            <ThemeModeButton />
        </div>
    </div>

    <pre
        class="overflow-x-auto rounded-lg bg-surface-container px-4 py-3 text-xs text-on-surface-variant">{code}</pre>

    <div class="flex flex-wrap items-center gap-2">
        <Button
            variant={on ? 'solid' : 'outline'}
            size="sm"
            label={on ? 'Đang bật' : 'Đang tắt'}
            onclick={() => (on = !on)}
        />
        <span class="text-sm text-on-surface-variant">
            Tắt đi rồi cuộn lại để thấy cái mất đi là gì.
        </span>
    </div>

    <Card class="space-y-2 p-4">
        <h2 class="font-medium text-on-surface">Một tầng</h2>
        <p class="text-sm text-on-surface-variant">
            Ba vùng, mỗi vùng 80 dòng. Cuộn xuống: tên vùng ở lại dưới header cho tới khi vùng sau
            thay chỗ nó.
        </p>
        <DataGrid grid={oneLevel} class="h-[320px]" />
    </Card>

    <Card class="space-y-2 p-4">
        <h2 class="font-medium text-on-surface">Hai tầng, xếp chồng</h2>
        <p class="text-sm text-on-surface-variant">
            Mỗi tầng một dòng, ngoài cùng trước. Cuộn sâu vào Widget của vùng Trung thì thấy cả hai,
            nên biết mình đang ở đâu trong cây chứ không chỉ ở nhánh gần nhất.
        </p>
        <DataGrid grid={twoLevels} class="h-[320px]" />
    </Card>

    <Card class="space-y-2 p-4">
        <h2 class="font-medium text-on-surface">Cây dữ liệu, cùng một cơ chế</h2>
        <p class="text-sm text-on-surface-variant">
            Không có nhóm nào ở đây, chỉ là <code>tree()</code>. Cái dính là hàng cha, vì cơ chế bám
            vào tầng của hàng chứ không bám vào tính năng nào.
        </p>
        <DataGrid grid={treeGrid} class="h-[320px]" />
    </Card>

    <Card class="space-y-2 p-4 text-sm">
        <h2 class="font-medium text-on-surface">Cách nó chạy</h2>
        <p class="text-on-surface-variant">
            Lưới tìm hàng đầu tiên còn nằm dưới mép trên của khung, rồi đi ngược lên nhặt các hàng
            có tầng nhỏ dần. Đó đúng là chuỗi tổ tiên của chỗ bạn đang đọc, và mọi hàng ở chỉ số nhỏ
            hơn nó thì chắc chắn đã trôi lên trên mép, nên không cần kiểm lại từng cái.
        </p>
        <p class="text-on-surface-variant">
            Nó bám vào <code>meta.level</code>, thứ mà mọi tính năng dựng cấu trúc hàng đều đặt:
            <code>grouping()</code>, <code>tree()</code> và cả <code>pivot()</code>, vì hàng của một
            phép giao cũng là hàng nhóm. Lưới phẳng thì không hàng nào có tầng, nên nó không làm gì
            và không tốn gì.
        </p>
        <p class="text-on-surface-variant">
            Cần <code>virtualization()</code>, vì đó là chỗ biết hàng nào nằm ở đâu so với vị trí
            cuộn. Không có nó thì không gì dính, và lưới im lặng chứ không vẽ sai.
        </p>
        <p class="text-on-surface-variant">
            Những dòng dính là <strong class="text-on-surface"
                >biển chỉ đường, không phải bộ điều khiển thứ hai</strong
            >. Chúng mang <code>inert</code>, nên không thêm một chặng Tab nào và trình đọc màn hình
            chỉ đọc mỗi nhóm một lần, từ chính hàng thật vẫn đang ở trong lưới. Muốn gập nhóm thì
            cuộn lên bấm hàng thật.
        </p>
        <p class="text-on-surface-variant">
            Chồng cao bằng độ sâu của nhóm. Nhóm sáu tầng thì mất sáu dòng khung nhìn, nên đây là
            thứ nên bật khi nhóm nông và dữ liệu dài, chứ không phải bật cho mọi lưới.
        </p>
        <p class="text-on-surface-variant">
            Nó nằm dưới hàng ghim bằng <code>rowPinning()</code>, không che lên. Hai lớp cùng dính
            và offset cộng dồn qua chiều cao header thật, nên đổi
            <Link href="/pivot/header-height">chiều cao header</Link> cũng không làm lệch.
        </p>
    </Card>
</Container>
