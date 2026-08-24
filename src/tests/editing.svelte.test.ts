import type { StandardSchemaV1 } from '@standard-schema/spec'
import axe from 'axe-core'
import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    editing,
    getEditing,
    getPagination,
    pagination,
    sorting,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type EditingOptions,
    type GridState
} from '$lib/index.js'

interface Person {
    id: number
    name: string
    age: number
    dept: string
    active: boolean
    rating: number
    skills: string[]
    joined: string
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

const minLen: StandardSchemaV1 = {
    '~standard': {
        version: 1,
        vendor: 'test',
        validate: (value: unknown) =>
            String(value).trim().length >= 2
                ? { value: String(value).trim() }
                : { issues: [{ message: 'Too short' }] }
    }
}

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name', flex: 1, minWidth: 160, editable: true, schema: minLen },
    {
        id: 'age',
        header: 'Age',
        width: 120,
        editable: true,
        editor: 'number',
        parse: (input) => Number(input)
    },
    {
        id: 'dept',
        header: 'Dept',
        width: 150,
        editable: true,
        editor: {
            type: 'select',
            options: [
                { label: 'Core', value: 'Core' },
                { label: 'Data', value: 'Data' }
            ]
        }
    },
    { id: 'active', header: 'Active', width: 110, editable: true, editor: 'checkbox' },
    { id: 'rating', header: 'Rating', width: 160, editable: true, editor: 'rating' },
    { id: 'skills', header: 'Skills', width: 200, editable: true, editor: 'tags' },
    { id: 'joined', header: 'Joined', width: 190, editable: true, editor: 'date' }
]

function makeData(count: number): Person[] {
    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `${['Alice', 'Bob', 'Carol', 'Dave'][i % 4]}${i >= 4 ? i : ''}`,
        age: 20 + i,
        dept: i % 2 === 0 ? 'Core' : 'Data',
        active: i % 2 === 0,
        rating: (i % 5) + 1,
        skills: ['svelte', 'ts'],
        joined: '2020-01-15'
    }))
}

function makeGrid(
    options: EditingOptions = {},
    { rows = 4, virtual = false }: { rows?: number; virtual?: boolean } = {}
): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: makeData(rows),
        getRowId: (person) => String(person.id),
        features: [
            sorting(),
            editing(options),
            virtual ? virtualization({ rowHeight: 40, initialRows: 12 }) : pagination({})
        ]
    })
}

function cellAt(container: Element, row: number, col: number): HTMLElement {
    return container.querySelector<HTMLElement>(`[data-dg-cell="${row}:${col}"]`)!
}

async function renderGrid(grid: GridState<Person>, props: Record<string, unknown> = {}) {
    const screen = await render(TypedDataGrid, { grid, ...props })
    await expect.element(screen.getByRole('grid')).toBeVisible()
    return screen
}

describe('cell editing', () => {
    it('double-click opens an editor, typing + Enter commits and moves down', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        cellAt(screen.container, 0, 0).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        const input = page.getByRole('textbox').first()
        await expect.element(input).toBeVisible()

        await input.fill('Alicia')
        await userEvent.keyboard('{Enter}')

        expect(grid.data[0].name).toBe('Alicia')
        expect(grid.focus.active).toEqual({ row: 1, col: 0 })
        expect(cellAt(screen.container, 0, 0).textContent).toContain('Alicia')
    })

    it('Escape cancels without writing', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        cellAt(screen.container, 1, 0).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await page.getByRole('textbox').first().fill('Zzz')
        await userEvent.keyboard('{Escape}')

        expect(grid.data[1].name).toBe('Bob')
        expect(getEditing(grid)!.active).toBeNull()
    })

    it('blocks an invalid commit, keeps the editor open with an alert', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        cellAt(screen.container, 0, 0).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await page.getByRole('textbox').first().fill('x')
        await userEvent.keyboard('{Enter}')

        await expect.element(page.getByRole('alert')).toHaveTextContent('Too short')
        expect(grid.data[0].name).toBe('Alice')
        expect(getEditing(grid)!.active).toEqual({ rowId: '1', columnId: 'name' })
    })

    it('parses number editors and commits with Tab moving right', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        cellAt(screen.container, 0, 1).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await page.getByRole('spinbutton').first().fill('55')
        await userEvent.keyboard('{Tab}')

        expect(grid.data[0].age).toBe(55)
        expect(grid.focus.active).toEqual({ row: 0, col: 2 })
    })

    it('type-to-edit starts an edit seeded with the typed character', async () => {
        const grid = makeGrid()
        await renderGrid(grid)

        await page.getByRole('gridcell', { name: 'Carol', exact: true }).click()
        await expect.poll(() => grid.focus.active).toEqual({ row: 2, col: 0 })
        await userEvent.keyboard('K')
        const input = page.getByRole('textbox').first()
        await expect.element(input).toHaveValue('K')
    })

    it('edits a select editor', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        expect(grid.data[0].dept).toBe('Core')

        cellAt(screen.container, 0, 2).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        // The list opens with the editor, so there is nothing to click first.
        await page.getByRole('option', { name: 'Data' }).click()

        await expect.poll(() => grid.data[0].dept).toBe('Data')
    })

    it('keeps the number editor open on interaction inside it (no premature commit)', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        cellAt(screen.container, 0, 1).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await expect.element(page.getByRole('spinbutton').first()).toBeVisible()

        const field = cellAt(screen.container, 0, 1).querySelector('input')!
        field.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        await new Promise((resolve) => requestAnimationFrame(resolve))

        expect(getEditing(grid)!.active).toEqual({ rowId: '1', columnId: 'age' })
    })

    it('adds tags on Enter without committing, then commits on outside click', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const state = getEditing(grid)!

        cellAt(screen.container, 0, 5).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await expect
            .poll(() => cellAt(screen.container, 0, 5).querySelector('input'))
            .not.toBeNull()
        const input = cellAt(screen.container, 0, 5).querySelector('input')!
        input.focus()

        await userEvent.fill(input, 'rust')
        await userEvent.keyboard('{Enter}')
        expect(state.active).not.toBeNull()

        document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }))
        await expect.poll(() => state.active).toBeNull()
        expect(grid.data[0].skills).toContain('rust')
    })

    it('focuses the first date segment so the date can be typed, and stores ISO', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        cellAt(screen.container, 0, 6).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await expect
            .poll(() => cellAt(screen.container, 0, 6).querySelector('[role="spinbutton"]'))
            .not.toBeNull()

        const focused = document.activeElement as HTMLElement | null
        expect(focused?.getAttribute('role')).toBe('spinbutton')
        expect(cellAt(screen.container, 0, 6).contains(focused)).toBe(true)

        await userEvent.keyboard('07')
        await userEvent.keyboard('04')
        await userEvent.keyboard('2027')
        await userEvent.keyboard('{Enter}')

        await expect.poll(() => grid.data[0].joined).toBe('2027-07-04')
    })

    it('commits a half-typed year as a date rather than as a broken string', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        cellAt(screen.container, 0, 6).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await expect
            .poll(() => cellAt(screen.container, 0, 6).querySelector('[role="spinbutton"]'))
            .not.toBeNull()

        // Leaving while the year is still one digit. What lands is wrong, as
        // any half-typed value is, but it has to be a date: `2-07-04` parsed
        // as nothing, drew as nothing, and went to a server as nothing.
        await userEvent.keyboard('07')
        await userEvent.keyboard('04')
        await userEvent.keyboard('2')
        await userEvent.keyboard('{Enter}')

        await expect.poll(() => grid.data[0].joined).toBe('0002-07-04')
    })

    it('mounts the sv5ui Rating editor for a rating column and commits via the API', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const state = getEditing(grid)!
        expect(grid.data[1].rating).toBe(2)

        cellAt(screen.container, 1, 4).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await expect
            .poll(() => cellAt(screen.container, 1, 4).querySelector('[role="slider"]'))
            .not.toBeNull()

        state.setDraft(4)
        expect(state.commit()).toBe(true)
        expect(grid.data[1].rating).toBe(4)
    })
})

describe('undo / redo', () => {
    it('reverses and replays a committed edit with Ctrl+Z / Ctrl+Shift+Z', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        cellAt(screen.container, 0, 0).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await page.getByRole('textbox').first().fill('Alicia')
        await userEvent.keyboard('{Enter}')
        expect(grid.data[0].name).toBe('Alicia')

        cellAt(screen.container, 0, 1).click()
        await userEvent.keyboard('{Control>}z{/Control}')
        expect(grid.data[0].name).toBe('Alice')

        await userEvent.keyboard('{Control>}{Shift>}Z{/Shift}{/Control}')
        expect(grid.data[0].name).toBe('Alicia')
    })
})

describe('row edit mode', () => {
    it('edits several cells of a row and commits atomically', async () => {
        const grid = makeGrid({ mode: 'row' })
        await renderGrid(grid)
        const state = getEditing(grid)!

        state.startRowEdit('1')
        const inputs = page.getByRole('textbox')
        await inputs.first().fill('Alina')
        await page.getByRole('spinbutton').first().fill('99')
        expect(state.commitRow()).toBe(true)

        expect(grid.data[0]).toMatchObject({ name: 'Alina', age: 99 })
    })

    it('opens on a double-click, which mode cell would have sent to one cell', async () => {
        const grid = makeGrid({ mode: 'row' })
        const screen = await renderGrid(grid)
        const state = getEditing(grid)!

        await userEvent.dblClick(cellAt(screen.container, 0, 1))

        expect(state.rowEditId).toBe('1')
        expect(state.active).toBeNull()
    })

    it('gives the caret to the first field, not the last to mount', async () => {
        const grid = makeGrid({ mode: 'row' })
        const screen = await renderGrid(grid)
        getEditing(grid)!.startRowEdit('1')
        await expect.element(page.getByRole('textbox').first()).toBeVisible()

        // Every editor mounts at once; without a rule the last one to run keeps
        // the focus and the eye starts somewhere the caret is not.
        const first = cellAt(screen.container, 0, 0).querySelector('input')
        expect(document.activeElement).toBe(first)
        expect(first?.getAttribute('aria-label')).toBe('Name')
    })

    it('lets a click reach the field it landed on', async () => {
        const grid = makeGrid({ mode: 'row' })
        const screen = await renderGrid(grid)
        getEditing(grid)!.startRowEdit('1')
        await expect.element(page.getByRole('textbox').first()).toBeVisible()

        // The cell carries a roving tabindex and used to claim this focus, so
        // the keystrokes went nowhere.
        const age = cellAt(screen.container, 0, 1).querySelector('input')!
        await userEvent.click(age)
        expect(document.activeElement).toBe(age)

        await userEvent.keyboard('7')
        expect(age.value).toContain('7')
    })

    it('leaves the select lists closed', async () => {
        const grid = makeGrid({ mode: 'row' })
        await renderGrid(grid)
        getEditing(grid)!.startRowEdit('1')
        await expect.element(page.getByRole('textbox').first()).toBeVisible()

        // A cell edit drops its list open because that is what the user came
        // for. A row edit opening every list at once buries the rows below.
        expect(document.querySelectorAll('[role="listbox"]').length).toBe(0)
    })

    it('rings the row once instead of ringing every field', async () => {
        const grid = makeGrid({ mode: 'row' })
        const screen = await renderGrid(grid)
        getEditing(grid)!.startRowEdit('1')
        await expect.element(page.getByRole('textbox').first()).toBeVisible()

        // Two inset rings meeting at a seam read as one doubled rule, which is
        // what a ring per editor produced across the row.
        const name = cellAt(screen.container, 0, 0).firstElementChild as HTMLElement
        const age = cellAt(screen.container, 0, 1).firstElementChild as HTMLElement
        const seam = age.getBoundingClientRect().left - name.getBoundingClientRect().right
        expect(Math.abs(seam)).toBeLessThanOrEqual(1)

        // The row carries the outline, and it is the only one: a field marking
        // focus with a second box put four pixels of primary along the seam it
        // shares with the row, and three lines in the corner of a widget that
        // draws its own border.
        const row = cellAt(screen.container, 0, 0).parentElement!
        expect(getComputedStyle(row, '::after').boxShadow).not.toBe('none')

        // `name` holds the caret: the first editable field takes it.
        expect(name.contains(document.activeElement)).toBe(true)
        expect(getComputedStyle(name).boxShadow).toBe('none')
        expect(getComputedStyle(age).boxShadow).toBe('none')

        // What it marks focus with instead: a tint, and a rule along the one
        // edge the row's outline does not already occupy.
        expect(getComputedStyle(name, '::after').backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
        expect(getComputedStyle(age, '::after').backgroundColor).toBe('rgba(0, 0, 0, 0)')
    })

    it('does not turn the page when Enter commits the last row of one', async () => {
        const grid = createDataGrid<Person>({
            columns,
            data: makeData(24),
            getRowId: (person) => String(person.id),
            features: [sorting(), editing(), pagination({ pageSize: 12 })]
        })
        const screen = await renderGrid(grid)
        const paging = getPagination(grid)!

        // The last row the page holds, which is where the jump showed up.
        cellAt(screen.container, 11, 0).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await page.getByRole('textbox').first().fill('Edited')
        await userEvent.keyboard('{Enter}')

        expect(grid.data[11].name).toBe('Edited')
        // Pressing Enter to save is not a request to go to page two.
        expect(paging.page).toBe(1)
        expect(grid.focus.active.row).toBe(11)
    })

    it('still moves down when the next row is on the same page', async () => {
        const grid = createDataGrid<Person>({
            columns,
            data: makeData(24),
            getRowId: (person) => String(person.id),
            features: [sorting(), editing(), pagination({ pageSize: 12 })]
        })
        const screen = await renderGrid(grid)

        cellAt(screen.container, 3, 0).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await page.getByRole('textbox').first().fill('Edited')
        await userEvent.keyboard('{Enter}')
        expect(grid.focus.active.row).toBe(4)
    })

    it('leaves the arrow keys free to cross the boundary', async () => {
        const grid = createDataGrid<Person>({
            columns,
            data: makeData(24),
            getRowId: (person) => String(person.id),
            features: [sorting(), editing(), pagination({ pageSize: 12 })]
        })
        const screen = await renderGrid(grid)
        const paging = getPagination(grid)!

        cellAt(screen.container, 11, 0).focus()
        await userEvent.keyboard('{ArrowDown}')

        // Going somewhere is what an arrow key is for.
        expect(grid.focus.active.row).toBe(12)
        expect(paging.page).toBe(2)
    })

    it('keeps the row separator from painting over the cell editor it rings', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        cellAt(screen.container, 0, 0).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await expect.element(page.getByRole('textbox').first()).toBeVisible()

        const box = cellAt(screen.container, 0, 0).firstElementChild as HTMLElement
        const row = cellAt(screen.container, 0, 0).parentElement!
        const separator = Number(getComputedStyle(row, '::after').zIndex)

        // The editor fills its cell, so the separator lands on the ring rather
        // than beside it: one grey pixel along one blue edge, which reads as
        // three edges of one weight and a fourth of another.
        expect(Number(getComputedStyle(box).zIndex)).toBeGreaterThan(separator)
        // And no higher than the pinned cells, which stay above what scrolls
        // beneath them whether or not it is being edited.
        expect(Number(getComputedStyle(box).zIndex)).toBeLessThan(8)
    })

    it('leaves a widget editor to draw its own focus, not a box around it', async () => {
        const grid = makeGrid({ mode: 'row' })
        const screen = await renderGrid(grid)
        getEditing(grid)!.startRowEdit('1')
        await expect.element(page.getByRole('textbox').first()).toBeVisible()

        // The dept column edits through a Select, which has a border and a
        // focus state of its own.
        const dept = cellAt(screen.container, 0, 2).firstElementChild as HTMLElement
        expect(getComputedStyle(dept).boxShadow).toBe('none')
        expect(getComputedStyle(dept, '::after').backgroundColor).toBe('rgba(0, 0, 0, 0)')
    })
})

describe('editing a11y + virtualization', () => {
    it('is axe-clean while an editor with an error is open', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        cellAt(screen.container, 0, 0).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await page.getByRole('textbox').first().fill('x')
        await userEvent.keyboard('{Enter}')
        await expect.element(page.getByRole('alert')).toBeVisible()

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })

    it('does not rebuild other rows when one cell is edited', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        const marked = cellAt(screen.container, 1, 0) as HTMLElement & { __marker?: boolean }
        marked.__marker = true

        cellAt(screen.container, 0, 0).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await page.getByRole('textbox').first().fill('Alicia')
        await userEvent.keyboard('{Enter}')

        const still = cellAt(screen.container, 1, 0) as HTMLElement & { __marker?: boolean }
        expect(still.__marker).toBe(true)
    })

    it('composes with virtualization: an edit survives scrolling away and back', async () => {
        const grid = makeGrid({}, { rows: 500, virtual: true })
        const screen = await renderGrid(grid, { class: 'h-90' })
        const state = getEditing(grid)!

        state.startEdit('1', 'name')
        state.setDraft('Edited')
        expect(state.commit()).toBe(true)
        expect(grid.data[0].name).toBe('Edited')
        await expect.element(page.getByRole('gridcell', { name: 'Edited' })).toBeVisible()

        const viewport = screen.container.querySelector<HTMLElement>('[role="grid"]')!
        viewport.scrollTop = 4000
        viewport.dispatchEvent(new Event('scroll'))
        await new Promise((resolve) => requestAnimationFrame(resolve))
        await new Promise((resolve) => requestAnimationFrame(resolve))
        await expect.poll(() => screen.container.querySelector('[data-dg-cell="0:0"]')).toBeNull()

        viewport.scrollTop = 0
        viewport.dispatchEvent(new Event('scroll'))
        await new Promise((resolve) => requestAnimationFrame(resolve))
        await new Promise((resolve) => requestAnimationFrame(resolve))
        expect(cellAt(screen.container, 0, 0).textContent).toContain('Edited')
    })
})

describe('clipboard paste', () => {
    function pasteInto(cell: HTMLElement, text: string) {
        const data = new DataTransfer()
        data.setData('text', text)
        cell.dispatchEvent(new ClipboardEvent('paste', { bubbles: true, clipboardData: data }))
    }

    it('fills cells from a focused cell via a paste event', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        const target = cellAt(screen.container, 0, 0)
        target.dispatchEvent(new MouseEvent('click', { bubbles: true }))
        pasteInto(target, 'Alicia\t31')

        await expect.poll(() => grid.data[0].name).toBe('Alicia')
        expect(grid.data[0].age).toBe(31)
        await expect.element(page.getByRole('gridcell', { name: 'Alicia' })).toBeVisible()
    })

    it('leaves an open editor to handle its own paste', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        const state = getEditing(grid)!
        state.startEdit('1', 'name')
        await expect.element(page.getByRole('textbox')).toBeVisible()

        const input = screen.container.querySelector<HTMLElement>('input')!
        pasteInto(input, 'FromEditor')
        // The grid paste must not fire while an editor owns the event.
        expect(grid.data[0].name).toBe('Alice')
    })
})

describe('leaving a widget editor', () => {
    /** name, age, dept, active, rating, skills, joined. */
    const DEPT = 2

    const isOpen = (container: Element) =>
        Boolean(cellAt(container, 0, DEPT).querySelector('[role="combobox"],button[aria-haspopup]'))

    it('closes on Escape, where the cell holds the focus and not the widget', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        await userEvent.dblClick(cellAt(screen.container, 0, DEPT))
        await expect.poll(() => isOpen(screen.container)).toBe(true)

        // A widget editor leaves focus on the cell, so a handler on the editor
        // inside it never sees the key — the binding has to be on the grid.
        await userEvent.keyboard('{Escape}')
        await expect.poll(() => isOpen(screen.container)).toBe(false)
        expect(getEditing(grid)!.active).toBeNull()
    })

    it('closes when the pointer leaves it', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        await userEvent.dblClick(cellAt(screen.container, 0, DEPT))
        await expect.poll(() => isOpen(screen.container)).toBe(true)

        // It used to sit there with no way out but picking a value: the
        // outside-click handler only ever ran for text-field editors.
        await userEvent.click(cellAt(screen.container, 2, 1))
        await expect.poll(() => isOpen(screen.container)).toBe(false)
        expect(getEditing(grid)!.active).toBeNull()
    })

    it('leaves the committed value alone', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const before = grid.data[0].dept

        await userEvent.dblClick(cellAt(screen.container, 0, DEPT))
        await expect.poll(() => isOpen(screen.container)).toBe(true)
        await userEvent.keyboard('{Escape}')

        // A widget commits as its value changes, so ending the edit discards
        // nothing the user had entered.
        await expect.poll(() => grid.data[0].dept).toBe(before)
    })

    it('still commits a text editor left by clicking away', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        await userEvent.dblClick(cellAt(screen.container, 0, 0))
        await userEvent.keyboard('Zoe')
        await userEvent.click(cellAt(screen.container, 2, 1))

        await expect.poll(() => grid.data[0].name).toBe('Zoe')
    })
})

describe('segmented editors in a narrow column', () => {
    /** name, age, dept, active, rating, skills, joined — `joined` is the date. */
    const JOINED = 6

    it('grows past the cell rather than running its segments under the icon', async () => {
        // Narrow enough that the segments cannot fit beside the trigger: the
        // width a real report column would give a date.
        const grid = createDataGrid<Person>({
            columns: columns.map((column) =>
                column.id === 'joined' ? { ...column, width: 110 } : column
            ),
            data: makeData(4),
            getRowId: (person) => String(person.id),
            features: [editing(), pagination({})]
        })
        const screen = await renderGrid(grid)
        const cell = cellAt(screen.container, 0, JOINED)

        await userEvent.dblClick(cell)
        const editor = () => cell.firstElementChild as HTMLElement
        await expect.poll(() => Boolean(editor()?.querySelector('[role="spinbutton"]'))).toBe(true)

        // A date field lays out fixed segments and reserves room for its
        // trigger. Held to a narrower column the segments used to overflow and
        // print under that trigger.
        const segments = [...cell.querySelectorAll('[role="spinbutton"]')]
        const last = segments.at(-1)!.getBoundingClientRect()
        const trigger = cell.querySelector('button')!.getBoundingClientRect()
        expect(last.right).toBeLessThanOrEqual(trigger.left + 1)
    })

    it('leaves a text editor at the width of its cell', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const cell = cellAt(screen.container, 0, 0)

        await userEvent.dblClick(cell)
        await expect.poll(() => Boolean(cell.querySelector('input'))).toBe(true)

        const editor = (cell.firstElementChild as HTMLElement).getBoundingClientRect()
        expect(Math.round(editor.width)).toBeLessThanOrEqual(
            Math.round(cell.getBoundingClientRect().width) + 1
        )
    })
})

describe('committing an editor that owns Enter', () => {
    /** name, age, dept, active, rating, skills, joined. */
    const SKILLS = 5

    it('commits a tags editor with Ctrl+Enter, without leaving the cell', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const cell = cellAt(screen.container, 0, SKILLS)

        await userEvent.dblClick(cell)
        await expect.poll(() => Boolean(cell.querySelector('input'))).toBe(true)

        // Enter belongs to the widget: it adds the tag rather than committing.
        await userEvent.keyboard('svelte{Enter}')
        expect(getEditing(grid)!.active).not.toBeNull()

        await userEvent.keyboard('{Control>}{Enter}{/Control}')
        await expect.poll(() => getEditing(grid)!.active).toBeNull()
        expect(grid.data[0].skills).toContain('svelte')
        // The grid's own position is what moves, or does not: unlike Tab,
        // this commits without leaving the cell.
        expect(grid.focus.active).toMatchObject({ row: 0, col: SKILLS })
    })

    it('leaves plain Enter to commit and move where the editor does not claim it', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        await userEvent.dblClick(cellAt(screen.container, 0, 0))
        await page.getByRole('textbox').first().fill('Zoe')
        await userEvent.keyboard('{Enter}')

        await expect.poll(() => grid.data[0].name).toBe('Zoe')
        expect(grid.focus.active).toMatchObject({ row: 1, col: 0 })
    })
})

describe('focus ring while editing', () => {
    const hasRing = (element: Element) => /rgb|oklch/.test(getComputedStyle(element).boxShadow)

    /** `:focus-visible` needs the keyboard, so focus arrives by arrow key. */
    async function focusByKeyboard(container: Element) {
        await userEvent.click(cellAt(container, 0, 1))
        await userEvent.keyboard('{ArrowLeft}')
        return cellAt(container, 0, 0)
    }

    it('drops the cell ring once an editor draws its own', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const cell = await focusByKeyboard(screen.container)
        await expect.poll(() => hasRing(cell)).toBe(true)

        await userEvent.keyboard('{Enter}')
        await expect.poll(() => Boolean(cell.querySelector('input'))).toBe(true)

        // Two rings around one control read as a mistake, so the cell yields
        // to the editor rather than framing it.
        expect(hasRing(cell)).toBe(false)
        expect(hasRing(cell.firstElementChild!)).toBe(true)
    })

    it('gives it back when the edit ends', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const cell = await focusByKeyboard(screen.container)
        const ringClass = /focus-visible:ring-2/

        await userEvent.keyboard('{Enter}')
        await expect.poll(() => Boolean(cell.querySelector('input'))).toBe(true)
        expect(cell.className).not.toMatch(ringClass)

        // The class comes back, not the painted ring: `:focus-visible` follows
        // the browser's own idea of how focus arrived, and focus returning to
        // the cell in code does not count as a keypress.
        await userEvent.keyboard('{Escape}')
        await expect.poll(() => ringClass.test(cell.className)).toBe(true)
    })
})

describe('opening an editor from the keyboard', () => {
    /** name, age, dept, active, rating, skills, joined. */
    const DEPT = 2

    it('drops the list open and hands it the keyboard', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const cell = cellAt(screen.container, 0, DEPT)

        cell.focus()
        await userEvent.keyboard('{Enter}')

        // Opening the editor is the choice; the list is what the user came
        // for, so it is already down rather than waiting for a second key.
        await expect
            .poll(() => document.querySelectorAll('[data-bits-floating-content-wrapper]').length)
            .toBe(1)
        // And the caret is on the control, or the arrows would still be
        // steering the grid instead of the list.
        expect(cell.contains(document.activeElement)).toBe(true)
        expect(document.activeElement).not.toBe(cell)
    })

    it('starts a text edit on the key that opened it', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        cellAt(screen.container, 0, 0).focus()
        await userEvent.keyboard('Z')

        await expect
            .poll(() => (document.activeElement as HTMLInputElement | null)?.value)
            .toBe('Z')
    })

    it('does not seed an editor that cannot hold the character', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        cellAt(screen.container, 0, DEPT).focus()
        await userEvent.keyboard('Z')

        // A select would be left holding a value none of its options offer.
        await expect.poll(() => getEditing(grid)!.active).not.toBeNull()
        expect(getEditing(grid)!.draft).not.toBe('Z')
    })
})
