import {
    createDataGrid,
    sorting,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'
import axe from 'axe-core'
import type { Component } from 'svelte'
import { InGrid } from './fixtures/in-root.js'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import DataGrid from '../lib/components/grid/DataGrid.svelte'
import GroupPanel from '../lib/components/panels/GroupPanel.svelte'
import { getGrouping, grouping } from '../lib/features/grouping/grouping.svelte.js'
import type { GroupingOptions } from '../lib/features/grouping/grouping.types.js'

interface Person {
    id: number
    name: string
    dept: string
    country: string
    salary: number
}

const people: Person[] = [
    { id: 1, name: 'Alice', dept: 'Core', country: 'VN', salary: 100 },
    { id: 2, name: 'Bob', dept: 'Core', country: 'VN', salary: 200 },
    { id: 3, name: 'Carol', dept: 'Core', country: 'US', salary: 300 },
    { id: 4, name: 'Dave', dept: 'Data', country: 'US', salary: 400 }
]

const columns: ColumnDef<Person>[] = [
    { id: 'dept', header: 'Dept', flex: 1, minWidth: 200 },
    { id: 'country', header: 'Country', width: 130 },
    { id: 'name', header: 'Name', width: 160 },
    { id: 'salary', header: 'Salary', align: 'right', width: 130 }
]

const TypedGrid = DataGrid as unknown as Component<DataGridProps<Person>>
const TypedPanel = InGrid

const inRoot = (grid: GridState<Person>) => ({ props: { grid, component: GroupPanel } })

function makeGrid(options: GroupingOptions<Person> = {}): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (person) => String(person.id),
        features: [
            sorting(),
            grouping<Person>({
                expandedByDefault: false,
                aggregations: { salary: 'sum' },
                ...options
            })
        ]
    })
}

function rowIds(container: Element): string[] {
    return [...container.querySelectorAll('[data-dg-row-id]')].map((row) =>
        row.getAttribute('data-dg-row-id')!
    )
}

async function renderGrid(grid: GridState<Person>) {
    const screen = await render(TypedGrid, { grid })
    await expect.element(screen.getByRole('treegrid')).toBeVisible()
    return screen
}

describe('grouping through the pipeline', () => {
    it('renders group rows the kernel treats as treegrid nodes', async () => {
        const grid = makeGrid({ by: ['dept'] })
        const screen = await renderGrid(grid)

        expect(rowIds(screen.container)).toEqual(['group:dept=Core', 'group:dept=Data'])

        const groupRow = screen.container.querySelector('[data-dg-row-id="group:dept=Core"]')!
        expect(groupRow.getAttribute('aria-level')).toBe('1')
        expect(groupRow.getAttribute('aria-expanded')).toBe('false')
        expect(groupRow.getAttribute('aria-setsize')).toBe('2')
        expect(groupRow.textContent).toContain('Core (3)')
    })

    it('expands and collapses a group with the kernel chevron', async () => {
        const grid = makeGrid({ by: ['dept'] })
        const screen = await renderGrid(grid)

        await page.getByRole('button', { name: 'Expand row' }).first().click()
        await expect
            .poll(() => rowIds(screen.container))
            .toEqual(['group:dept=Core', '1', '2', '3', 'group:dept=Data'])

        await page.getByRole('button', { name: 'Collapse row' }).first().click()
        await expect
            .poll(() => rowIds(screen.container))
            .toEqual(['group:dept=Core', 'group:dept=Data'])
    })

    it('shows aggregates in their own column on the group row', async () => {
        const grid = makeGrid({ by: ['dept'] })
        const screen = await renderGrid(grid)

        const cells = screen.container.querySelectorAll(
            '[data-dg-row-id="group:dept=Core"] [role="gridcell"]'
        )
        expect(cells[0]!.textContent).toContain('Core (3)')
        expect(cells[3]!.textContent?.trim()).toBe('600')
    })

    it('nests several grouping levels', async () => {
        const grid = makeGrid({ by: ['dept', 'country'] })
        const screen = await renderGrid(grid)
        getGrouping(grid)!.expandAllGroups()

        await expect
            .poll(() => rowIds(screen.container).slice(0, 3))
            .toEqual(['group:dept=Core', 'group:dept=Core|country=VN', '1'])
        const nested = screen.container.querySelector(
            '[data-dg-row-id="group:dept=Core|country=VN"]'
        )!
        expect(nested.getAttribute('aria-level')).toBe('2')
    })

    it('is axe-clean while grouped', async () => {
        const grid = makeGrid({ by: ['dept'] })
        const screen = await renderGrid(grid)

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })
})

describe('GroupPanel', () => {
    it('adds and removes grouping levels', async () => {
        const grid = makeGrid()
        const screen = await render(TypedPanel, inRoot(grid))
        await expect.element(page.getByText('Group by', { exact: true })).toBeVisible()

        await page.getByRole('button', { name: 'Add group' }).click()
        await page.getByRole('menuitem', { name: 'Dept' }).click()
        expect(getGrouping(grid)!.by).toEqual(['dept'])

        await page.getByRole('button', { name: 'Remove Dept grouping' }).click()
        expect(getGrouping(grid)!.by).toEqual([])
        expect(screen.container.textContent).toContain('No grouping')
    })

    it('reorders levels with the chevron buttons', async () => {
        const grid = makeGrid({ by: ['dept', 'country'] })
        await render(TypedPanel, inRoot(grid))

        await page.getByRole('button', { name: 'Move Country earlier' }).click()
        expect(getGrouping(grid)!.by).toEqual(['country', 'dept'])
    })
})
