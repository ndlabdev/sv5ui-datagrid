import axe from 'axe-core'
import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import FiltersDemo from '../routes/filters/+page.svelte'
import {
    createDataGrid,
    DataGrid,
    filtering,
    getFiltering,
    selection,
    sorting,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Person {
    id: number
    name: string
    team: string
    age: number
    active: boolean
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

describe('the filter row', () => {
    it('draws one cell per column, and a field only where a filter is declared', async () => {
        const screen = await renderGrid(makeGrid())
        const row = filterRow(screen.container)!

        expect(row.querySelectorAll('[role="gridcell"]')).toHaveLength(columns.length)
        // text, number: an input each. set: the panel's own trigger. boolean:
        // a select. `note` declares no filter, so its cell stays empty.
        expect(row.querySelectorAll('input')).toHaveLength(2)
        expect(filterCell(screen.container, 4).textContent?.trim()).toBe('')
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

    it('hands a set column to the panel instead of flattening it', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const cell = filterCell(screen.container, 1)

        expect(cell.querySelector('input')).toBeNull()
        expect(cell.querySelector('button')).not.toBeNull()

        getFiltering(grid)!.setColumnFilter('team', { kind: 'set', values: ['Core'] })
        await expect.poll(() => cell.textContent).toContain('Core')
    })

    it('opens the column one panel, not a second of its own', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        // The row asks; the header's panel answers. Two instances of the panel
        // for one column both read the same open flag and both appear.
        await filterCell(screen.container, 1).querySelector('button')!.click()

        await expect.poll(() => document.querySelectorAll('[role="dialog"]').length).toBe(1)
        expect(getFiltering(grid)!.filterFor).toBe('team')

        await filterCell(screen.container, 1).querySelector('button')!.click()
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
})
