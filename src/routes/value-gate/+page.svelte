<script lang="ts">
    import { Badge, Button, Card, Container, Link, Select, ThemeModeButton } from 'sv5ui'
    import {
        createDataGrid,
        DataGrid,
        editing,
        filtering,
        getEditing,
        getFiltering,
        getSelection,
        rowsToMatrix,
        selection,
        sorting,
        toCsv,
        withHeaderRow,
        type ColumnDef,
        type GridFeature,
        type GridState
    } from '$lib/index.js'

    interface Employee {
        id: number
        name: string
        team: string
        email: string
        phone: string
        salary: number
    }

    const staff: Employee[] = [
        {
            id: 1,
            name: 'Nguyễn Văn A',
            team: 'Kỹ thuật',
            email: 'an@example.com',
            phone: '0901234567',
            salary: 32_000_000
        },
        {
            id: 2,
            name: 'Trần Thị B',
            team: 'Thiết kế',
            email: 'binh@example.com',
            phone: '0912345678',
            salary: 28_500_000
        },
        {
            id: 3,
            name: 'Lê Văn C',
            team: 'Kỹ thuật',
            email: 'cuong@example.com',
            phone: '0923456789',
            salary: 41_000_000
        },
        {
            id: 4,
            name: 'Phạm Thị D',
            team: 'Kinh doanh',
            email: 'dung@example.com',
            phone: '0934567890',
            salary: 25_000_000
        },
        {
            id: 5,
            name: 'Võ Văn E',
            team: 'Kỹ thuật',
            email: 'em@example.com',
            phone: '0945678901',
            salary: 37_500_000
        },
        {
            id: 6,
            name: 'Đặng Thị F',
            team: 'Kinh doanh',
            email: 'phuong@example.com',
            phone: '0956789012',
            salary: 22_000_000
        }
    ]

    const columns: ColumnDef<Employee>[] = [
        { id: 'name', header: 'Họ tên', width: 170, sortable: true, filter: 'text' },
        { id: 'team', header: 'Nhóm', width: 130, filter: 'set' },
        { id: 'email', header: 'Email', flex: 1, minWidth: 200, filter: 'text' },
        { id: 'phone', header: 'Điện thoại', width: 140 },
        {
            id: 'salary',
            header: 'Lương',
            width: 150,
            align: 'right',
            sortable: true,
            filter: 'set',
            editable: true
        }
    ]

    const roles = [
        { label: 'Nhân viên', value: 'staff' },
        { label: 'Quản trị nhân sự', value: 'hr' }
    ]

    let role = $state('staff')
    const hidden = $derived(role !== 'hr')

    /**
     * One feature, one hook. It is asked per column and returns a reader for
     * the three it hides, so the other two are read straight through and cost
     * nothing at all.
     *
     * A reader is a transform, not just a blank: the salary leaves as a mark,
     * the email keeps its domain, and the phone leaves as nothing, which the
     * cell draws as its empty text.
     */
    const readers: Record<string, (value: unknown) => unknown> = {
        salary: () => '***',
        email: (value) => String(value).replace(/^[^@]+/, '***'),
        phone: () => null
    }

    const policy: GridFeature<Employee> = {
        id: 'hr-policy',
        cellValue: ({ column }) => (hidden ? readers[column.id] : undefined),
        // Classes say which cells the policy touched; the values above are
        // what it actually held back.
        cellDecoration: ({ column }) =>
            hidden && readers[column.id] ? { class: 'text-on-surface-variant italic' } : undefined
    }

    const grid: GridState<Employee> = createDataGrid<Employee>({
        data: staff,
        columns,
        getRowId: (person) => String(person.id),
        features: [sorting(), filtering(), selection(), editing(), policy]
    })

    const filter = getFiltering(grid)!
    const selected = getSelection(grid)!
    const editor = getEditing(grid)!

    // Selected once, up front, so the clipboard panel below has something to
    // copy and stays a pure read of the selection.
    selected.selectAll()

    const firstNode = $derived(grid.nodes[0])

    /** Exit 1: what the cell draws, read back out of the grid. */
    const drawn = $derived(
        firstNode ? String(grid.getValue(firstNode, grid.columns.get('salary')!)) : ''
    )

    /** Exit 2: the clipboard, exactly what `Ctrl+C` would put there. */
    const clipboard = $derived(selected.copyText({ headers: true }) ?? '')

    /** Exit 3: the file, built from the pieces `exportCsv` itself uses. */
    const csv = $derived.by(() => {
        const visible = grid.columns.visible
        const matrix = rowsToMatrix(grid.preWindowNodes, visible, undefined, {
            read: (column) => grid.readerFor(column.id, 'export')
        })
        return toCsv(withHeaderRow(matrix, visible))
    })

    /** Exit 5: the values a set filter offers on a hidden column. */
    const facets = $derived(filter.distinctFor('salary').map((value) => String(value)))

    /** Exit 6: whether an editor may open on the cell at all. */
    const editable = $derived(
        firstNode ? editor.editableAt(firstNode, grid.columns.get('salary')!.def) : false
    )

    const rowsFound = $derived(grid.nodes.length)

    function search(query: string) {
        filter.setQuickFilter(query)
    }
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Cổng giá trị ô</h1>
            <p class="max-w-3xl text-sm text-on-surface-variant">
                Hook <code>cellValue</code> đứng giữa dữ liệu và mọi đường giá trị rời khỏi lưới.
                Đổi vai ở dưới: một feature duy nhất che ba cột, và cả sáu đường cùng đổi một lượt.
                Che bằng CSS thì chỉ che được với người nhìn, còn <code>Ctrl+C</code> vẫn lấy nguyên giá
                trị.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <Card class="flex flex-wrap items-center gap-4 p-3">
        <Select items={roles} bind:value={role} aria-label="Vai đang xem" class="w-60" />
        <Badge
            label={hidden ? 'Đang che: Email, Điện thoại, Lương' : 'Không che cột nào'}
            color={hidden ? 'warning' : 'success'}
        />
        <span class="grow"></span>
        <Button
            label="Tìm 32000000"
            variant="outline"
            size="sm"
            onclick={() => search('32000000')}
        />
        <Button label="Tìm ***" variant="outline" size="sm" onclick={() => search('***')} />
        <Button label="Xoá tìm kiếm" variant="ghost" size="sm" onclick={() => search('')} />
    </Card>

    <DataGrid {grid} toolbar />

    <div class="grid gap-4 md:grid-cols-2">
        <Card class="space-y-2 p-4">
            <h2 class="font-medium text-on-surface">1. Ô vẽ ra</h2>
            <p class="text-sm text-on-surface-variant">
                Lương của dòng đầu, đọc lại bằng <code>grid.getValue</code>.
            </p>
            <pre
                class="rounded bg-surface-container-lowest p-3 font-mono text-xs text-on-surface"
                data-testid="drawn">{drawn}</pre>
        </Card>

        <Card class="space-y-2 p-4">
            <h2 class="font-medium text-on-surface">2. Clipboard</h2>
            <p class="text-sm text-on-surface-variant">
                Chính là chuỗi TSV mà <code>Ctrl+C</code> đặt vào bộ nhớ tạm.
            </p>
            <pre
                class="max-h-40 overflow-auto rounded bg-surface-container-lowest p-3 font-mono text-xs whitespace-pre text-on-surface"
                data-testid="clipboard">{clipboard}</pre>
        </Card>

        <Card class="space-y-2 p-4">
            <h2 class="font-medium text-on-surface">3. File CSV</h2>
            <p class="text-sm text-on-surface-variant">
                Dựng bằng đúng các hàm <code>exportCsv</code> dùng, nên đây là nội dung thật của file.
            </p>
            <pre
                class="max-h-40 overflow-auto rounded bg-surface-container-lowest p-3 font-mono text-xs whitespace-pre text-on-surface"
                data-testid="csv">{csv}</pre>
        </Card>

        <Card class="space-y-2 p-4">
            <h2 class="font-medium text-on-surface">4. Quick filter</h2>
            <p class="text-sm text-on-surface-variant">
                Chuỗi tìm dựng từ giá trị đã qua cổng. Bấm <em>Tìm 32000000</em> khi đang che: không dòng
                nào khớp, vì con số đó không còn ở đâu để tìm.
            </p>
            <p class="text-sm text-on-surface" data-testid="rows-found">
                Đang hiện {rowsFound} / {staff.length} dòng
            </p>
        </Card>

        <Card class="space-y-2 p-4">
            <h2 class="font-medium text-on-surface">5. Danh sách của set filter</h2>
            <p class="text-sm text-on-surface-variant">
                Mở filter cột Lương trên header cũng thấy đúng danh sách này.
            </p>
            <pre
                class="rounded bg-surface-container-lowest p-3 font-mono text-xs text-on-surface"
                data-testid="facets">{facets.join('\n')}</pre>
        </Card>

        <Card class="space-y-2 p-4">
            <h2 class="font-medium text-on-surface">6. Sửa ô</h2>
            <p class="text-sm text-on-surface-variant">
                Ô bị thay giá trị là ô không mở editor được: mở ra thì cái được ghi đè lên dữ liệu
                thật sẽ là dấu che.
            </p>
            <Badge
                label={editable ? 'Cột Lương: sửa được' : 'Cột Lương: khoá'}
                color={editable ? 'success' : 'warning'}
            />
        </Card>
    </div>

    <Card class="space-y-2 p-4">
        <h2 class="font-medium text-on-surface">Cổng không bịt gì</h2>
        <p class="text-sm text-on-surface-variant">
            Sắp xếp và predicate của filter đọc thẳng giá trị thô, có chủ đích: sort chạy n log n,
            còn một predicate quyết định dòng nào sống sót thì không thể quyết định trên dấu che.
            Nên vẫn sắp xếp được cột Lương đang che, và thứ tự đó nói ra thứ nó giấu. Một feature
            policy thật phải gỡ luôn sort và filter khỏi cột như vậy. Ứng dụng cũng vẫn cầm nguyên
            <code>node.row</code> trong <code>cell</code> snippet: dữ liệu thật sự nhạy cảm thì đừng gửi
            xuống client.
        </p>
    </Card>
</Container>
