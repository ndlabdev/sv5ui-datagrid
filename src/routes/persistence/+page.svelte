<script lang="ts">
    import { Button, Container, Link, ThemeModeButton } from 'sv5ui'
    import {
        columnOps,
        createDataGrid,
        DataGrid,
        filtering,
        getColumnOps,
        getSorting,
        pagination,
        sorting,
        type ColumnDef,
        type GridSnapshot,
        type PersistStateOptions
    } from '$lib/index.js'

    interface Product {
        id: number
        name: string
        category: string
        price: number
        stock: number
    }

    const categories = ['Audio', 'Display', 'Input', 'Storage', 'Power']

    const products: Product[] = Array.from({ length: 60 }, (_, i) => ({
        id: i + 1,
        name: `Product ${i + 1}`,
        category: categories[i % categories.length],
        price: 20 + ((i * 37) % 480),
        stock: (i * 13) % 200
    }))

    const columns: ColumnDef<Product>[] = [
        { id: 'name', header: 'Name', sortable: true, filter: 'text', flex: 2 },
        { id: 'category', header: 'Category', sortable: true, filter: 'set', flex: 1 },
        {
            id: 'price',
            header: 'Price',
            sortable: true,
            filter: 'number',
            type: 'currency',
            align: 'right'
        },
        { id: 'stock', header: 'Stock', sortable: true, filter: 'number', align: 'right' }
    ]

    const STORAGE_KEY = 'datagrid-persistence-demo'

    // A migrate hook upgrades snapshots an older build wrote. Returning
    // undefined discards an unreadable one and falls back to the defaults.
    const persistState: PersistStateOptions = {
        key: STORAGE_KEY,
        migrate: (stored) => (stored.version === 1 ? stored : undefined)
    }

    const grid = createDataGrid<Product>({
        columns,
        data: products,
        getRowId: (product) => String(product.id),
        features: [filtering(), sorting(), columnOps(), pagination({ pageSize: 10 })]
    })

    const sort = getSorting(grid)!
    const ops = getColumnOps(grid)!

    // Live snapshot — the exact shape written to localStorage on every change.
    let snapshot = $state<GridSnapshot>(grid.getState())
    $effect(() => {
        // Touch the reactive surfaces the snapshot is built from.
        void grid.columns.orderIds
        void grid.columns.widthOverrides
        void grid.columns.hiddenOverrides
        void grid.columns.pinnedOverrides
        void grid.density
        snapshot = grid.getState()
    })

    function forget() {
        localStorage.removeItem(STORAGE_KEY)
        location.reload()
    }
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">State persistence</h1>
            <p class="text-sm text-on-surface-variant">
                <code>persistState=&#123;&#123; key &#125;&#125;</code> tự đồng bộ layout cột, sort,
                filter, page size và density vào <code>localStorage</code>. Đổi vài thứ rồi
                <strong>F5</strong> — grid trở lại đúng như bạn để. Bảng JSON bên phải là snapshot thật
                đang được ghi.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
        <Button
            size="sm"
            variant="outline"
            label="Sort theo price ↓"
            onclick={() => sort.setSort([{ columnId: 'price', direction: 'desc' }])}
        />
        <Button
            size="sm"
            variant="outline"
            label="Ẩn cột Stock"
            onclick={() => ops.setColumnHidden('stock', true)}
        />
        <Button size="sm" variant="outline" label="Xoá state đã lưu + F5" onclick={forget} />
        <span class="text-xs text-on-surface-variant">
            <code>getState()</code>/<code>setState()</code> còn cho phép lưu preset thủ công hoặc đồng
            bộ lên server.
        </span>
    </div>

    <div class="grid gap-4 lg:grid-cols-[1fr_auto]">
        <DataGrid {grid} toolbar {persistState} />

        <aside class="min-w-0 space-y-2 lg:w-80">
            <h2 class="text-sm font-medium text-on-surface">Snapshot đang lưu</h2>
            <pre
                class="max-h-96 overflow-auto rounded-lg border border-outline-variant bg-surface-container-lowest p-3 text-xs text-on-surface-variant">{JSON.stringify(
                    snapshot,
                    null,
                    2
                )}</pre>
        </aside>
    </div>
</Container>
