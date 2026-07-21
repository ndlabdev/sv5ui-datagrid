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
        await page.getByRole('button', { name: /Dept/ }).first().click()
        await page.getByRole('option', { name: 'Data' }).click()

        expect(grid.data[0].dept).toBe('Data')
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
