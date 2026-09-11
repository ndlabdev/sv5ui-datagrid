<script lang="ts">
    import {
        Grid,
        columnOps,
        createDataGrid,
        editing,
        filtering,
        sorting,
        type ColumnDef
    } from '$lib/index.js'
    import { Badge, Button, Container, Link, ThemeModeButton } from 'sv5ui'
    import { advancedFilter, DataGrid, dataImport, formula, getDataImport } from '$lib/index.js'

    interface Member {
        id: number
        name: string
        email: string
        dept: string
        joined: string
        active: boolean
        rate: number
        hours: number
        cost?: number
    }

    let nextId = 100

    const seed: Member[] = [
        {
            id: 1,
            name: 'Chi Nguyen',
            email: 'chi@example.vn',
            dept: 'Core',
            joined: '2024-01-15',
            active: true,
            rate: 45,
            hours: 160
        },
        {
            id: 2,
            name: 'An Tran',
            email: 'an@example.vn',
            dept: 'Data',
            joined: '2025-06-01',
            active: false,
            rate: 38,
            hours: 120
        }
    ]

    const columns: ColumnDef<Member>[] = [
        { id: 'name', header: 'Name', width: 170, filter: 'text', editable: true },
        {
            id: 'email',
            header: 'Email',
            width: 200,
            filter: 'text',
            editable: true,
            validate: (value) =>
                /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value ?? '')) ? null : 'Email looks wrong'
        },
        { id: 'dept', header: 'Dept', width: 120, type: 'badge', filter: 'text', editable: true },
        {
            id: 'joined',
            header: 'Joined',
            width: 140,
            type: 'date',
            filter: 'date',
            editable: true
        },
        { id: 'active', header: 'Active', width: 100, type: 'boolean', filter: 'boolean' },
        {
            id: 'rate',
            header: 'Rate',
            width: 120,
            align: 'right',
            type: 'currency',
            filter: 'number',
            editable: true
        },
        {
            id: 'hours',
            header: 'Hours',
            width: 110,
            align: 'right',
            type: 'number',
            filter: 'number'
        },
        {
            id: 'cost',
            header: 'Cost',
            width: 140,
            align: 'right',
            type: 'currency',
            filter: 'number'
        }
    ]

    const grid = createDataGrid<Member>({
        columns,
        data: seed,
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            filtering(),
            columnOps(),
            editing(),
            advancedFilter<Member>(),
            formula<Member>({ columns: { cost: 'rate * hours' } }),
            dataImport<Member>({
                accept: ['csv', 'tsv', 'xlsx', 'clipboard'],
                newRow: () => ({ id: nextId++ }),
                dedupe: { columns: ['email'], against: 'both' },
                onCommit: (added) => {
                    grid.data = [...grid.data, ...added]
                }
            })
        ]
    })

    const importing = getDataImport(grid)!

    const SAMPLE = `Name,Email,Dept,Joined,Active,Rate,Hours
Bình Lê,binh@example.vn,Core,15/03/2026,Có,52,150
Dũng Phạm,dung@example.vn,Growth,2026-04-01,x,1.250,80
Mai Vũ,mai-at-example,Data,soon,maybe,abc,100`

    const REPEATS = `Name,Email,Dept,Joined,Active,Rate,Hours
Chi Nguyen,CHI@example.vn,Core,2024-01-15,Có,45,160
Hà Đỗ,ha@example.vn,Growth,2026-02-02,Có,40,150
Hà Đỗ (again),HA@Example.vn,Growth,2026-02-03,Có,41,150
Nam Vũ,,Infra,2026-02-04,Có,39,140`

    const STRANGER = `Alpha,Beta,Gamma
1,two,three
4,five,six`

    function tryTheSample() {
        void importing.takeText(SAMPLE)
    }

    function tryTheRepeats() {
        void importing.takeText(REPEATS)
    }

    function tryAStranger() {
        void importing.takeText(STRANGER)
    }

    function download() {
        const blob = new Blob([SAMPLE], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = 'members.csv'
        link.click()
        URL.revokeObjectURL(url)
    }
</script>

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Import wizard - @sv5ui/datagrid</h1>
            <p class="text-sm text-on-surface-variant">
                Every grid exports. None imports. Drop a CSV or an XLSX, match its columns to this
                grid's, and the rows are staged <strong>inside the grid itself</strong> - tinted, with
                the cells that could not be read ringed in red - before anything is committed.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/">&larr; Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" label="Try the sample" onclick={tryTheSample} />
        <Button
            variant="outline"
            size="sm"
            label="Try a file that repeats itself"
            onclick={tryTheRepeats}
        />
        <Button
            variant="outline"
            size="sm"
            label="Try a file that matches nothing"
            onclick={tryAStranger}
        />
        <Button
            variant="ghost"
            color="surface"
            size="sm"
            icon="lucide:download"
            label="Save it as a file"
            onclick={download}
        />
        <Badge color="surface" size="sm" label={`${grid.data.length} rows in the grid`} />
        {#if importing.isReviewing}
            <Badge
                color={importing.badRows.size > 0 ? 'warning' : 'success'}
                size="sm"
                label={`${importing.staged.length} staged`}
            />
        {/if}
    </div>

    <Grid.ImportWizard {grid} />

    <DataGrid {grid} toolbar class="h-120" />

    <div class="grid gap-4 lg:grid-cols-2">
        <div class="space-y-2">
            <h2 class="text-sm font-medium text-on-surface">What the sample is testing</h2>
            <ul class="list-disc space-y-1 pl-5 text-xs text-on-surface-variant">
                <li>
                    <code>15/03/2026</code> is day-first; <code>2026-04-01</code> is ISO. Both land as
                    dates.
                </li>
                <li>
                    <code>Có</code> and <code>x</code> both mean yes; <code>maybe</code> does not, and
                    says so.
                </li>
                <li>
                    "Try a file that matches nothing" sends <code>Alpha,Beta,Gamma</code>: nothing
                    is guessed, the step stays closed, and it says why. A guess needs an exact name
                    or a four-character prefix - <code>Paid</code> will not become <code>id</code>.
                </li>
                <li>
                    <code>1.250</code> is undecidable across countries, so it reads as the smaller
                    number - inflating money a thousandfold is the worse mistake. Pass
                    <code>decimal: ','</code> when the files come from a place that writes
                    <code>1.250,50</code>.
                </li>
                <li>
                    <code>mai-at-example</code> fails the same <code>validate</code> the editor uses.
                </li>
                <li>
                    "Try a file that repeats itself" is the same export imported twice:
                    <code>CHI@example.vn</code> is already in the grid and
                    <code>HA@Example.vn</code> repeats a row earlier in the file - case and spacing
                    do not hide either. The last row has no email at all, so it is
                    <em>not</em> called a duplicate: a blank identifies nothing. It is still
                    refused, by the column's own <code>validate</code>, which is a different
                    complaint and reads as one. <strong>Add ready</strong> takes the single row that is
                    genuinely new.
                </li>
                <li><code>abc</code> in a currency column is refused rather than becoming zero.</li>
            </ul>
        </div>

        <div class="space-y-2">
            <h2 class="text-sm font-medium text-on-surface">What it crosses with</h2>
            <p class="text-xs text-on-surface-variant">
                The staged rows enter the pipeline <strong>before</strong> everything else, so
                <code>formula()</code> computes their Cost, filtering and the advanced filter narrow the
                review, and grouping groups them. They are ordinary rows wearing a tint, not a separate
                list - which is why fixing one is just editing a cell.
            </p>
            <p class="text-xs text-on-surface-variant">
                A cell holding <code>=SUM(A1:A9)</code> arrives as that text and nothing runs it. An XLSX
                is a zip, so the reader caps what it will inflate and refuses a document that declares
                its own entities - the two shapes a small file uses to become a huge one.
            </p>
        </div>
    </div>
</Container>
