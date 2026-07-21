<script lang="ts">
    import { Badge, Button, Container, Kbd, Link, Rating, ThemeModeButton } from 'sv5ui'
    import type { StandardSchemaV1 } from '@standard-schema/spec'
    import {
        createDataGrid,
        DataGrid,
        editing,
        filtering,
        getEditing,
        pagination,
        sorting,
        type ColumnDef,
        type DataGridCellContext
    } from '$lib/index.js'

    interface Employee {
        id: number
        name: string
        email: string
        salary: number
        dept: string
        active: boolean
        joined: string
        rating: number
        skills: string[]
    }

    const firstNames = ['Alice', 'Bob', 'Charlie', 'Diana', 'Ethan', 'Fiona', 'George', 'Hana']
    const lastNames = ['Nguyen', 'Tran', 'Le', 'Pham', 'Vo', 'Dang', 'Ho', 'Bui']
    const depts = ['Core', 'Platform', 'Growth', 'Data', 'Infra', 'Design']
    const skillPool = ['svelte', 'ts', 'rust', 'go', 'css', 'sql', 'a11y']

    const employees: Employee[] = Array.from({ length: 2000 }, (_, i) => ({
        id: i + 1,
        name: `${firstNames[i % 8]} ${lastNames[Math.floor(i / 8) % 8]}`,
        email: `user${i + 1}@example.com`,
        salary: 40_000 + (i % 100) * 850,
        dept: depts[i % 6],
        active: i % 4 !== 0,
        joined: `20${20 + (i % 6)}-${String((i % 12) + 1).padStart(2, '0')}-15`,
        rating: (i % 5) + 1,
        skills: [skillPool[i % 7], skillPool[(i + 3) % 7]]
    }))

    const deptColors: Record<string, 'primary' | 'tertiary' | 'success' | 'info' | 'warning'> = {
        Core: 'primary',
        Platform: 'tertiary',
        Growth: 'success',
        Data: 'info',
        Infra: 'warning',
        Design: 'primary'
    }

    const money = new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
    })

    // A hand-rolled standard-schema — any zod/valibot/arktype schema works the same way.
    function schema(check: (value: unknown) => string | null): StandardSchemaV1 {
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

    const emailRe = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

    const columns: ColumnDef<Employee>[] = [
        { id: 'id', header: '#', sortable: true, align: 'right', width: 80 },
        {
            id: 'name',
            header: 'Name',
            sortable: true,
            flex: 1,
            minWidth: 160,
            editable: true,
            schema: schema((v) => (String(v).trim().length >= 2 ? null : 'At least 2 characters'))
        },
        {
            id: 'email',
            header: 'Email',
            flex: 1,
            minWidth: 200,
            editable: true,
            schema: schema((v) => (emailRe.test(String(v)) ? null : 'Invalid email'))
        },
        {
            id: 'salary',
            header: 'Salary',
            sortable: true,
            align: 'right',
            width: 130,
            editable: true,
            editor: 'number',
            schema: schema((v) => (Number(v) >= 0 ? null : 'Must be ≥ 0')),
            cell: moneyCell
        },
        {
            id: 'dept',
            header: 'Dept',
            sortable: true,
            width: 150,
            editable: true,
            editor: { type: 'selectMenu', options: depts.map((d) => ({ label: d, value: d })) },
            cell: deptCell
        },
        {
            id: 'rating',
            header: 'Rating',
            sortable: true,
            width: 150,
            editable: true,
            editor: 'rating',
            cell: ratingCell
        },
        {
            id: 'skills',
            header: 'Skills',
            width: 200,
            editable: true,
            editor: 'tags',
            cell: skillsCell
        },
        {
            id: 'active',
            header: 'Active',
            width: 110,
            editable: true,
            editor: 'checkbox',
            cell: activeCell
        },
        {
            id: 'joined',
            header: 'Joined',
            sortable: true,
            width: 160,
            editable: true,
            editor: 'date'
        }
    ]

    let rowMode = $state(false)

    const grid = createDataGrid<Employee>({
        data: employees,
        columns,
        getRowId: (employee) => String(employee.id),
        features: [filtering(), sorting(), editing({ mode: 'cell' }), pagination({ pageSize: 12 })]
    })
    const editingState = getEditing(grid)!

    let lastEdit = $state('')
    grid.events.on('cellEdited', ({ rowId, columnId, oldValue, newValue }) => {
        lastEdit = `row ${rowId} · ${columnId}: ${JSON.stringify(oldValue)} → ${JSON.stringify(newValue)}`
    })
    grid.events.on('rowEdited', ({ rowId, changes }) => {
        lastEdit = `row ${rowId} · ${JSON.stringify(changes)}`
    })

    function toggleRowMode() {
        rowMode = !rowMode
        editingState.cancel()
        editingState.cancelRow()
    }

    function startRowEditFocused() {
        const node = grid.preWindowNodes[Math.max(0, grid.focus.active.row)]
        if (node) editingState.startRowEdit(node.id)
    }
</script>

{#snippet deptCell({ value }: DataGridCellContext<Employee>)}
    <Badge label={String(value)} color={deptColors[String(value)] ?? 'surface'} size="sm" />
{/snippet}

{#snippet moneyCell({ value }: DataGridCellContext<Employee>)}
    {money.format(Number(value))}
{/snippet}

{#snippet activeCell({ value }: DataGridCellContext<Employee>)}
    {value ? '✓' : '—'}
{/snippet}

{#snippet ratingCell({ value }: DataGridCellContext<Employee>)}
    <Rating value={Number(value)} readonly size="sm" />
{/snippet}

{#snippet skillsCell({ value }: DataGridCellContext<Employee>)}
    <span class="flex flex-wrap gap-1">
        {#each value as string[] as skill (skill)}
            <Badge label={skill} size="xs" color="surface" />
        {/each}
    </span>
{/snippet}

<Container class="space-y-6 py-10">
    <div class="flex items-center justify-between">
        <div class="space-y-1">
            <h1 class="text-2xl font-semibold text-on-surface">Inline editing — Phase 7</h1>
            <p class="text-sm text-on-surface-variant">
                {employees.length.toLocaleString()} hàng · editor sv5ui: Input / InputNumber / SelectMenu
                / Rating / InputTags / Checkbox / DatePicker · validation standard-schema · undo/redo
                · row edit mode. Tất cả ở Community.
            </p>
        </div>
        <div class="flex items-center gap-2">
            <Link href="/">← Home</Link>
            <ThemeModeButton />
        </div>
    </div>

    <div class="flex flex-wrap items-center gap-2">
        <Button
            variant="outline"
            size="sm"
            icon="lucide:undo-2"
            label="Undo"
            disabled={!editingState.canUndo}
            onclick={editingState.undo}
        />
        <Button
            variant="outline"
            size="sm"
            icon="lucide:redo-2"
            label="Redo"
            disabled={!editingState.canRedo}
            onclick={editingState.redo}
        />
        {#if rowMode}
            <Button
                variant="outline"
                size="sm"
                label="Edit focused row"
                onclick={startRowEditFocused}
            />
            {#if editingState.rowEditId}
                <Button size="sm" label="Save row" onclick={() => void editingState.commitRow()} />
                <Button variant="ghost" size="sm" label="Cancel" onclick={editingState.cancelRow} />
            {/if}
        {/if}
        <div class="grow"></div>
        <Button
            variant={rowMode ? 'solid' : 'outline'}
            size="sm"
            label={rowMode ? 'Row edit mode: on' : 'Row edit mode: off'}
            onclick={toggleRowMode}
        />
    </div>

    <DataGrid {grid} toolbar />

    {#if lastEdit}
        <div
            class="rounded-lg border border-outline-variant bg-surface-container px-3 py-2 text-xs text-on-surface-variant"
        >
            Last transaction: <code>{lastEdit}</code>
        </div>
    {/if}

    <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-on-surface-variant">
        <span>Sửa ô:</span>
        <span
            >double-click hoặc <Kbd size="sm">Enter</Kbd> / <Kbd size="sm">F2</Kbd> / gõ để bắt đầu</span
        >
        <span><Kbd size="sm">Enter</Kbd> lưu + xuống · <Kbd size="sm">Tab</Kbd> lưu + phải</span>
        <span><Kbd size="sm">Esc</Kbd> huỷ</span>
        <span
            ><Kbd size="sm">Ctrl</Kbd>+<Kbd size="sm">Z</Kbd> undo · <Kbd size="sm">Ctrl</Kbd>+<Kbd
                size="sm">Shift</Kbd
            >+<Kbd size="sm">Z</Kbd> redo</span
        >
    </div>
</Container>
