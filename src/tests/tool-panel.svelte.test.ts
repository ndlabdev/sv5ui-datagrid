import {
    columnOps,
    createDataGrid,
    editing,
    pagination,
    selection,
    sorting,
    virtualization,
    type ColumnDef,
    type GridFeature,
    type GridState
} from '$lib/index.js'
import axe from 'axe-core'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import ToolPanel from '../lib/components/panels/ToolPanel.svelte'
import { InGrid } from './fixtures/in-root.js'
import { getGrouping, grouping } from '../lib/features/grouping/grouping.svelte.js'
import { getRangeSelection, rangeSelection } from '../lib/features/range-selection/index.js'
import { serverRowModel } from '../lib/features/server-row-model/index.js'

interface Sale {
    id: number
    region: string
    rep: string
    total: number
}

const columns: ColumnDef<Sale>[] = [
    { id: 'region', header: 'Region', width: 120 },
    { id: 'rep', header: 'Rep', width: 120 },
    { id: 'total', header: 'Total', width: 120 }
]

const data: Sale[] = [
    { id: 1, region: 'North', rep: 'Alice', total: 10 },
    { id: 2, region: 'South', rep: 'Bob', total: 20 }
]

// The panel takes its grid from context, so it is mounted inside one.
const TypedPanel = InGrid

const inRoot = (grid: GridState<Sale>) => ({ props: { grid, component: ToolPanel } })

function makeGrid(): GridState<Sale> {
    return createDataGrid<Sale>({
        columns,
        data,
        getRowId: (row) => String(row.id),
        features: [sorting(), columnOps(), selection(), editing(), grouping<Sale>()]
    })
}

async function openActions(container: Element, columnId: string) {
    container
        .querySelector<HTMLElement>(`[data-dg-tool-column="${columnId}"] button[aria-label]`)!
        .click()
    await vi.waitFor(() =>
        expect(document.querySelectorAll('[role="menuitem"]').length).toBeGreaterThan(0)
    )
}

async function chooseAction(name: RegExp) {
    await page.getByRole('menuitem', { name }).click()
}

const rowFor = (container: Element, id: string) =>
    container.querySelector<HTMLElement>(`[data-dg-tool-column="${id}"]`)!

describe('the tool panel drives the grid it is given', () => {
    it('hides and shows a column', async () => {
        const grid = makeGrid()
        const screen = await render(TypedPanel, inRoot(grid))

        const checkbox = rowFor(screen.container, 'rep').querySelector<HTMLElement>(
            '[role="checkbox"]'
        )!
        checkbox.click()
        await vi.waitFor(() => expect(grid.columns.get('rep')?.hidden).toBe(true))

        checkbox.click()
        await vi.waitFor(() => expect(grid.columns.get('rep')?.hidden).toBe(false))
    })

    it('pins a column and unpins it on a second press', async () => {
        const grid = makeGrid()
        const screen = await render(TypedPanel, inRoot(grid))

        await openActions(screen.container, 'total')
        await chooseAction(/Pin left/)
        await vi.waitFor(() => expect(grid.columns.get('total')?.pinned).toBe('left'))

        await openActions(screen.container, 'total')
        await chooseAction(/Unpin/)
        await vi.waitFor(() => expect(grid.columns.get('total')?.pinned).toBeFalsy())
    })

    it('moves a column along the visible order', async () => {
        const grid = makeGrid()
        const screen = await render(TypedPanel, inRoot(grid))
        const before = grid.columns.visible.map((column) => column.id)

        await openActions(screen.container, 'total')
        await chooseAction(/earlier/)
        await vi.waitFor(() =>
            expect(grid.columns.visible.map((column) => column.id)).not.toEqual(before)
        )
    })

    it('never offers the selection checkbox column', async () => {
        const grid = makeGrid()
        const screen = await render(TypedPanel, inRoot(grid))

        expect(screen.container.querySelectorAll('[data-dg-tool-column]')).toHaveLength(3)
    })

    it('filters its own list without touching the grid', async () => {
        const grid = makeGrid()
        const screen = await render(TypedPanel, inRoot(grid))
        const search = screen.container.querySelector('input')!

        search.value = 'reg'
        search.dispatchEvent(new Event('input', { bubbles: true }))
        await vi.waitFor(() =>
            expect(screen.container.querySelectorAll('[data-dg-tool-column]')).toHaveLength(1)
        )
        expect(grid.columns.visible.length).toBe(4)
    })

    it('groups and ungroups from the group tab', async () => {
        const grid = makeGrid()
        const screen = await render(TypedPanel, inRoot(grid))

        await page.getByRole('tab', { name: 'Groups' }).click()
        screen.container
            .querySelector<HTMLElement>('[data-dg-tool-groupable="region"] button')!
            .click()
        await vi.waitFor(() => expect(getGrouping(grid)!.by).toEqual(['region']))

        screen.container
            .querySelector<HTMLElement>('[data-dg-tool-grouped="region"] button')!
            .click()
        await vi.waitFor(() => expect(getGrouping(grid)!.by).toEqual([]))
    })

    it('is axe-clean on every tab', async () => {
        const grid = makeGrid()
        const screen = await render(TypedPanel, inRoot(grid))

        const settled = async () => {
            let previous = ''
            await vi.waitFor(
                () => {
                    const active = screen.container.querySelector(
                        '[role="tab"][data-state="active"]'
                    )
                    const box = JSON.stringify(active?.getBoundingClientRect())
                    const stable = box === previous
                    previous = box
                    expect(stable, 'the tab indicator is still moving').toBe(true)
                },
                { timeout: 2_000, interval: 120 }
            )
        }

        for (const tab of ['Columns', 'Groups', 'Values']) {
            await page.getByRole('tab', { name: tab }).click()
            await settled()
            const results = await axe.run(screen.container, {
                rules: { region: { enabled: false } }
            })
            expect(
                results.violations.map(
                    (violation) =>
                        `${violation.id}: ${violation.nodes.map((node) => node.html).join(' | ')}`
                )
            ).toEqual([])
        }
    })
})

describe('the tool panel collapses', () => {
    it('folds to a header and opens again', async () => {
        const grid = makeGrid()
        const screen = await render(TypedPanel, inRoot(grid))

        expect(screen.container.querySelectorAll('[data-dg-tool-column]')).toHaveLength(3)
        await page.getByRole('button', { name: 'Collapse panel' }).click()
        await vi.waitFor(() =>
            expect(screen.container.querySelectorAll('[data-dg-tool-column]')).toHaveLength(0)
        )

        await page.getByRole('button', { name: 'Expand panel' }).click()
        await vi.waitFor(() =>
            expect(screen.container.querySelectorAll('[data-dg-tool-column]')).toHaveLength(3)
        )
    })

    it('starts folded when the app says so', async () => {
        const grid = makeGrid()
        const screen = await render(TypedPanel, {
            props: { grid, component: ToolPanel, partProps: { collapsed: true } }
        })

        expect(screen.container.querySelectorAll('[data-dg-tool-column]')).toHaveLength(0)
        expect(screen.container.querySelector('[data-dg-tool-panel]')?.textContent).toContain(
            'Tools'
        )
    })
})

describe('the tool panel offers only what the grid can actually do', () => {
    const tabsOf = (container: Element) =>
        [...container.querySelectorAll('[role="tab"]')].map((tab) => tab.textContent?.trim())

    it('drops the group and value tabs when the grid has no grouping feature', async () => {
        const grid = createDataGrid<Sale>({
            columns,
            data,
            getRowId: (row) => String(row.id),
            features: [sorting(), columnOps()]
        })
        const screen = await render(TypedPanel, inRoot(grid))

        expect(tabsOf(screen.container)).toEqual(['Columns'])
        expect(screen.container.querySelectorAll('[data-dg-tool-groupable]')).toHaveLength(0)
    })

    it('drops them on a server row model, where the aggregate would only cover what is loaded', async () => {
        const grid = serverGrid('infinite')
        const screen = await render(TypedPanel, inRoot(grid))

        expect(tabsOf(screen.container)).toEqual(['Columns'])
    })
})

const table: Sale[] = Array.from({ length: 40 }, (_, i) => ({
    id: i + 1,
    region: ['North', 'South'][i % 2]!,
    rep: ['Alice', 'Bob', 'Chi'][i % 3]!,
    total: (i + 1) * 10
}))

function serverGrid(mode: 'paged' | 'infinite'): GridState<Sale> {
    const paging: GridFeature<Sale>[] =
        mode === 'paged' ? [pagination({ pageSize: 10 })] : [virtualization()]

    return createDataGrid<Sale>({
        columns,
        data: [],
        getRowId: (row) => String(row.id),
        rowModel: 'server',
        features: [
            columnOps(),
            editing(),
            ...paging,
            serverRowModel<Sale>(
                {
                    getRows: async ({ startRow, endRow }) => ({
                        rows: table.slice(startRow, endRow),
                        rowCount: table.length
                    })
                },
                mode === 'paged'
                    ? { mode: 'paged' }
                    : {
                          mode: 'infinite',
                          blockSize: 10,
                          placeholder: (index) =>
                              ({ id: -index - 1, region: '', rep: '', total: 0 }) as Sale
                      }
            ),
            grouping<Sale>(),
            rangeSelection()
        ]
    })
}

describe('the tool panel on a grid whose rows come from a server', () => {
    async function loaded(grid: GridState<Sale>) {
        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await vi.waitFor(() => expect(grid.preWindowNodes.length).toBeGreaterThan(0))
        return grid
    }

    it('keeps a column hidden across a page change', async () => {
        const grid = await loaded(serverGrid('paged'))
        const screen = await render(TypedPanel, inRoot(grid))

        screen.container
            .querySelector<HTMLElement>('[data-dg-tool-column="rep"] [role="checkbox"]')!
            .click()
        await vi.waitFor(() => expect(grid.columns.get('rep')?.hidden).toBe(true))

        const setPage = grid.api.setPage as (page: number) => void
        setPage(3)
        await vi.waitFor(() => expect(grid.preWindowNodes[0]?.row.id).toBe(21))

        expect(grid.columns.get('rep')?.hidden).toBe(true)
        expect(grid.columns.visible.map((column) => column.id)).toEqual(['region', 'total'])
    })

    it('pins and reorders while rows are still placeholders', async () => {
        const grid = await loaded(serverGrid('infinite'))
        const screen = await render(TypedPanel, inRoot(grid))

        await openActions(screen.container, 'total')
        await chooseAction(/Pin left/)
        await vi.waitFor(() => expect(grid.columns.get('total')?.pinned).toBe('left'))
        expect(grid.columns.visible[0]?.id).toBe('total')
    })

    it('leaves a live range clamped rather than broken when a column goes away', async () => {
        const grid = await loaded(serverGrid('paged'))
        const range = getRangeSelection(grid)!
        range.startRange(0, 0)
        range.extendTo(2, 2)
        range.endRange()

        const screen = await render(TypedPanel, inRoot(grid))
        screen.container
            .querySelector<HTMLElement>('[data-dg-tool-column="region"] [role="checkbox"]')!
            .click()
        await vi.waitFor(() => expect(grid.columns.get('region')?.hidden).toBe(true))

        expect(range.shape).toEqual({ rows: 3, cols: 2 })
        expect(range.getRangeTsv().split('\n')).toHaveLength(3)
    })
})
