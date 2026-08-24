import axe from 'axe-core'
import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    filtering,
    getFiltering,
    getSorting,
    pagination,
    sorting,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Person {
    id: number
    name: string
    age: number | null
    dept: string
    active: boolean
    joined: string
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

const people: Person[] = [
    { id: 1, name: 'Alice', age: 30, dept: 'Core', active: true, joined: '2024-01-10' },
    { id: 2, name: 'Bob', age: null, dept: 'Data', active: false, joined: '2024-06-01' },
    { id: 3, name: 'Carol', age: 45, dept: 'Core', active: true, joined: '2025-03-15' },
    { id: 4, name: 'Dave', age: 22, dept: 'Infra', active: false, joined: '2025-11-30' },
    { id: 5, name: 'Erin', age: 38, dept: 'Data', active: true, joined: '2023-08-20' }
]

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name', sortable: true, flex: 1, minWidth: 140, filter: 'text' },
    { id: 'age', header: 'Age', sortable: true, width: 100, filter: 'number' },
    { id: 'dept', header: 'Dept', sortable: true, width: 120, filter: 'set' },
    { id: 'active', header: 'Active', width: 110, filter: 'boolean' },
    { id: 'joined', header: 'Joined', sortable: true, width: 130, filter: 'date' }
]

const getRowId = (person: Person) => String(person.id)

function firstColumn(container: Element): string[] {
    return [...container.querySelectorAll('[role="gridcell"][aria-colindex="1"]')].map(
        (cell) => cell.textContent?.trim() ?? ''
    )
}

function makeGrid(pageSize?: number): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId,
        features: [filtering(), sorting({ nulls: 'last' }), columnOps(), pagination({ pageSize })]
    })
}

async function renderGrid(grid: GridState<Person>) {
    const screen = await render(TypedDataGrid, { grid })
    await expect.element(screen.getByRole('grid')).toBeVisible()
    return screen
}

describe('column filters', () => {
    it('filters text via the panel UI and shows a chip', async () => {
        const screen = await render(TypedDataGrid, {
            data: people,
            columns,
            getRowId,
            toolbar: true
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        await page.getByRole('button', { name: 'Filter Name' }).click()
        const dialog = page.getByRole('dialog', { name: 'Filter Name' })
        await expect.element(dialog).toBeVisible()
        await dialog.getByRole('textbox').fill('car')
        await dialog.getByRole('button', { name: 'Apply' }).click()

        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '2')
        expect(firstColumn(screen.container)).toEqual(['Carol'])
        await expect.element(page.getByRole('button', { name: /Remove filter Name/ })).toBeVisible()
    })

    it('anchors the panel to its trigger when opened from the column menu', async () => {
        const screen = await render(TypedDataGrid, {
            data: people,
            columns,
            getRowId,
            toolbar: true
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        // Open via the column menu, not the filter icon — the path that used to
        // leave the panel stranded at the top-left corner.
        await page.getByRole('button', { name: 'Name column menu' }).click()
        await page.getByRole('menuitem', { name: 'Filter…' }).click()

        const dialog = page.getByRole('dialog', { name: 'Filter Name' })
        await expect.element(dialog).toBeVisible()

        const trigger = screen.container.querySelector<HTMLElement>('[aria-label="Filter Name"]')!
        const panelRect = (dialog.element() as HTMLElement).getBoundingClientRect()
        const triggerRect = trigger.getBoundingClientRect()
        // Not parked at the corner, and sitting just below its trigger.
        expect(panelRect.top).toBeGreaterThan(0)
        expect(panelRect.left).toBeGreaterThan(0)
        expect(Math.abs(panelRect.top - triggerRect.bottom)).toBeLessThan(20)
    })

    it('keeps focus in the panel when its inputs are clicked and typed into', async () => {
        const screen = await render(TypedDataGrid, {
            data: people,
            columns,
            getRowId,
            toolbar: true
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        await page.getByRole('button', { name: 'Filter Name' }).click()
        const input = page.getByRole('dialog', { name: 'Filter Name' }).getByRole('textbox')
        await input.click()
        // Type key-by-key (not .fill), the path that used to lose focus to the
        // header cell the panel is rendered inside.
        await userEvent.keyboard('car')

        const active = document.activeElement
        expect(active?.closest('[role="dialog"]')).not.toBeNull()
        expect((active as HTMLInputElement).value).toBe('car')
    })

    it('filters numbers with the between operator', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        getFiltering(grid)!.setColumnFilter('age', {
            kind: 'number',
            op: 'between',
            value: 25,
            to: 40
        })
        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '3')
        expect(firstColumn(screen.container).toSorted()).toEqual(['Alice', 'Erin'])
    })

    it('filters a set of values', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        getFiltering(grid)!.setColumnFilter('dept', { kind: 'set', values: ['Core', 'Infra'] })
        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '4')
        expect(firstColumn(screen.container).toSorted()).toEqual(['Alice', 'Carol', 'Dave'])
    })

    it('filters booleans and dates', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const state = getFiltering(grid)!

        state.setColumnFilter('active', { kind: 'boolean', value: true })
        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '4')

        state.clearColumnFilters()
        state.setColumnFilter('joined', { kind: 'date', op: 'before', value: '2024-01-01' })
        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '2')
        expect(firstColumn(screen.container)).toEqual(['Erin'])
    })

    it('clears one filter through its chip and all with Clear all', async () => {
        const grid = makeGrid()
        const screen = await render(TypedDataGrid, { grid, toolbar: true })
        await expect.element(screen.getByRole('grid')).toBeVisible()
        const state = getFiltering(grid)!

        state.setColumnFilter('dept', { kind: 'set', values: ['Core'] })
        state.setColumnFilter('active', { kind: 'boolean', value: true })
        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '3')

        await page.getByRole('button', { name: 'Clear all' }).click()
        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '6')

        state.setColumnFilter('dept', { kind: 'set', values: ['Core'] })
        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '3')
        await page.getByRole('button', { name: /Remove filter Dept/ }).click()
        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '6')
    })
})

describe('quick filter, driven from code', () => {
    /** The toolbar is the default shape of a grid, so it renders here. */
    async function renderWithToolbar(grid: GridState<Person>) {
        const screen = await render(TypedDataGrid, { grid, toolbar: true })
        await expect.element(screen.getByRole('grid')).toBeVisible()
        return screen
    }

    const box = () => document.querySelector<HTMLInputElement>('input[placeholder="Search..."]')

    it('applies a filter set from app code and shows it in the box', async () => {
        const grid = makeGrid()
        await renderWithToolbar(grid)

        // The box used to own both directions of the sync, so it wrote its own
        // empty value back over this call before anything rendered.
        getFiltering(grid)!.setQuickFilter('Core')
        await expect.poll(() => grid.nodes.length).toBe(2)
        await expect.poll(() => box()?.value).toBe('Core')
    })

    it('clears from app code after the user has typed', async () => {
        const grid = makeGrid()
        await renderWithToolbar(grid)

        await userEvent.fill(page.getByPlaceholder('Search...'), 'Core')
        await expect.poll(() => grid.nodes.length).toBe(2)

        getFiltering(grid)!.setQuickFilter('')
        await expect.poll(() => grid.nodes.length).toBe(5)
        await expect.poll(() => box()?.value).toBe('')
    })

    it('still filters from the box itself', async () => {
        const grid = makeGrid()
        await renderWithToolbar(grid)

        await userEvent.fill(page.getByPlaceholder('Search...'), 'Data')
        await expect.poll(() => grid.nodes.length).toBe(2)
        expect(getFiltering(grid)!.quick).toBe('Data')
    })
})

describe('multi-sort', () => {
    it('appends a second sort with Shift+click and orders by both', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        await page.getByRole('button', { name: 'Dept', exact: true }).click()
        await userEvent.keyboard('{Shift>}')
        await page.getByRole('button', { name: 'Age', exact: true }).click()
        await userEvent.keyboard('{/Shift}')

        const sort = getSorting(grid)!.sort
        expect(sort.map((entry) => entry.columnId)).toEqual(['dept', 'age'])
        expect(getSorting(grid)!.priorityOf('dept')).toBe(1)
        expect(getSorting(grid)!.priorityOf('age')).toBe(2)
        expect(firstColumn(screen.container)).toEqual(['Alice', 'Carol', 'Erin', 'Bob', 'Dave'])
    })
})

describe('status bar + pagination', () => {
    it('shows filtered/total counts and a page-size select', async () => {
        const grid = makeGrid(2)
        const screen = await renderGrid(grid)

        await expect.element(screen.getByText('5 rows')).toBeVisible()
        await expect.element(screen.getByRole('button', { name: 'Rows per page' })).toBeVisible()

        getFiltering(grid)!.setColumnFilter('dept', { kind: 'set', values: ['Core'] })
        await expect.element(screen.getByText('2 of 5 rows')).toBeVisible()
    })
})

describe('the date condition, through the sv5ui picker', () => {
    it('filters on a day chosen in the calendar', async () => {
        const grid = makeGrid()
        const screen = await render(TypedDataGrid, { grid, toolbar: true })
        await expect.element(screen.getByRole('grid')).toBeVisible()
        await page.getByRole('button', { name: 'Filter Joined' }).click()

        const dialog = page.getByRole('dialog', { name: 'Filter Joined' })
        await expect.element(dialog).toBeVisible()
        // A segmented field and a calendar, not the browser's own date input.
        expect(document.querySelector('input[type="date"]')).toBeNull()

        await dialog.getByRole('button', { name: 'Open calendar' }).click()
        await page.getByRole('button', { name: '15' }).click()

        // The calendar is portalled out of the dialog; the panel's click
        // handler has to know that is still itself, or picking closes it.
        await expect.element(dialog).toBeVisible()

        await dialog.getByRole('button', { name: 'Apply' }).click()
        await expect
            .poll(() => getFiltering(grid)!.columnFilters['joined'])
            .toEqual({
                kind: 'date',
                op: 'equals',
                value: expect.stringMatching(/^\d{4}-\d{2}-15$/)
            })
    })
})

describe('typing a date into the panel', () => {
    it('keeps the digits the person typed, one segment at a time', async () => {
        const grid = makeGrid()
        const screen = await render(TypedDataGrid, { grid, toolbar: true })
        await expect.element(screen.getByRole('grid')).toBeVisible()
        await page.getByRole('button', { name: 'Filter Joined' }).click()

        const dialog = page.getByRole('dialog', { name: 'Filter Joined' })
        await expect.element(dialog).toBeVisible()

        // The field is controlled by the draft it writes to, so every
        // keystroke round-trips through an ISO string and back. A year mid-way
        // to 2025 is 2, then 20, then 202, and the trip has to return each of
        // them unchanged or the segments fight what is being typed.
        const segment = screen.container.ownerDocument.querySelector<HTMLElement>(
            '[role="dialog"] [role="spinbutton"]'
        )!
        segment.focus()
        await userEvent.keyboard('03152025')

        await dialog.getByRole('button', { name: 'Apply' }).click()
        await expect
            .poll(() => getFiltering(grid)!.columnFilters['joined'])
            .toEqual({
                kind: 'date',
                op: 'equals',
                value: '2025-03-15'
            })
    })
})

describe('two conditions on one column', () => {
    async function openNameFilter() {
        const screen = await render(TypedDataGrid, {
            data: people,
            columns,
            getRowId,
            toolbar: true
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()
        await page.getByRole('button', { name: 'Filter Name' }).click()

        const dialog = page.getByRole('dialog', { name: 'Filter Name' })
        await expect.element(dialog).toBeVisible()
        return { screen, dialog }
    }

    /** The sv5ui Select is a button opening a portalled listbox, not a <select>. */
    async function choose(name: string, option: string) {
        await page.getByRole('button', { name }).click()
        await page.getByRole('option', { name: option, exact: true }).click()
    }

    it('adds a second condition and ORs it', async () => {
        const { screen, dialog } = await openNameFilter()

        await dialog.getByLabelText('Filter value').fill('alice')
        await dialog.getByRole('button', { name: 'Add condition' }).click()
        await choose('Combine conditions', 'Or')
        await dialog.getByLabelText('Filter value 2').fill('bob')
        await dialog.getByRole('button', { name: 'Apply' }).click()

        await expect.poll(() => firstColumn(screen.container)).toEqual(['Alice', 'Bob'])
    })

    it('ANDs a positive and a negated condition', async () => {
        const { screen, dialog } = await openNameFilter()

        await dialog.getByLabelText('Filter value').fill('a')
        await dialog.getByRole('button', { name: 'Add condition' }).click()
        await choose('Filter operator 2', 'Does not contain')
        await dialog.getByLabelText('Filter value 2').fill('lice')
        await dialog.getByRole('button', { name: 'Apply' }).click()

        await expect.poll(() => firstColumn(screen.container)).toEqual(['Carol', 'Dave'])
    })

    it('keeps the plain shape until the second condition is filled in', async () => {
        const grid = makeGrid()
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        await page.getByRole('button', { name: 'Filter Name' }).click()
        const dialog = page.getByRole('dialog', { name: 'Filter Name' })
        await dialog.getByLabelText('Filter value').fill('a')
        await dialog.getByRole('button', { name: 'Add condition' }).click()
        await dialog.getByRole('button', { name: 'Apply' }).click()

        expect(getFiltering(grid)?.columnFilters.name).toEqual({
            kind: 'text',
            op: 'contains',
            value: 'a'
        })
    })

    it('filters case-sensitively when Match case is ticked', async () => {
        const { screen, dialog } = await openNameFilter()

        await dialog.getByLabelText('Filter value').fill('ALICE')
        await dialog.getByRole('checkbox', { name: 'Match case' }).click()
        await dialog.getByRole('button', { name: 'Apply' }).click()

        // Case-insensitively this matches Alice; with the box ticked, nothing.
        // `aria-rowcount` counts the header row too, so an empty grid reads 1.
        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '1')
    })

    it('offers the presence operators without a value input', async () => {
        const { screen, dialog } = await openNameFilter()

        await choose('Filter operator', 'Is blank')
        await expect.element(dialog.getByLabelText('Filter value')).not.toBeInTheDocument()
        await dialog.getByRole('button', { name: 'Apply' }).click()

        // Every name is filled in, so a blank test matches nothing.
        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '1')
    })
})

describe('filter panel a11y', () => {
    it('closes on Escape and has no axe violations while open', async () => {
        const screen = await render(TypedDataGrid, {
            data: people,
            columns,
            getRowId,
            toolbar: true
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        await page.getByRole('button', { name: 'Filter Dept' }).click()
        await expect.element(page.getByRole('dialog', { name: 'Filter Dept' })).toBeVisible()

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(
            results.violations.flatMap((violation) =>
                violation.nodes.map((node) => `${violation.id}: ${node.html.slice(0, 120)}`)
            )
        ).toEqual([])

        await userEvent.keyboard('{Escape}')
        await expect
            .element(page.getByRole('dialog', { name: 'Filter Dept' }))
            .not.toBeInTheDocument()
    })
})

describe('filter panel positioning', () => {
    const wide: ColumnDef<Person>[] = [
        { id: 'id', header: 'Id', width: 80, pinned: 'left' },
        { id: 'name', header: 'Name', width: 200, pinned: 'left', filter: 'text' },
        { id: 'age', header: 'Age', width: 300, filter: 'number' },
        { id: 'dept', header: 'Dept', width: 300, filter: 'set' },
        { id: 'joined', header: 'Joined', width: 300, filter: 'date' },
        { id: 'active', header: 'Active', width: 300, filter: 'boolean' }
    ]

    async function openOn(header: string) {
        const grid = createDataGrid<Person>({
            columns: wide,
            data: people,
            getRowId,
            features: [filtering(), sorting(), columnOps()]
        })
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()
        await page.getByRole('button', { name: `Filter ${header}` }).click()
        const dialog = page.getByRole('dialog', { name: `Filter ${header}` })
        await expect.element(dialog).toBeVisible()
        return { screen, panel: dialog.element() as HTMLElement }
    }

    it('paints above the pinned header cells rather than under them', async () => {
        const { panel } = await openOn('Age')
        const rect = panel.getBoundingClientRect()

        // Sample the panel: every point in it must belong to the panel. It used
        // to lose its top strip to the pinned headers, because the wrapper
        // around the header controls opened a stacking context around it.
        const covered: string[] = []
        for (let dx = 4; dx < rect.width; dx += 24) {
            for (let dy = 4; dy < rect.height; dy += 24) {
                const hit = document.elementFromPoint(rect.x + dx, rect.y + dy)
                if (hit && !panel.contains(hit))
                    covered.push(hit.getAttribute('role') ?? hit.tagName)
            }
        }
        for (const role of covered) expect(role).toBe('')
    })

    it('survives being closed and opened again', async () => {
        // The panel is moved to `document.body`, out of the block that owns it.
        // Reopening is where a mishandled anchor would show up as a panel that
        // never comes back, or two of them.
        const { screen } = await openOn('Age')

        await userEvent.keyboard('{Escape}')
        await expect
            .element(page.getByRole('dialog', { name: 'Filter Age' }))
            .not.toBeInTheDocument()

        await page.getByRole('button', { name: 'Filter Age' }).click()
        await expect.element(page.getByRole('dialog', { name: 'Filter Age' })).toBeVisible()
        expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1)

        // And it still filters, so the move did not sever it from its grid.
        await page.getByRole('dialog', { name: 'Filter Age' }).getByRole('spinbutton').fill('30')
        await page.getByRole('button', { name: 'Apply' }).click()
        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '2')
    })

    it('keeps a long translation inside the panel', async () => {
        const grid = createDataGrid<Person>({
            columns: wide,
            data: people,
            getRowId,
            // German is the length the English default never reaches; the row
            // holding it used to push the add-condition button out through the
            // panel's right edge.
            labels: { matchCase: 'Groß-/Kleinschreibung beachten' },
            features: [filtering(), sorting(), columnOps()]
        })
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()
        await page.getByRole('button', { name: 'Filter Name' }).click()

        const panel = page.getByRole('dialog', { name: 'Filter Name' })
        await expect.element(panel).toBeVisible()
        await expect.element(page.getByText('Groß-/Kleinschreibung beachten')).toBeVisible()

        const box = (panel.element() as HTMLElement).getBoundingClientRect()
        const escaping = [...(panel.element() as HTMLElement).querySelectorAll('*')]
            .map((node) => node.getBoundingClientRect())
            .filter(
                (rect) => rect.width > 0 && (rect.right > box.right + 1 || rect.left < box.left - 1)
            )
        expect(escaping).toHaveLength(0)
    })

    it('follows its trigger when the grid scrolls sideways', async () => {
        const { screen, panel } = await openOn('Age')
        const before = panel.getBoundingClientRect().x

        const viewport = screen.container.querySelector<HTMLElement>('[role="grid"]')!
        viewport.scrollLeft = 120
        viewport.dispatchEvent(new Event('scroll', { bubbles: true }))

        // Fixed to the viewport, so without re-anchoring it would sit still
        // while the column it belongs to slid out from under it.
        await expect
            .poll(() => Math.round(panel.getBoundingClientRect().x))
            .not.toBe(Math.round(before))
    })
})

describe('popup layering', () => {
    /** Every sampled point inside `element` that some other element covers. */
    function coveredPoints(element: HTMLElement): string[] {
        const rect = element.getBoundingClientRect()
        const covered: string[] = []
        for (let dx = 4; dx < rect.width; dx += 24) {
            for (let dy = 4; dy < rect.height; dy += 24) {
                const hit = document.elementFromPoint(rect.x + dx, rect.y + dy)
                if (hit && !element.contains(hit)) {
                    covered.push(hit.getAttribute('role') ?? hit.tagName)
                }
            }
        }
        return covered
    }

    async function openPanel() {
        const grid = createDataGrid<Person>({
            columns: [
                { id: 'id', header: 'Id', width: 80, pinned: 'left' },
                { id: 'name', header: 'Name', width: 260, filter: 'text' },
                { id: 'age', header: 'Age', width: 200, filter: 'number' }
            ],
            data: people,
            getRowId,
            features: [filtering(), sorting(), columnOps()]
        })
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()
        await page.getByRole('button', { name: 'Filter Name' }).click()
        await expect.element(page.getByRole('dialog', { name: 'Filter Name' })).toBeVisible()
        return screen
    }

    it('draws an operator list above the panel that opened it', async () => {
        await openPanel()

        await page.getByRole('button', { name: 'Filter operator' }).click()
        const listbox = page.getByRole('listbox')
        await expect.element(listbox).toBeVisible()

        // The panel and the sv5ui popup layer used to share `z-50`, which left
        // the winner to DOM order — and the panel is appended last, so it
        // covered its own operator list.
        for (const role of coveredPoints(listbox.element() as HTMLElement)) {
            expect(role).toBe('')
        }
    })

    it('keeps the whole grid below the popup layer', async () => {
        // One assertion for the stack as a whole: nothing the grid paints may
        // reach the level sv5ui portals its menus and listboxes to.
        await openPanel()
        const gridZ = [...document.querySelectorAll<HTMLElement>('[role="grid"] *')]
            .map((element) => Number(getComputedStyle(element).zIndex))
            .filter((z) => Number.isFinite(z))
        const panel = document.querySelector<HTMLElement>('[role="dialog"]')!

        expect(Math.max(...gridZ, 0)).toBeLessThan(Number(getComputedStyle(panel).zIndex))
        expect(Number(getComputedStyle(panel).zIndex)).toBeLessThan(50)
    })
})

interface Team {
    id: number
    name: string
    share: number
}

const TeamGrid = DataGrid as unknown as Component<DataGridProps<Team>>

/** The shape the /qa page has: a ratio in the row, a percentage on screen. */
const teams: Team[] = [
    { id: 1, name: 'Core', share: 0.05 },
    { id: 2, name: 'Data', share: 0.1 },
    { id: 3, name: 'Infra', share: 0.42 }
]

const teamColumns: ColumnDef<Team>[] = [
    { id: 'name', header: 'Name', flex: 1, minWidth: 140 },
    { id: 'share', header: 'Share', width: 120, filter: 'number', type: 'percent' }
]

describe('a column drawing a unit filters in that unit', () => {
    async function openShareFilter() {
        const screen = await render(TeamGrid, {
            data: teams,
            columns: teamColumns,
            getRowId: (team: Team) => String(team.id),
            toolbar: true
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()
        await page.getByRole('button', { name: 'Filter Share' }).click()
        const dialog = page.getByRole('dialog', { name: 'Filter Share' })
        await expect.element(dialog).toBeVisible()
        return { screen, dialog }
    }

    it('finds the row drawn as 5% for the 5 that was typed', async () => {
        const { screen, dialog } = await openShareFilter()
        await dialog.getByRole('spinbutton').fill('5')
        await dialog.getByRole('button', { name: 'Apply' }).click()

        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '2')
        expect(firstColumn(screen.container)).toEqual(['Core'])
    })

    it('says the percentage back in the chip, not the ratio behind it', async () => {
        const { dialog } = await openShareFilter()
        await dialog.getByRole('spinbutton').fill('5')
        await dialog.getByRole('button', { name: 'Apply' }).click()

        await expect
            .element(page.getByRole('button', { name: /Remove filter Share/ }))
            .toHaveTextContent('Share: = 5%')
    })

    it('reopens on the number that was typed', async () => {
        const { dialog } = await openShareFilter()
        await dialog.getByRole('spinbutton').fill('5')
        await dialog.getByRole('button', { name: 'Apply' }).click()

        // Exact: once a filter is set, the chip's "Remove filter Share" also
        // contains the trigger's name.
        await page.getByRole('button', { name: 'Filter Share', exact: true }).click()
        const reopened = page.getByRole('dialog', { name: 'Filter Share' })
        await expect.element(reopened.getByRole('spinbutton')).toHaveValue(5)
    })
})
