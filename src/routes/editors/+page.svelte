<script lang="ts">
    import type { StandardSchemaV1 } from '@standard-schema/spec'
    import { Badge, Button, Card, Container, Link, ThemeModeButton } from 'sv5ui'
    import {
        createDataGrid,
        DataGrid,
        editing,
        getEditing,
        pagination,
        sorting,
        type ColumnDef,
        type GridState
    } from '$lib/index.js'

    interface Task {
        id: number
        title: string
        estimate: number
        priority: string
        assignee: string
        done: boolean
        due: string
        start: string
        notes: string
        impact: number
        labels: string[]
    }

    const people = ['Ada', 'Linus', 'Grace', 'Alan', 'Margaret']
    const priorities = ['Low', 'Medium', 'High', 'Critical']
    const leads = ['Ada', 'Grace']

    const tasks: Task[] = Array.from({ length: 12 }, (_, i) => ({
        id: i + 1,
        title: `Task ${i + 1}`,
        estimate: [2, 5, 8, 13][i % 4],
        priority: priorities[i % 4],
        assignee: people[i % 5],
        done: i % 3 === 0,
        due: `2026-0${(i % 9) + 1}-1${i % 9}`,
        start: `0${(i % 9) + 1}:30`,
        notes: i % 2 === 0 ? 'Needs a spec first.' : '',
        impact: (i % 5) + 1,
        labels: i % 2 === 0 ? ['api'] : ['ui', 'polish']
    }))

    /**
     * A hand-rolled standard-schema so the demo carries no dependency. Any
     * zod / valibot / arktype schema drops in unchanged — the grid only ever
     * calls `~standard.validate`.
     */
    function rule(check: (value: unknown) => string | null): StandardSchemaV1 {
        return {
            '~standard': {
                version: 1,
                vendor: 'demo',
                validate: (value) => {
                    const message = check(value)
                    return message ? { issues: [{ message }] } : { value }
                }
            }
        }
    }

    const isoDate = /^\d{4}-\d{2}-\d{2}$/

    const columns: ColumnDef<Task>[] = [
        { id: 'id', header: '#', width: 64, align: 'right', sortable: true },

        // text — the default editor, so `editor` can be left out entirely.
        {
            id: 'title',
            header: 'Title',
            flex: 1,
            minWidth: 170,
            sortable: true,
            editable: true,
            schema: rule((v) => (String(v).trim().length >= 3 ? null : 'At least 3 characters'))
        },

        // number — `parse` turns the editor's raw output into the stored value,
        // and runs before validation.
        {
            id: 'estimate',
            header: 'Estimate',
            width: 120,
            align: 'right',
            sortable: true,
            editable: true,
            editor: 'number',
            parse: (raw) => Math.round(Number(raw)),
            schema: rule((v) => {
                const n = Number(v)
                if (!Number.isFinite(n)) return 'Not a number'
                if (n <= 0) return 'Must be above zero'
                return n <= 40 ? null : 'No more than 40'
            })
        },

        // select — a short, fixed list.
        {
            id: 'priority',
            header: 'Priority',
            width: 140,
            sortable: true,
            type: 'badge',
            typeOptions: {
                colors: { Low: 'surface', Medium: 'info', High: 'warning', Critical: 'error' }
            },
            editable: true,
            editor: {
                type: 'select',
                options: priorities.map((p) => ({ label: p, value: p }))
            }
        },

        // selectMenu — the searchable one, for a list too long to scan.
        {
            id: 'assignee',
            header: 'Assignee',
            width: 150,
            sortable: true,
            editable: true,
            editor: {
                type: 'selectMenu',
                options: people.map((p) => ({ label: p, value: p }))
            },
            // Imperative validation sees the whole row, so it can state a rule
            // that spans columns — something a schema on one value cannot.
            validate: (value, row) =>
                row.priority === 'Critical' && !leads.includes(String(value))
                    ? 'Critical work goes to Ada or Grace'
                    : null
        },

        // checkbox — commits the moment it changes.
        {
            id: 'done',
            header: 'Done',
            width: 90,
            align: 'center',
            type: 'boolean',
            editable: true,
            editor: 'checkbox'
        },

        // date — typed segment by segment, committed on leaving.
        {
            id: 'due',
            header: 'Due',
            width: 150,
            sortable: true,
            type: 'date',
            editable: true,
            editor: 'date',
            schema: rule((v) => {
                const text = String(v ?? '')
                if (!isoDate.test(text)) return 'Pick a date'
                return text >= '2026-01-01' ? null : 'Not before 2026'
            })
        },

        // time — the same segmented entry, on a clock.
        {
            id: 'start',
            header: 'Start',
            width: 120,
            editable: true,
            editor: 'time',
            validate: (value) => {
                const [h] = String(value ?? '').split(':')
                const hour = Number(h)
                if (!Number.isFinite(hour)) return 'Pick a time'
                return hour >= 6 && hour < 22 ? null : 'Between 06:00 and 22:00'
            }
        },

        // textarea — multi-line, so Enter belongs to the widget.
        {
            id: 'notes',
            header: 'Notes',
            width: 220,
            editable: true,
            editor: 'textarea',
            schema: rule((v) =>
                String(v ?? '').length <= 80 ? null : 'Keep it under 80 characters'
            )
        },

        // rating — a widget, committing on change.
        {
            id: 'impact',
            header: 'Impact',
            width: 150,
            sortable: true,
            type: 'rating',
            typeOptions: { max: 5 },
            editable: true,
            editor: 'rating'
        },

        // tags — an array value.
        {
            id: 'labels',
            header: 'Labels',
            width: 190,
            editable: true,
            editor: 'tags',
            cell: labelsCell,
            schema: rule((v) => (Array.isArray(v) && v.length > 0 ? null : 'At least one label'))
        }
    ]

    const grid: GridState<Task> = createDataGrid<Task>({
        data: tasks,
        columns,
        getRowId: (task) => String(task.id),
        features: [sorting(), editing(), pagination({ pageSize: 8 })]
    })

    const editingState = getEditing(grid)!

    let log = $state<string[]>([])
    grid.events.on('cellEdited', ({ rowId, columnId, oldValue, newValue }) =>
        push(`${columnId} of row ${rowId}: ${short(oldValue)} → ${short(newValue)}`)
    )
    grid.events.on('rowEdited', ({ rowId, changes }) =>
        push(`row ${rowId}: ${Object.keys(changes).join(', ')}`)
    )

    function short(value: unknown): string {
        const text = JSON.stringify(value) ?? 'null'
        return text.length > 18 ? `${text.slice(0, 17)}…` : text
    }

    function push(line: string) {
        log = [line, ...log].slice(0, 8)
    }

    /** Row mode is decided when the feature is built, so this opens one by hand. */
    function editFocusedRow() {
        const node = grid.preWindowNodes[grid.focus.active.row]
        if (node) editingState.startRowEdit(node.id)
    }

    const rules: { column: string; how: string; rule: string }[] = [
        { column: 'Title', how: 'schema', rule: 'at least 3 characters' },
        { column: 'Estimate', how: 'parse + schema', rule: 'rounded, then 1–40' },
        { column: 'Assignee', how: 'validate', rule: 'Critical → chỉ Ada hoặc Grace' },
        { column: 'Due', how: 'schema', rule: 'a real date, not before 2026' },
        { column: 'Start', how: 'validate', rule: 'between 06:00 and 22:00' },
        { column: 'Notes', how: 'schema', rule: 'at most 80 characters' },
        { column: 'Labels', how: 'schema', rule: 'at least one label' }
    ]
</script>

{#snippet labelsCell({ value }: { value: unknown })}
    <div class="flex flex-wrap gap-1">
        {#each (value as string[]) ?? [] as label (label)}
            <Badge size="sm" color="surface">{label}</Badge>
        {/each}
    </div>
{/snippet}

<Container class="space-y-6 py-10">
    <div class="flex items-start justify-between gap-4">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">
                Editors — every type, with validation
            </h1>
            <p class="max-w-3xl text-sm text-on-surface-variant">
                Cả 10 editor dựng sẵn, mỗi cột kèm một luật kiểm tra. Nhập sai thì ô không ghi: viền
                đỏ, thông báo ngay dưới ô, giá trị cũ giữ nguyên cho tới khi hợp lệ.
                <kbd>Enter</kbd> mở ô đang chọn — select xổ list sẵn, gõ thẳng một ký tự cũng mở ·
                <kbd>Esc</kbd> huỷ · <kbd>Tab</kbd> ghi và sang phải ·
                <kbd>Ctrl</kbd>+<kbd>Enter</kbd> ghi mà đứng yên, kể cả ở ô mà <kbd>Enter</kbd>
                thuộc về chính editor.
            </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-4">
        <Button size="sm" variant="outline" onclick={editFocusedRow}>Sửa cả dòng đang chọn</Button>
        <Button
            size="sm"
            variant="outline"
            disabled={!editingState.canUndo}
            onclick={() => editingState.undo()}>Hoàn tác</Button
        >
        <Button
            size="sm"
            variant="outline"
            disabled={!editingState.canRedo}
            onclick={() => editingState.redo()}>Làm lại</Button
        >
        <p class="text-sm text-on-surface-variant">
            Nhấp đúp hoặc <kbd>Enter</kbd> / <kbd>F2</kbd> để mở ô đang chọn.
        </p>
    </div>

    <DataGrid {grid} />

    <div class="grid gap-4 lg:grid-cols-2">
        <Card class="space-y-3 p-4">
            <h2 class="font-medium text-on-surface">Luật kiểm tra</h2>
            <table class="w-full text-sm">
                <thead class="text-start text-xs text-on-surface-variant">
                    <tr>
                        <th class="pb-1 text-start font-medium">Cột</th>
                        <th class="pb-1 text-start font-medium">Cách khai</th>
                        <th class="pb-1 text-start font-medium">Luật</th>
                    </tr>
                </thead>
                <tbody class="text-on-surface-variant">
                    {#each rules as row (row.column)}
                        <tr class="border-t border-outline-variant">
                            <td class="py-1 text-on-surface">{row.column}</td>
                            <td class="py-1"><code class="text-xs">{row.how}</code></td>
                            <td class="py-1">{row.rule}</td>
                        </tr>
                    {/each}
                </tbody>
            </table>
            <p class="text-xs text-on-surface-variant">
                <code>schema</code> nhận bất kỳ standard-schema nào (zod, valibot, arktype).
                <code>validate</code> là bản mệnh lệnh, trả về thông báo lỗi hoặc <code>null</code>.
                <code>parse</code> chạy <em>trước</em> kiểm tra, biến giá trị thô của editor thành giá
                trị lưu.
            </p>
        </Card>

        <Card class="space-y-2 p-4">
            <h2 class="font-medium text-on-surface">Cần soi</h2>
            <ul class="list-inside list-disc space-y-1 text-sm text-on-surface-variant">
                <li>Nhập tiêu đề 1 ký tự — ô không ghi, thông báo hiện dưới ô.</li>
                <li>Estimate nhập 3.7 → <code>parse</code> làm tròn thành 4 rồi mới kiểm tra.</li>
                <li>Estimate nhập 99 — bị chặn, giá trị cũ còn nguyên.</li>
                <li>
                    Dòng Critical, đổi Assignee sang người khác — <code>validate</code> đọc cả dòng nên
                    chặn được luật liên cột.
                </li>
                <li>
                    Notes và Labels giữ <kbd>Enter</kbd> cho riêng chúng — xuống dòng, thêm nhãn —
                    nên ghi bằng <kbd>Ctrl</kbd>+<kbd>Enter</kbd>.
                </li>
                <li>Sửa cả dòng: mỗi ô sai báo riêng, cả dòng không ghi tới khi sạch.</li>
                <li>Hoàn tác/Làm lại đưa về đúng giá trị trước đó.</li>
            </ul>
            <div class="pt-1">
                <h3 class="text-xs font-medium text-on-surface-variant">Sự kiện</h3>
                <ul class="mt-1 space-y-0.5 font-mono text-xs text-on-surface-variant">
                    {#each log as line, i (`${i}-${line}`)}
                        <li>{line}</li>
                    {:else}
                        <li>—</li>
                    {/each}
                </ul>
            </div>
        </Card>
    </div>
</Container>
