import axe from 'axe-core'
import type { Component } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    filtering,
    getFiltering,
    getSelection,
    pagination,
    selection,
    sorting,
    type ColumnDef,
    type DataGridProps,
    type GridState,
    type SelectionOptions
} from '$lib/index.js'

interface Person {
    id: number
    name: string
    dept: string
    active: boolean
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

const people: Person[] = [
    { id: 1, name: 'Alice', dept: 'Core', active: true },
    { id: 2, name: 'Bob', dept: 'Data', active: false },
    { id: 3, name: 'Carol', dept: 'Core', active: true },
    { id: 4, name: 'Dave', dept: 'Infra', active: true },
    { id: 5, name: 'Erin', dept: 'Data', active: true }
]

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name', sortable: true, flex: 1, minWidth: 140, filter: 'text' },
    { id: 'dept', header: 'Dept', width: 120, filter: 'set' },
    { id: 'active', header: 'Active', width: 110 }
]

const getRowId = (person: Person) => String(person.id)

function makeGrid(options: SelectionOptions<Person> = {}): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId,
        features: [filtering(), sorting(), columnOps(), selection(options), pagination({})]
    })
}

async function renderGrid(grid: GridState<Person>) {
    const screen = await render(TypedDataGrid, { grid })
    await expect.element(screen.getByRole('grid')).toBeVisible()
    return screen
}

function selectedNames(grid: GridState<Person>): string[] {
    return getSelection(grid)!
        .getSelectedRows()
        .map((row) => row.name)
}

describe('selection checkbox column', () => {
    it('toggles a row via its checkbox and marks the row selected', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        await page.getByRole('checkbox', { name: 'Select row 1' }).click()
        expect(selectedNames(grid)).toEqual(['Alice'])

        const row = screen.container.querySelector('[role="row"][aria-selected="true"]')
        expect(row?.textContent).toContain('Alice')

        await page.getByRole('checkbox', { name: 'Select row 1' }).click()
        expect(selectedNames(grid)).toEqual([])
    })

    it('select-all cycles none → all → none and shows indeterminate for partial', async () => {
        const grid = makeGrid()
        await renderGrid(grid)
        const state = getSelection(grid)!

        const selectAll = page.getByRole('checkbox', { name: 'Select all rows' })
        await selectAll.click()
        expect(state.count).toBe(5)

        await selectAll.click()
        expect(state.count).toBe(0)

        state.select('1')
        await expect.element(selectAll).toHaveAttribute('aria-checked', 'mixed')
    })

    it('shift+click selects a range through checkboxes', async () => {
        const grid = makeGrid()
        await renderGrid(grid)

        await page.getByRole('checkbox', { name: 'Select row 2' }).click()
        await userEvent.keyboard('{Shift>}')
        await page.getByRole('checkbox', { name: 'Select row 4' }).click()
        await userEvent.keyboard('{/Shift}')

        expect(selectedNames(grid)).toEqual(['Bob', 'Carol', 'Dave'])
    })

    it('disables checkboxes for unselectable rows and skips them in select-all', async () => {
        const grid = makeGrid({ isRowSelectable: (person) => person.active })
        await renderGrid(grid)

        await expect.element(page.getByRole('checkbox', { name: 'Select row 2' })).toBeDisabled()

        await page.getByRole('checkbox', { name: 'Select all rows' }).click()
        expect(selectedNames(grid)).toEqual(['Alice', 'Carol', 'Dave', 'Erin'])
    })

    it('keeps selection when a filter hides and re-shows rows', async () => {
        const grid = makeGrid()
        await renderGrid(grid)
        const state = getSelection(grid)!

        await page.getByRole('checkbox', { name: 'Select row 2' }).click()
        expect(state.count).toBe(1)

        getFiltering(grid)!.setColumnFilter('dept', { kind: 'set', values: ['Core'] })
        await expect
            .element(page.getByRole('checkbox', { name: 'Select row 2' }))
            .not.toBeInTheDocument()
        expect(state.count).toBe(1)

        getFiltering(grid)!.setColumnFilter('dept', null)
        await expect.element(page.getByRole('checkbox', { name: 'Select row 2' })).toBeChecked()
        expect(selectedNames(grid)).toEqual(['Bob'])
    })
})

describe('selection keyboard', () => {
    it('Space toggles and Ctrl+A selects all from a focused cell', async () => {
        const grid = makeGrid()
        await renderGrid(grid)
        const state = getSelection(grid)!

        await page.getByRole('gridcell', { name: 'Bob' }).click()
        await userEvent.keyboard(' ')
        expect(selectedNames(grid)).toEqual(['Bob'])

        await userEvent.keyboard('{Control>}a{/Control}')
        expect(state.count).toBe(5)
    })

    it('does not hijack Space when the checkbox itself has focus', async () => {
        const grid = makeGrid()
        await renderGrid(grid)

        const checkbox = page.getByRole('checkbox', { name: 'Select row 3' })
        await checkbox.click()
        expect(selectedNames(grid)).toEqual(['Carol'])

        await userEvent.keyboard(' ')
        expect(selectedNames(grid)).toEqual([])
    })
})

describe('clipboard + export', () => {
    it('copies selected rows as TSV via Ctrl+C', async () => {
        const grid = makeGrid()
        await renderGrid(grid)
        const state = getSelection(grid)!

        state.select('1')
        state.select('3')

        const written: string[] = []
        vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (text) => {
            written.push(text)
        })

        await page.getByRole('gridcell', { name: 'Alice' }).click()
        await userEvent.keyboard('{Control>}c{/Control}')

        expect(written).toEqual(['Alice\tCore\ttrue\nCarol\tCore\ttrue'])
        expect(grid.announcer.message).toBe('2 rows copied')
        vi.restoreAllMocks()
    })

    it('exports CSV with headers through a blob download', async () => {
        const grid = makeGrid()
        await renderGrid(grid)
        const state = getSelection(grid)!
        state.select('2')

        const blobs: Blob[] = []
        const createUrl = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
            blobs.push(blob as Blob)
            return 'blob:mock'
        })
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

        state.exportCsv({ filename: 'people.csv' })

        expect(createUrl).toHaveBeenCalledOnce()
        expect(click).toHaveBeenCalledOnce()
        expect(blobs[0].type).toBe('text/csv;charset=utf-8')
        const text = await blobs[0].text()
        expect(text).toBe('Name,Dept,Active\r\nBob,Data,false')
        expect(blobs[0].size).toBe(new TextEncoder().encode(`\ufeff${text}`).length)
        vi.restoreAllMocks()
    })

    it('exports the named columns, in that order, with the chosen delimiter', async () => {
        const grid = makeGrid()
        await renderGrid(grid)
        const state = getSelection(grid)!
        state.select('2')

        const blobs: Blob[] = []
        vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
            blobs.push(blob as Blob)
            return 'blob:mock'
        })
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

        state.exportCsv({ columns: ['dept', 'name'], delimiter: ';' })

        expect(await blobs[0].text()).toBe('Dept;Name\r\nData;Bob')
        vi.restoreAllMocks()
    })

    it('writes what the formatter returns rather than the raw value', async () => {
        const grid = makeGrid()
        await renderGrid(grid)
        const state = getSelection(grid)!
        state.select('2')

        const blobs: Blob[] = []
        vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
            blobs.push(blob as Blob)
            return 'blob:mock'
        })
        vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
        vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

        state.exportCsv({
            columns: ['active'],
            headers: false,
            formatValue: ({ value }) => (value ? 'Có' : 'Không')
        })

        expect(await blobs[0].text()).toBe('Không')
        vi.restoreAllMocks()
    })

    it('opens the context menu with copy and export items', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        getSelection(grid)!.select('1')

        const cell = screen.container.querySelector<HTMLElement>('[data-dg-cell="0:1"]')!
        cell.dispatchEvent(
            new MouseEvent('contextmenu', { bubbles: true, clientX: 100, clientY: 100 })
        )

        await expect
            .element(page.getByRole('menuitem', { name: 'Copy', exact: true }))
            .toBeVisible()
        await expect.element(page.getByRole('menuitem', { name: 'Export CSV' })).toBeVisible()
        await page.getByRole('menuitem', { name: 'Clear selection' }).click()
        expect(getSelection(grid)!.count).toBe(0)
    })
})

describe('status bar + a11y', () => {
    it('shows the selected count and passes axe with selection active', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const state = getSelection(grid)!

        state.select('1')
        state.select('4')
        await expect.element(screen.getByText(/2 selected/)).toBeVisible()

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })
})
