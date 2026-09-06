import { createDataGrid, sorting, type ColumnDef, type GridState } from '$lib/index.js'
import axe from 'axe-core'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import FilterBuilder from '../lib/components/panels/FilterBuilder.svelte'
import { InGrid } from './fixtures/in-root.js'
import {
    advancedFilter,
    getAdvancedFilter
} from '../lib/features/advanced-filter/advanced-filter.svelte.js'
import { isBlank } from '../lib/core/utils/index.js'

interface Sale {
    id: number
    note: string
    region: string
    rep: string
    total: number
    closedAt: string
    won: boolean
}

const columns: ColumnDef<Sale>[] = [
    { id: 'region', header: 'Region', filter: 'set' },
    { id: 'won', header: 'Won', type: 'boolean' },
    { id: 'note', header: 'Note', filter: false },
    { id: 'act', header: 'Act', type: 'actions' },
    { id: 'rep', header: 'Rep', filter: 'text' },
    { id: 'total', header: 'Total', type: 'currency', filter: 'number' },
    { id: 'closedAt', header: 'Closed', type: 'date' }
]

const data: Sale[] = [
    {
        id: 1,
        region: 'North',
        rep: 'Alice',
        total: 120,
        closedAt: '2026-01-05',
        won: true,
        note: ''
    },
    {
        id: 2,
        region: 'North',
        rep: 'Bob',
        total: 80,
        closedAt: '2026-02-11',
        won: false,
        note: 'x'
    },
    {
        id: 3,
        region: 'South',
        rep: 'Alice',
        total: 300,
        closedAt: '2026-03-02',
        won: true,
        note: ''
    }
]

// The panel takes its grid from context, so it is mounted inside one.
const TypedBuilder = InGrid

const inRoot = (grid: GridState<Sale>, partProps?: { debounce?: number }) => ({
    props: { grid, component: FilterBuilder, partProps }
})

function makeGrid(): GridState<Sale> {
    return createDataGrid<Sale>({
        columns,
        data,
        getRowId: (row) => String(row.id),
        features: [sorting(), advancedFilter<Sale>()]
    })
}

describe('which columns the panel offers', () => {
    it('leaves out a column that refused, and one with nothing to compare', async () => {
        const grid = makeGrid()
        await render(TypedBuilder, inRoot(grid))

        await page.getByRole('button', { name: 'Add condition' }).first().click()
        await vi.waitFor(() => expect(getAdvancedFilter(grid)!.model.children).toHaveLength(1))

        await page.getByRole('button', { name: 'Column' }).first().click()
        await vi.waitFor(() =>
            expect(document.querySelectorAll('[role="option"]').length).toBeGreaterThan(0)
        )

        const offered = [...document.querySelectorAll('[role="option"]')].map(
            (option) => option.textContent?.trim() ?? ''
        )
        expect(offered).toContain('Rep')
        expect(offered).toContain('Won')
        expect(offered).not.toContain('Note')
        expect(offered).not.toContain('Act')
    })
})

describe('typing a value waits for a pause', () => {
    async function typeInto(grid: GridState<Sale>, text: string) {
        getAdvancedFilter(grid)!.setModel({
            kind: 'group',
            join: 'and',
            children: [{ kind: 'condition', columnId: 'rep', op: 'contains' }]
        })
        const field = page.getByRole('textbox', { name: 'Value' })
        await vi.waitFor(() => expect(field.query()).not.toBeNull())
        await field.fill(text)
    }

    it('leaves the rows alone while the keys are still coming', async () => {
        const grid = makeGrid()
        await render(TypedBuilder, inRoot(grid, { debounce: 5_000 }))

        await typeInto(grid, 'Ali')

        const condition = getAdvancedFilter(grid)!.model.children[0]!
        expect(condition.kind === 'condition' && isBlank(condition.value)).toBe(true)
        expect(grid.preWindowNodes).toHaveLength(data.length)
    })

    it('filters once the typing stops', async () => {
        const grid = makeGrid()
        await render(TypedBuilder, inRoot(grid, { debounce: 20 }))

        await typeInto(grid, 'Ali')

        await vi.waitFor(() => expect(grid.preWindowNodes).toHaveLength(2))
        const condition = getAdvancedFilter(grid)!.model.children[0]!
        expect(condition.kind === 'condition' && condition.value).toBe('Ali')
    })
})

describe('a new condition holds no value until one is picked', () => {
    it('leaves the value empty and the rows alone', async () => {
        const grid = makeGrid()
        await render(TypedBuilder, inRoot(grid))

        await page.getByRole('button', { name: 'Add condition' }).first().click()
        await vi.waitFor(() => expect(getAdvancedFilter(grid)!.model.children).toHaveLength(1))

        const condition = getAdvancedFilter(grid)!.model.children[0]!
        expect(condition.kind === 'condition' && isBlank(condition.value)).toBe(true)
        expect(getAdvancedFilter(grid)!.activeCount).toBe(0)
        expect(grid.preWindowNodes).toHaveLength(data.length)
    })

    it('offers a boolean its own words rather than the operator names', async () => {
        const grid = makeGrid()
        const screen = await render(TypedBuilder, inRoot(grid))

        getAdvancedFilter(grid)!.setModel({
            kind: 'group',
            join: 'and',
            children: [{ kind: 'condition', columnId: 'won', op: 'equals' }]
        })
        await vi.waitFor(() =>
            expect(screen.container.querySelectorAll('[data-dg-filter-row]')).toHaveLength(1)
        )

        const value = screen.container.querySelectorAll('[data-dg-filter-row] button')[2]!
        expect(value.textContent).toContain('Value')
        expect(value.textContent).not.toContain('Equals')
    })
})

describe('the filter builder writes the tree', () => {
    it('adds a condition when asked', async () => {
        const grid = makeGrid()
        const screen = await render(TypedBuilder, inRoot(grid))

        await page.getByRole('button', { name: 'Add condition' }).first().click()
        await vi.waitFor(() => expect(getAdvancedFilter(grid)!.model.children).toHaveLength(1))
        expect(screen.container.querySelectorAll('[data-dg-filter-row]')).toHaveLength(1)
    })

    it('adds a nested group', async () => {
        const grid = makeGrid()
        const screen = await render(TypedBuilder, inRoot(grid))

        await page.getByRole('button', { name: 'Add group' }).first().click()
        await vi.waitFor(() =>
            expect(screen.container.querySelectorAll('[data-dg-filter-group]')).toHaveLength(2)
        )
    })

    it('switches the join and negates the group', async () => {
        const grid = makeGrid()
        await render(TypedBuilder, inRoot(grid))

        await page.getByRole('button', { name: 'OR', exact: true }).first().click()
        await vi.waitFor(() => expect(getAdvancedFilter(grid)!.model.join).toBe('or'))

        await page.getByRole('button', { name: 'NOT', exact: true }).first().click()
        await vi.waitFor(() => expect(getAdvancedFilter(grid)!.model.not).toBe(true))
    })

    it('removes a condition', async () => {
        const grid = makeGrid()
        const screen = await render(TypedBuilder, inRoot(grid))

        await page.getByRole('button', { name: 'Add condition' }).first().click()
        await vi.waitFor(() =>
            expect(screen.container.querySelectorAll('[data-dg-filter-row]')).toHaveLength(1)
        )

        await page.getByRole('button', { name: 'Remove' }).first().click()
        await vi.waitFor(() => expect(getAdvancedFilter(grid)!.model.children).toHaveLength(0))
    })

    it('writes a tree the grid actually filters on', async () => {
        const grid = makeGrid()
        const screen = await render(TypedBuilder, inRoot(grid))
        expect(grid.nodes).toHaveLength(3)

        await page.getByRole('button', { name: 'Add condition' }).first().click()
        await vi.waitFor(() =>
            expect(screen.container.querySelector('[data-dg-filter-row]')).toBeTruthy()
        )

        const state = getAdvancedFilter(grid)!
        state.setModel({
            ...state.model,
            children: [{ kind: 'condition', columnId: 'rep', op: 'equals', value: 'Alice' }]
        })

        await vi.waitFor(() => expect(grid.nodes.map((node) => node.id)).toEqual(['1', '3']))
    })

    it('says the server owns the answer when the grid is server-backed', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = createDataGrid<Sale>({
            columns,
            data,
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [sorting(), advancedFilter<Sale>()]
        })
        const screen = await render(TypedBuilder, inRoot(grid))

        expect(screen.container.textContent).toContain('Answered by your backend')
        warn.mockRestore()
    })

    it('is axe-clean with a nested group on screen', async () => {
        const grid = makeGrid()
        const screen = await render(TypedBuilder, inRoot(grid))

        await page.getByRole('button', { name: 'Add condition' }).first().click()
        await page.getByRole('button', { name: 'Add group' }).first().click()
        await vi.waitFor(() =>
            expect(screen.container.querySelectorAll('[data-dg-filter-group]')).toHaveLength(2)
        )

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })

    it('offers the operators the column type has, and no others', async () => {
        const grid = makeGrid()
        const screen = await render(TypedBuilder, inRoot(grid))
        await page.getByRole('button', { name: 'Add condition' }).first().click()

        const row = () => screen.container.querySelector('[data-dg-filter-row]')!
        await vi.waitFor(() => expect(row()).toBeTruthy())

        const state = getAdvancedFilter(grid)!
        state.setModel({
            ...state.model,
            children: [{ kind: 'condition', columnId: 'total', op: 'gt', value: 100 }]
        })

        await vi.waitFor(() => expect(row().getAttribute('data-dg-filter-kind')).toBe('number'))
        expect(row().querySelector('input')?.type).toBe('number')
    })

    it('gives a date column the same segmented picker a column filter uses', async () => {
        const grid = makeGrid()
        const screen = await render(TypedBuilder, inRoot(grid))
        const state = getAdvancedFilter(grid)!

        state.setModel({
            ...state.model,
            children: [
                { kind: 'condition', columnId: 'closedAt', op: 'before', value: '2026-02-01' }
            ]
        })

        await vi.waitFor(() => {
            const row = screen.container.querySelector('[data-dg-filter-row]')!
            expect(row.getAttribute('data-dg-filter-kind')).toBe('date')
            expect(row.querySelectorAll('[role="spinbutton"]').length).toBeGreaterThan(2)
            expect(row.querySelector('input[type="text"]')).toBeNull()
        })
    })

    it('replaces an operator the new column cannot answer', async () => {
        const grid = makeGrid()
        const screen = await render(TypedBuilder, inRoot(grid))
        const state = getAdvancedFilter(grid)!

        state.setModel({
            ...state.model,
            children: [{ kind: 'condition', columnId: 'rep', op: 'startsWith', value: 'A' }]
        })
        await vi.waitFor(() =>
            expect(screen.container.querySelector('[data-dg-filter-row]')).toBeTruthy()
        )

        await page.getByRole('button', { name: 'Column' }).first().click()
        await page.getByRole('option', { name: 'Total', exact: true }).click()

        await vi.waitFor(() => {
            const condition = state.model.children[0]
            expect(condition?.kind === 'condition' && condition.op).not.toBe('startsWith')
        })
        expect(state.model.children[0]).toMatchObject({ columnId: 'total', value: undefined })
    })
})
