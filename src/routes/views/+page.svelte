<script lang="ts">
    import {
        Grid,
        createDataGrid,
        columnOps,
        filtering,
        sorting,
        type ColumnDef
    } from '$lib/index.js'
    import { Button, Container, Link, ThemeModeButton } from 'sv5ui'
    import {
        DataGrid,
        getGrouping,
        getSavedViews,
        grouping,
        savedViews,
        type SavedView
    } from '$lib/index.js'

    interface Row {
        id: number
        dept: string
        country: string
        role: string
        salary: number
    }

    const DEPTS = ['Core', 'Platform', 'Growth', 'Data']
    const COUNTRIES = ['VN', 'US', 'JP', 'DE']
    const ROLES = ['Engineer', 'Senior', 'Lead']

    const rows: Row[] = Array.from({ length: 60 }, (_, i) => ({
        id: i + 1,
        dept: DEPTS[i % 4]!,
        country: COUNTRIES[Math.floor(i / 4) % 4]!,
        role: ROLES[i % 3]!,
        salary: 40_000 + (i % 20) * 1_500
    }))

    const columns: ColumnDef<Row>[] = [
        { id: 'dept', header: 'Dept', width: 140, sortable: true, filter: 'text' },
        { id: 'country', header: 'Country', width: 120, sortable: true, filter: 'text' },
        { id: 'role', header: 'Role', width: 140, sortable: true },
        { id: 'salary', header: 'Salary', width: 140, align: 'right', sortable: true }
    ]

    const seeded: SavedView[] = [
        {
            id: 'built-in-by-dept',
            name: 'Theo Dept (mẫu)',
            snapshot: {
                version: 1,
                density: 'compact',
                features: { grouping: { by: ['dept'] } }
            }
        }
    ]

    let stored = $state<SavedView[]>([])

    const grid = createDataGrid<Row>({
        columns,
        data: rows,
        getRowId: (row) => String(row.id),
        features: [
            filtering(),
            sorting(),
            columnOps(),
            grouping<Row>(),
            savedViews<Row>({
                views: seeded,
                storage: null,
                onChange: (next: SavedView[]) => (stored = next)
            })
        ]
    })

    const views = getSavedViews(grid)!
    const groupingState = getGrouping(grid)!

    let token = $state('')
    let applied = $state('')

    async function makeToken() {
        try {
            token = await views.shareToken()
            applied = ''
        } catch (error) {
            token = ''
            applied = String(error)
        }
    }

    async function useToken() {
        applied = (await views.applyToken(token.trim())) ? 'áp dụng OK' : 'token không đọc được'
    }

    const snapshot = $derived(JSON.stringify(grid.api.getState(), null, 2))
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Saved views - bàn thử</h1>
            <p class="text-sm text-on-surface-variant">
                Một view lưu <strong
                    >cách nhóm, sắp xếp, bộ lọc, thứ tự và độ rộng cột, mật độ</strong
                >
                - đọc từ <code>grid.api.getState()</code>, khôi phục bằng
                <code>setState()</code>.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <Grid.SavedViews {grid} />

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Đổi trạng thái lưới để thử</h2>
        <div class="flex flex-wrap items-center gap-2">
            <Button
                size="sm"
                variant="outline"
                label="Nhóm theo Dept"
                onclick={() => groupingState.setGroupBy(['dept'])}
            />
            <Button
                size="sm"
                variant="outline"
                label="Nhóm Dept + Country"
                onclick={() => groupingState.setGroupBy(['dept', 'country'])}
            />
            <Button
                size="sm"
                variant="outline"
                label="Bỏ nhóm"
                onclick={groupingState.clearGrouping}
            />
            <Button
                size="sm"
                variant="outline"
                label="Ẩn cột Role"
                onclick={() => grid.columns.setHidden('role', !grid.columns.get('role')?.hidden)}
            />
            <Button
                size="sm"
                variant="outline"
                label="Đổi mật độ"
                onclick={() => (grid.density = grid.density === 'compact' ? 'standard' : 'compact')}
            />
        </div>
    </section>

    <Grid.GroupPanel {grid} />
    <DataGrid {grid} toolbar />

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Share token</h2>
        <div class="flex flex-wrap items-center gap-2">
            <Button
                size="sm"
                variant="outline"
                label="Tạo token"
                onclick={() => void makeToken()}
            />
            <Button
                size="sm"
                variant="outline"
                label="Áp token"
                disabled={token.trim() === ''}
                onclick={() => void useToken()}
            />
            {#if applied}
                <span class="text-xs text-on-surface-variant">{applied}</span>
            {/if}
        </div>
        <textarea
            bind:value={token}
            rows="3"
            aria-label="Share token"
            class="w-full rounded-lg border border-outline-variant bg-surface-container p-3 font-mono text-xs text-on-surface-variant"
        ></textarea>
        <p class="text-xs text-on-surface-variant">
            Độ dài: <strong>{token.length}</strong> ký tự. Giới hạn an toàn cho URL là 1800 - quá
            thì
            <code>shareToken()</code> ném lỗi thay vì trả link hỏng.
        </p>
    </section>

    <section class="grid gap-4 md:grid-cols-2">
        <div class="space-y-2">
            <h2 class="text-lg font-medium text-on-surface">Snapshot hiện tại</h2>
            <pre
                class="max-h-72 overflow-auto rounded-lg border border-outline-variant bg-surface-container p-3 font-mono text-xs text-on-surface-variant">{snapshot}</pre>
        </div>
        <div class="space-y-2">
            <h2 class="text-lg font-medium text-on-surface">Danh sách đã lưu</h2>
            <pre
                class="max-h-72 overflow-auto rounded-lg border border-outline-variant bg-surface-container p-3 font-mono text-xs text-on-surface-variant">{JSON.stringify(
                    stored.map((view) => ({ id: view.id, name: view.name })),
                    null,
                    2
                )}</pre>
        </div>
    </section>

    <section class="space-y-2">
        <h2 class="text-lg font-medium text-on-surface">Cần thử những gì</h2>
        <ol
            class="list-inside list-decimal space-y-1 text-sm text-on-surface-variant marker:text-on-surface"
        >
            <li>
                Chọn <strong>Theo Dept (mẫu)</strong> → lưới phải nhóm theo Dept
                <em>và</em> đổi mật độ sang compact
            </li>
            <li>
                Đổi sang <strong>Nhóm Dept + Country</strong> → nhãn <em>đã chỉnh</em> phải hiện
            </li>
            <li><strong>Hoàn nguyên</strong> → quay lại đúng view, nhãn <em>đã chỉnh</em> tắt</li>
            <li>Đổi rồi bấm <strong>Cập nhật</strong> → nhãn tắt, snapshot của view đổi theo</li>
            <li>
                Bỏ nhóm rồi nhóm lại <em>đúng như cũ</em> → nhãn <strong>không được</strong> hiện (so
                sánh phải chuẩn hoá thứ tự khoá)
            </li>
            <li>Đặt tên trống rồi bấm Lưu → nút phải mờ, không tạo view rác</li>
            <li>Xoá view đang chọn → quay về "chọn góc nhìn", nhãn đã chỉnh biến mất</li>
            <li>
                <strong>Tạo token</strong> → dán vào ô, đổi lưới lung tung, rồi
                <strong>Áp token</strong> → về đúng trạng thái lúc tạo
            </li>
            <li>Sửa vài ký tự trong token rồi Áp → phải báo không đọc được, lưới giữ nguyên</li>
            <li>
                <strong>Chép link</strong> → mở link ở tab mới; trang này
                <em>không</em> tự đọc link (xem ghi chú bên dưới)
            </li>
        </ol>
        <p class="text-xs text-on-surface-variant">
            Trang này để <code>storage: null</code> nên không ghi vào localStorage - chạy lại là sạch.
            Ứng dụng thật bỏ tuỳ chọn đó để dùng mặc định localStorage.
        </p>
    </section>
</Container>
