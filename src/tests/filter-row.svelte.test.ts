import axe from 'axe-core'
import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import FiltersDemo from '../routes/filters/+page.svelte'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    editing,
    filtering,
    getEditing,
    getFiltering,
    selection,
    pagination,
    rowPinning,
    sorting,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'
import { viVN } from '$lib/locales/index.js'

interface Person {
    id: number
    name: string
    team: string
    age: number
    active: boolean
    joined?: string
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

const people: Person[] = [
    { id: 1, name: 'Ada', team: 'Core', age: 36, active: true },
    { id: 2, name: 'Grace', team: 'Core', age: 45, active: false },
    { id: 3, name: 'Linus', team: 'Tools', age: 29, active: true }
]

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name', width: 160, filter: 'text', sortable: true },
    { id: 'team', header: 'Team', width: 140, filter: 'set' },
    { id: 'age', header: 'Age', width: 120, filter: 'number', align: 'right' },
    { id: 'active', header: 'Active', width: 120, filter: 'boolean' },
    { id: 'note', header: 'Note', width: 140 }
]

function makeGrid(options: { withSelection?: boolean } = {}): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            filtering({ floatingRow: true }),
            ...(options.withSelection ? [selection<Person>()] : [])
        ]
    })
}

const filterRow = (container: Element) =>
    container.querySelector<HTMLElement>('[data-dg-cell^="-2:"]')?.closest('[role="row"]')

const filterCell = (container: Element, col: number) =>
    container.querySelector<HTMLElement>(`[data-dg-cell="-2:${col}"]`)!

const bodyRows = (container: Element) =>
    container.querySelectorAll('[role="row"][data-dg-row-id]').length

async function renderGrid(grid: GridState<Person>) {
    const screen = await render(TypedDataGrid, { grid })
    await expect.element(page.getByRole('grid')).toBeVisible()
    return screen
}

/** What `GridFilterCell` waits before a typed value reaches the model. */
const FILTER_DEBOUNCE_MS = 200

/**
 * Types through the driver and reports the most writes a working debounce could
 * have produced.
 *
 * Counting writes only means something against the time the typing took. The
 * browser driver round-trips once per key, and on a loaded machine that round
 * trip outlasts the window, so the debounce fires between keystrokes and a
 * write per key is correct rather than a regression. A debounce can write once
 * per window it is left alone for, plus once at the end, which is the bound
 * this returns: exactly 1 when the typing fitted in one window, which is what
 * an unloaded machine and CI do.
 */
async function typeWithin(keys: string) {
    const started = performance.now()
    await userEvent.keyboard(keys)
    return Math.floor((performance.now() - started) / FILTER_DEBOUNCE_MS) + 1
}

describe('the filter row', () => {
    it('draws one cell per column, and a field only where a filter is declared', async () => {
        const screen = await renderGrid(makeGrid())
        const row = filterRow(screen.container)!

        expect(row.querySelectorAll('[role="gridcell"]')).toHaveLength(columns.length)

        // One control per column, each the one its filter needs.
        const cell = (index: number) => filterCell(screen.container, index)
        expect(cell(0).querySelector('input:not([role])')).not.toBeNull() // text
        expect(cell(1).querySelector('[role="combobox"]')).not.toBeNull() // set
        expect(cell(2).querySelector('input[role="spinbutton"]')).not.toBeNull() // number
        expect(cell(3).querySelector('[data-select-trigger]')).not.toBeNull() // boolean
        // `note` declares no filter, so its cell stays empty.
        expect(cell(4).textContent?.trim()).toBe('')
    })

    it('is absent from a grid that did not ask for one', async () => {
        const grid = createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (row) => String(row.id),
            features: [filtering()]
        })
        const screen = await renderGrid(grid)

        expect(filterRow(screen.container)).toBeUndefined()
    })

    it('filters the rows from what is typed into it', async () => {
        const screen = await renderGrid(makeGrid())
        const input = filterCell(screen.container, 0).querySelector('input')!

        await userEvent.fill(input, 'gra')
        await expect.poll(() => bodyRows(screen.container), { timeout: 2000 }).toBe(1)
        await expect.element(page.getByRole('gridcell', { name: 'Grace' })).toBeVisible()

        await userEvent.clear(input)
        await expect.poll(() => bodyRows(screen.container), { timeout: 2000 }).toBe(3)
    })

    it('shows a filter set from anywhere else, and clears with it', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const input = () => filterCell(screen.container, 2).querySelector('input')!

        getFiltering(grid)!.setColumnFilter('age', { kind: 'number', op: 'gt', value: 30 })
        await expect.poll(() => input().value).toBe('30')
        await expect.poll(() => bodyRows(screen.container)).toBe(2)

        getFiltering(grid)!.clearColumnFilters()
        await expect.poll(() => input().value).toBe('')
    })

    it('keeps the operator the panel chose rather than resetting it', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        getFiltering(grid)!.setColumnFilter('name', { kind: 'text', op: 'startsWith', value: 'A' })

        const input = filterCell(screen.container, 0).querySelector('input')!
        await expect.poll(() => input.value).toBe('A')

        await userEvent.fill(input, 'G')
        await expect
            .poll(() => getFiltering(grid)!.columnFilters['name'], { timeout: 2000 })
            .toEqual({ kind: 'text', op: 'startsWith', value: 'G' })
    })

    it('ticks a set column inline, without opening the panel for it', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const cell = filterCell(screen.container, 1)

        // Nothing chosen reads as the any choice, the same word the boolean
        // column uses for it.
        expect(cell.textContent).toContain('(any)')

        await page.getByRole('button', { name: 'Team filter value' }).click()
        // The values come from the column, and only once the list is opened.
        await expect.element(page.getByRole('option', { name: 'Core' })).toBeVisible()
        await page.getByRole('option', { name: 'Core' }).click()

        await expect
            .poll(() => getFiltering(grid)!.columnFilters['team'], { timeout: 2000 })
            .toEqual({ kind: 'set', values: ['Core'] })
        await expect.poll(() => bodyRows(screen.container)).toBe(2)

        // A second value is the same one condition, with two values in it.
        await page.getByRole('option', { name: 'Tools' }).click()
        await expect
            .poll(() => getFiltering(grid)!.columnFilters['team'], { timeout: 2000 })
            .toEqual({ kind: 'set', values: ['Core', 'Tools'] })
        await expect.poll(() => bodyRows(screen.container)).toBe(3)
    })

    it('shows a set filter chosen elsewhere, and empties with it', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const cell = filterCell(screen.container, 1)

        getFiltering(grid)!.setColumnFilter('team', { kind: 'set', values: ['Core'] })
        await expect.poll(() => cell.textContent).toContain('Core')

        getFiltering(grid)!.clearColumnFilters()
        await expect.poll(() => cell.textContent).toContain('(any)')
    })

    it('hands a set column back to the panel when it holds something else', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        // Not a shape this row wrote, so it is not one it may flatten.
        getFiltering(grid)!.setColumnFilter('team', { kind: 'text', op: 'contains', value: 'Co' })

        const cell = filterCell(screen.container, 1)
        await expect.poll(() => cell.querySelector('[role="combobox"]')).toBeNull()
        expect(cell.textContent).toContain('Co')
    })

    it('draws a boolean column as a choice that says what it is set to', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const trigger = () =>
            filterCell(screen.container, 3).querySelector<HTMLElement>('[data-select-trigger]')!

        // Not an empty control: unfiltered reads as the any choice.
        expect(trigger().textContent?.trim()).toBe('(any)')

        getFiltering(grid)!.setColumnFilter('active', { kind: 'boolean', value: true })
        await expect.poll(() => trigger().textContent?.trim()).toBe('True')

        getFiltering(grid)!.clearColumnFilters()
        await expect.poll(() => trigger().textContent?.trim()).toBe('(any)')
    })

    it('filters from the boolean choice, and clears back to any', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        // The sv5ui Select is a button opening a portalled listbox.
        const open = () => page.getByRole('button', { name: 'Active filter value' }).click()

        await open()
        await page.getByRole('option', { name: 'False', exact: true }).click()

        await expect
            .poll(() => getFiltering(grid)!.columnFilters['active'])
            .toEqual({
                kind: 'boolean',
                value: false
            })
        await expect.poll(() => bodyRows(screen.container)).toBe(1)

        await open()
        await page.getByRole('option', { name: '(any)', exact: true }).click()
        await expect.poll(() => getFiltering(grid)!.columnFilters['active']).toBeUndefined()
        await expect.poll(() => bodyRows(screen.container)).toBe(3)
    })

    it('opens the column one panel, not a second of its own', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        // A range needs two bounds, so this cell is the one that asks.
        getFiltering(grid)!.setColumnFilter('age', {
            kind: 'number',
            op: 'between',
            value: 30,
            to: 40
        })
        const cell = filterCell(screen.container, 2)
        await expect.poll(() => cell.querySelector('button')).not.toBeNull()

        // The row asks; the header's panel answers. Two instances of the panel
        // for one column both read the same open flag and both appear.
        await cell.querySelector<HTMLElement>('button')!.click()

        await expect.poll(() => document.querySelectorAll('[role="dialog"]').length).toBe(1)
        expect(getFiltering(grid)!.filterFor).toBe('age')

        await cell.querySelector<HTMLElement>('button')!.click()
        await expect.poll(() => document.querySelectorAll('[role="dialog"]').length).toBe(0)
    })

    it('says what a filter the row cannot hold contains', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        getFiltering(grid)!.setColumnFilter('age', {
            kind: 'group',
            join: 'and',
            conditions: [
                { kind: 'number', op: 'gt', value: 30 },
                { kind: 'number', op: 'lt', value: 40 }
            ]
        })

        const cell = filterCell(screen.container, 2)
        await expect.poll(() => cell.querySelector('input')).toBeNull()
        expect(cell.textContent).toContain('30')
        expect(cell.textContent).toContain('40')
    })

    it('numbers the rows below it under it', async () => {
        const screen = await renderGrid(makeGrid())
        const grid = screen.container.querySelector('[role="grid"]')!

        // One header row plus the filter row plus three body rows.
        expect(grid.getAttribute('aria-rowcount')).toBe('5')
        expect(filterRow(screen.container)!.getAttribute('aria-rowindex')).toBe('2')
        expect(
            screen.container
                .querySelector('[role="row"][data-dg-row-id]')
                ?.getAttribute('aria-rowindex')
        ).toBe('3')
    })

    it('is reached and left by keyboard, with the caret landing in the field', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        grid.focus.focusCell({ row: -1, col: 0 })
        const header = screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:0"]')!
        header.focus()

        await userEvent.keyboard('{ArrowDown}')
        await expect.poll(() => grid.focus.active).toEqual({ row: -2, col: 0 })
        // The cell passes focus on, or the row could be reached and not typed in.
        await expect.poll(() => document.activeElement?.tagName).toBe('INPUT')

        await userEvent.keyboard('{ArrowDown}')
        await expect.poll(() => grid.focus.active).toEqual({ row: 0, col: 0 })

        await userEvent.keyboard('{ArrowUp}')
        await expect.poll(() => grid.focus.active).toEqual({ row: -2, col: 0 })
    })

    it('leaves the synthetic selection column empty', async () => {
        const screen = await renderGrid(makeGrid({ withSelection: true }))
        expect(filterCell(screen.container, 0).textContent?.trim()).toBe('')
    })

    it('is axe-clean', async () => {
        const screen = await renderGrid(makeGrid())
        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(
            results.violations.flatMap((violation) =>
                violation.nodes.map((node) => `${violation.id}: ${node.html.slice(0, 160)}`)
            )
        ).toEqual([])
    })

    it('turns off while the grid is up, taking the numbering with it', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        expect(filterRow(screen.container)).toBeDefined()

        getFiltering(grid)!.floatingRow = false

        await expect.poll(() => filterRow(screen.container)).toBeUndefined()
        await expect
            .poll(() =>
                screen.container.querySelector('[role="grid"]')?.getAttribute('aria-rowcount')
            )
            .toBe('4')
        expect(grid.focus.headerLines).toBe(1)
    })
})

describe('the data ops demo', () => {
    it('opens with the row, and the checkbox takes it away', async () => {
        const screen = await render(FiltersDemo as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        expect(filterRow(screen.container)).toBeDefined()

        await page.getByRole('checkbox', { name: 'Hiện hàng filter' }).click()
        await expect.poll(() => filterRow(screen.container)).toBeUndefined()
    })

    it('pins with the column it belongs to', async () => {
        const grid = createDataGrid<Person>({
            columns: columns.map((column) =>
                column.id === 'name' ? { ...column, pinned: 'left' as const } : column
            ),
            data: people,
            getRowId: (row) => String(row.id),
            features: [filtering({ floatingRow: true }), columnOps()]
        })
        const screen = await renderGrid(grid)

        const cell = filterCell(screen.container, 0)
        expect(getComputedStyle(cell).position).toBe('sticky')
        // And the cell beside it, on an unpinned column, does not.
        expect(getComputedStyle(filterCell(screen.container, 2)).position).not.toBe('sticky')
    })

    it('draws the same column window the header does', async () => {
        const many: ColumnDef<Person>[] = Array.from({ length: 60 }, (_, i) => ({
            id: `c${i}`,
            header: `C${i}`,
            width: 160,
            filter: 'text'
        }))
        const grid = createDataGrid<Person>({
            columns: many,
            data: people,
            getRowId: (row) => String(row.id),
            features: [filtering({ floatingRow: true }), virtualization({ columns: true })]
        })
        const screen = await renderGrid(grid)

        const drawn = (selector: string) => screen.container.querySelectorAll(selector).length
        const headerCells = drawn('[data-dg-cell^="-1:"]')
        expect(headerCells).toBeGreaterThan(0)
        expect(headerCells).toBeLessThan(many.length)
        // One filter cell per drawn header cell: the row cannot lag the window
        // it shares, or a field would sit over the wrong column.
        expect(drawn('[data-dg-cell^="-2:"]')).toBe(headerCells)
    })

    it('does not open a cell editor from what is typed into it', async () => {
        const grid = createDataGrid<Person>({
            columns: columns.map((column) => ({ ...column, editable: true })),
            data: people,
            getRowId: (row) => String(row.id),
            features: [filtering({ floatingRow: true }), editing()]
        })
        const screen = await renderGrid(grid)

        const input = filterCell(screen.container, 0).querySelector('input')!
        input.focus()
        await userEvent.keyboard('a')

        // Type-to-edit reads the focused row, and the filter row is not one.
        expect(getEditing(grid)!.active).toBeNull()
        expect(getEditing(grid)!.rowEditId).toBeNull()
        await expect.poll(() => input.value).toBe('a')
    })

    it('keeps working on one page of a server', async () => {
        const grid = createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [filtering({ floatingRow: true })]
        })
        const screen = await renderGrid(grid)
        const input = filterCell(screen.container, 0).querySelector('input')!

        await userEvent.fill(input, 'ada')
        // The model is what an app forwards; the rows stay as the server sent
        // them, because filtering them again would drop rows it meant to send.
        await expect
            .poll(() => getFiltering(grid)!.columnFilters['name'], { timeout: 2000 })
            .toEqual({ kind: 'text', op: 'contains', value: 'ada' })
        expect(bodyRows(screen.container)).toBe(3)
    })

    it('speaks the language the grid was given', async () => {
        const grid = createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (row) => String(row.id),
            locale: 'vi-VN',
            locales: [viVN],
            features: [filtering({ floatingRow: true })]
        })
        const screen = await renderGrid(grid)

        expect(
            filterCell(screen.container, 0).querySelector('input')!.getAttribute('aria-label')
        ).toBe('Giá trị lọc Name')
        expect(
            filterCell(screen.container, 3)
                .querySelector('[data-select-trigger]')!
                .textContent?.trim()
        ).toBe('(bất kỳ)')
    })

    it('leaves the arrow keys to a choice while its list is open', async () => {
        const grid = makeGrid()
        await renderGrid(grid)
        await page.getByRole('button', { name: 'Active filter value' }).click()
        await expect.element(page.getByRole('listbox')).toBeVisible()

        const before = { ...grid.focus.active }
        await userEvent.keyboard('{ArrowDown}')

        // The list is moving its own highlight; the grid must not also move.
        expect(grid.focus.active).toEqual(before)
    })

    it('counts the header group levels above it', async () => {
        const grid = createDataGrid<Person>({
            columns: [
                {
                    id: 'who',
                    header: 'Who',
                    children: [
                        { id: 'name', header: 'Name', width: 160, filter: 'text' },
                        { id: 'team', header: 'Team', width: 140, filter: 'text' }
                    ]
                },
                { id: 'age', header: 'Age', width: 120, filter: 'number' }
            ],
            data: people,
            getRowId: (row) => String(row.id),
            features: [filtering({ floatingRow: true })]
        })
        const screen = await renderGrid(grid)

        // Group level, leaf header, filter row, then the three body rows.
        expect(screen.container.querySelector('[role="grid"]')?.getAttribute('aria-rowcount')).toBe(
            '6'
        )
        expect(filterRow(screen.container)!.getAttribute('aria-rowindex')).toBe('3')
        expect(
            screen.container
                .querySelector('[role="row"][data-dg-row-id]')
                ?.getAttribute('aria-rowindex')
        ).toBe('4')
    })

    it('filters a number column through the sv5ui number field', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const cell = filterCell(screen.container, 2)

        // The number widget, not a bare text box: a spinbutton with the
        // steppers taken out of the way.
        const input = cell.querySelector<HTMLInputElement>('input[role="spinbutton"]')!
        expect(input).not.toBeNull()
        expect(cell.querySelector('input[type="text"]:not([role])')).toBeNull()

        await userEvent.fill(input, '40')
        await expect
            .poll(() => getFiltering(grid)!.columnFilters['age'], { timeout: 2000 })
            .toEqual({ kind: 'number', op: 'eq', value: 40 })
    })

    it('filters a date column through the picker rather than a browser field', async () => {
        const grid = createDataGrid<Person>({
            columns: [
                { id: 'name', header: 'Name', width: 160, filter: 'text' },
                { id: 'joined', header: 'Joined', width: 220, filter: 'date' }
            ],
            data: [
                { ...people[0]!, joined: '2026-01-05' },
                { ...people[1]!, joined: '2026-02-09' }
            ] as Person[],
            getRowId: (row) => String(row.id),
            features: [filtering({ floatingRow: true })]
        })
        const screen = await renderGrid(grid)
        const cell = filterCell(screen.container, 1)

        expect(cell.querySelector('input[type="date"]')).toBeNull()
        expect(cell.querySelectorAll('[role="spinbutton"]')).toHaveLength(3)
        expect(cell.querySelector('button[aria-label="Open calendar"]')).not.toBeNull()

        getFiltering(grid)!.setColumnFilter('joined', {
            kind: 'date',
            op: 'equals',
            value: '2026-01-05'
        })
        await expect.poll(() => cell.textContent).toContain('2026')
        await expect.poll(() => bodyRows(screen.container)).toBe(1)

        // A picker has no clear of its own, so the cell carries one.
        await page.getByRole('button', { name: 'Remove filter Joined' }).click()
        await expect.poll(() => getFiltering(grid)!.columnFilters['joined']).toBeUndefined()
        await expect.poll(() => bodyRows(screen.container)).toBe(2)
    })

    it('writes the date in the language the grid speaks', async () => {
        const grid = createDataGrid<Person>({
            columns: [{ id: 'joined', header: 'Joined', width: 240, filter: 'date' }],
            data: [{ ...people[0]!, joined: '2026-01-05' }] as Person[],
            getRowId: (row) => String(row.id),
            locale: 'vi-VN',
            locales: [viVN],
            features: [filtering({ floatingRow: true })]
        })
        const screen = await renderGrid(grid)
        getFiltering(grid)!.setColumnFilter('joined', {
            kind: 'date',
            op: 'equals',
            value: '2026-01-05'
        })

        // Day before month, as the language writes it.
        await expect
            .poll(() => filterCell(screen.container, 0).textContent?.replace(/\s+/g, ''))
            .toContain('05/01/2026')
    })

    /**
     * A segmented date field reports every keystroke. Typing 01/05/2026 walks
     * the year through 2, 20 and 202, and each of those is a complete date as
     * far as the field is concerned. Un-debounced, that was three filters over
     * the whole set, the first two on years nobody asked for, and the last of
     * them left the model empty because the value pushed back into the field
     * was one the typing had already moved past.
     */
    it('writes the model once for a date typed a digit at a time', async () => {
        const grid = createDataGrid<Person>({
            columns: [{ id: 'joined', header: 'Joined', width: 260, filter: 'date' }],
            data: [
                { ...people[0]!, joined: '2026-01-05' },
                { ...people[1]!, joined: '2026-02-09' }
            ] as Person[],
            getRowId: (row) => String(row.id),
            features: [filtering({ floatingRow: true })]
        })
        let writes = 0
        grid.events.on('filterChanged', () => writes++)

        const screen = await renderGrid(grid)
        const cell = filterCell(screen.container, 0)
        cell.querySelector<HTMLElement>('[role="spinbutton"]')!.focus()

        const windows = await typeWithin('01052026')

        await expect
            .poll(() => getFiltering(grid)!.columnFilters['joined'], { timeout: 2000 })
            .toEqual({ kind: 'date', op: 'equals', value: '2026-01-05' })
        expect(writes).toBeLessThanOrEqual(windows)
        await expect.poll(() => bodyRows(screen.container)).toBe(1)
    })

    it('writes the model once for a number typed a digit at a time', async () => {
        const grid = makeGrid()
        let writes = 0
        grid.events.on('filterChanged', () => writes++)
        const screen = await renderGrid(grid)

        const input = filterCell(screen.container, 2).querySelector<HTMLInputElement>(
            'input[role="spinbutton"]'
        )!
        input.focus()
        const windows = await typeWithin('365')

        await expect
            .poll(() => getFiltering(grid)!.columnFilters['age'], { timeout: 2000 })
            .toEqual({ kind: 'number', op: 'eq', value: 365 })
        expect(writes).toBeLessThanOrEqual(windows)
    })

    it('clears a picked date at once rather than after the wait', async () => {
        const grid = createDataGrid<Person>({
            columns: [{ id: 'joined', header: 'Joined', width: 260, filter: 'date' }],
            data: [{ ...people[0]!, joined: '2026-01-05' }] as Person[],
            getRowId: (row) => String(row.id),
            features: [filtering({ floatingRow: true })]
        })
        const screen = await renderGrid(grid)
        getFiltering(grid)!.setColumnFilter('joined', {
            kind: 'date',
            op: 'equals',
            value: '2026-01-05'
        })

        const clear = page.getByRole('button', { name: 'Remove filter Joined' })
        await expect.element(clear).toBeVisible()
        await clear.click()

        // A finished gesture, so no debounce stands between it and the model.
        expect(getFiltering(grid)!.columnFilters['joined']).toBeUndefined()
        expect(filterCell(screen.container, 0).textContent).not.toContain('2026')
    })

    it('writes a percent column in the units the row stores, not the ones it draws', async () => {
        const grid = createDataGrid<Person>({
            columns: [
                {
                    id: 'age',
                    header: 'Rate',
                    width: 200,
                    type: 'percent',
                    filter: 'number'
                }
            ],
            data: [
                { ...people[0]!, age: 0.05 },
                { ...people[1]!, age: 0.5 }
            ],
            getRowId: (row) => String(row.id),
            features: [filtering({ floatingRow: true })]
        })
        const screen = await renderGrid(grid)
        const input = filterCell(screen.container, 0).querySelector<HTMLInputElement>(
            'input[role="spinbutton"]'
        )!

        // 5 in the field is 5%, and 5% is 0.05 in the row.
        await userEvent.fill(input, '5')
        await expect
            .poll(() => getFiltering(grid)!.columnFilters['age'], { timeout: 2000 })
            .toEqual({ kind: 'number', op: 'eq', value: 0.05 })
        await expect.poll(() => bodyRows(screen.container)).toBe(1)

        // And back the other way: what the panel stored reads as 50, not 0.5.
        getFiltering(grid)!.setColumnFilter('age', { kind: 'number', op: 'eq', value: 0.5 })
        await expect.poll(() => input.value).toBe('50')
    })

    it('keeps Match case on when the row is typed into next', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        getFiltering(grid)!.setColumnFilter('name', {
            kind: 'text',
            op: 'contains',
            value: 'a',
            caseSensitive: true
        })

        const input = filterCell(screen.container, 0).querySelector('input')!
        await expect.poll(() => input.value).toBe('a')
        await userEvent.fill(input, 'AD')

        await expect
            .poll(() => getFiltering(grid)!.columnFilters['name'], { timeout: 2000 })
            .toEqual({ kind: 'text', op: 'contains', value: 'AD', caseSensitive: true })
    })

    it('leaves room for itself above the rows pinned to the top', async () => {
        const grid = createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (row) => String(row.id),
            features: [
                filtering({ floatingRow: true }),
                rowPinning({ isRowPinned: (row) => (row.id === 1 ? 'top' : null) })
            ]
        })
        const screen = await renderGrid(grid)

        // The pinned block sticks below the header, and the header is one row
        // taller than it was.
        const row = filterRow(screen.container)!.getBoundingClientRect()
        const pinned = screen.container
            .querySelector('[data-dg-pinned-cell^="top:"]')!
            .getBoundingClientRect()
        expect(pinned.top).toBeGreaterThanOrEqual(row.bottom - 1)
    })

    it('hands the caret back to the header when it is switched off under it', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        grid.focus.focusCell({ row: -2, col: 0 })
        await expect
            .poll(() => screen.container.querySelectorAll('[data-dg-cell][tabindex="0"]').length)
            .toBe(1)

        getFiltering(grid)!.floatingRow = false

        // A grid whose only tab stop was a row it no longer draws cannot be
        // tabbed into at all.
        await expect.poll(() => grid.focus.active).toEqual({ row: -1, col: 0 })
        expect(screen.container.querySelectorAll('[data-dg-cell][tabindex="0"]')).toHaveLength(1)
    })

    it('keeps a field inside a narrow column', async () => {
        const grid = createDataGrid<Person>({
            columns: [
                { id: 'name', header: 'N', width: 70, filter: 'text' },
                { id: 'age', header: 'A', width: 70, filter: 'number' }
            ],
            data: people,
            getRowId: (row) => String(row.id),
            features: [filtering({ floatingRow: true })]
        })
        const screen = await renderGrid(grid)

        for (const index of [0, 1]) {
            const cell = filterCell(screen.container, index).getBoundingClientRect()
            const field = filterCell(screen.container, index)
                .querySelector('input')!
                .getBoundingClientRect()
            expect(Math.round(field.right)).toBeLessThanOrEqual(Math.round(cell.right))
            expect(Math.round(field.left)).toBeGreaterThanOrEqual(Math.round(cell.left))
        }
    })

    it('keeps a header trigger on screen while its own panel is open', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        // The bare token, not the `group-hover:` and `hover:none` variants
        // the base class already carries.
        const pinned = () =>
            screen.container
                .querySelector('[data-dg-cell="-1:0"]')!
                .querySelector('[data-dg-noreorder]')!
                .className.split(/\s+/)
                .includes('opacity-100')

        // Hidden until hovered, so the header label gets the cell.
        expect(pinned()).toBe(false)

        // What the column menu's Filter item does, and what the filter row
        // does for a column it hands back to the panel.
        getFiltering(grid)!.filterFor = 'name'

        // The panel is anchored to that trigger and portalled away from it, so
        // `focus-within` cannot hold it on screen by itself.
        await expect.poll(pinned).toBe(true)
        await expect.element(page.getByRole('dialog', { name: 'Filter Name' })).toBeVisible()
    })

    it('lands the caret on the first date segment, not on the calendar button', async () => {
        const grid = createDataGrid<Person>({
            columns: [{ id: 'joined', header: 'Joined', width: 240, filter: 'date' }],
            data: [{ ...people[0]!, joined: '2026-01-05' }] as Person[],
            getRowId: (row) => String(row.id),
            features: [filtering({ floatingRow: true })]
        })
        const screen = await renderGrid(grid)

        const header = screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:0"]')!
        grid.focus.focusCell({ row: -1, col: 0 })
        header.focus()
        await userEvent.keyboard('{ArrowDown}')

        await expect.poll(() => document.activeElement?.getAttribute('role')).toBe('spinbutton')
        // The first of the three, so the date can be typed from its start.
        const segments = [
            ...filterCell(screen.container, 0).querySelectorAll('[role="spinbutton"]')
        ]
        expect(segments[0]).toBe(document.activeElement)
    })

    it('shows a filter the grid was built with, before anything is typed', async () => {
        const grid = createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (row) => String(row.id),
            features: [
                filtering({
                    floatingRow: true,
                    initialColumns: { name: { kind: 'text', op: 'contains', value: 'ada' } }
                })
            ]
        })
        const screen = await renderGrid(grid)

        expect(filterCell(screen.container, 0).querySelector('input')!.value).toBe('ada')
        expect(bodyRows(screen.container)).toBe(1)
    })

    it('reads a set column for its values only once the list is opened', async () => {
        let reads = 0
        const many = Array.from({ length: 500 }, (_, i) => ({
            ...people[0]!,
            id: i + 1,
            team: `T${i % 7}`
        }))
        const grid = createDataGrid<Person>({
            columns: [
                {
                    id: 'team',
                    header: 'Team',
                    width: 220,
                    filter: 'set',
                    // Every read of this column passes through here.
                    accessor: (row) => {
                        reads++
                        return row.team
                    }
                }
            ],
            data: many,
            getRowId: (row) => String(row.id),
            features: [filtering({ floatingRow: true }), pagination({ pageSize: 10 })]
        })
        await renderGrid(grid)

        // A page of ten cells, not a pass over five hundred rows: drawing a
        // filter row nobody has touched must not scan the whole column.
        const drawn = reads
        expect(drawn).toBeLessThan(100)

        await page.getByRole('button', { name: 'Team filter value' }).click()
        await expect.element(page.getByRole('option', { name: 'T0' })).toBeVisible()

        // And now it has read them all, once.
        expect(reads - drawn).toBeGreaterThanOrEqual(500)
    })
})
