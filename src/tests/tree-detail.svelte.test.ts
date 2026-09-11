import {
    createDataGrid,
    filtering,
    sorting,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'
import axe from 'axe-core'
import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import DataGrid from '../lib/components/grid/DataGrid.svelte'
import {
    getMasterDetail,
    masterDetail
} from '../lib/features/master-detail/master-detail.svelte.js'
import { getTree, tree } from '../lib/features/tree/tree.svelte.js'

interface Node {
    id: string
    name: string
    parent: string | null
    size: number
}

const rows: Node[] = [
    { id: 'src', name: 'src', parent: null, size: 0 },
    { id: 'lib', name: 'lib', parent: 'src', size: 0 },
    { id: 'grid.ts', name: 'grid.ts', parent: 'lib', size: 12 },
    { id: 'util.ts', name: 'util.ts', parent: 'lib', size: 4 },
    { id: 'readme', name: 'README.md', parent: null, size: 2 }
]

const columns: ColumnDef<Node>[] = [
    { id: 'name', header: 'Name', width: 240, filter: 'text' },
    { id: 'size', header: 'Size', align: 'right', width: 100 }
]

const TypedGrid = DataGrid as unknown as Component<DataGridProps<Node>>

function treeGrid(depth = 0): GridState<Node> {
    return createDataGrid<Node>({
        columns,
        data: rows,
        getRowId: (row) => row.id,
        features: [
            sorting(),
            filtering(),
            tree({ getParentId: (row) => row.parent, defaultExpandedDepth: depth })
        ]
    })
}

async function renderGrid(grid: GridState<Node>) {
    const screen = await render(TypedGrid, { grid })
    await expect.element(screen.getByRole('treegrid')).toBeVisible()
    return screen
}

function renderedIds(grid: GridState<Node>): string[] {
    return grid.nodes.map((node) => node.id)
}

describe('tree data', () => {
    it('renders as a treegrid with only the roots visible', async () => {
        const grid = treeGrid()
        const screen = await renderGrid(grid)

        expect(renderedIds(grid)).toEqual(['src', 'readme'])
        await expect.element(screen.getByRole('treegrid')).toBeVisible()
    })

    it('expands a level at a time from the chevron', async () => {
        const grid = treeGrid()
        const screen = await renderGrid(grid)

        await page.getByRole('button', { name: 'Expand row' }).first().click()
        await expect.poll(() => renderedIds(grid)).toEqual(['src', 'lib', 'readme'])

        await page.getByRole('button', { name: 'Expand row' }).first().click()
        await expect
            .poll(() => renderedIds(grid))
            .toEqual(['src', 'lib', 'grid.ts', 'util.ts', 'readme'])
        void screen
    })

    it('carries level and set position into the DOM for assistive tech', async () => {
        const grid = treeGrid(2)
        const screen = await renderGrid(grid)
        await expect.poll(() => renderedIds(grid).length).toBe(5)

        const row = (id: string) =>
            screen.container.querySelector(`[data-dg-row-id="${id}"]`) as HTMLElement

        expect(row('src').getAttribute('aria-level')).toBe('1')
        expect(row('src').getAttribute('aria-expanded')).toBe('true')
        expect(row('lib').getAttribute('aria-level')).toBe('2')
        expect(row('grid.ts').getAttribute('aria-level')).toBe('3')
        expect(row('grid.ts').getAttribute('aria-posinset')).toBe('1')
        expect(row('grid.ts').getAttribute('aria-setsize')).toBe('2')
    })

    it('opens to the default depth without fighting a manual collapse', async () => {
        const grid = treeGrid(1)
        await renderGrid(grid)
        await expect.poll(() => renderedIds(grid)).toEqual(['src', 'lib', 'readme'])

        grid.expansion.collapse('src')
        await expect.poll(() => renderedIds(grid)).toEqual(['src', 'readme'])
    })

    it('expands and collapses everything through the api', async () => {
        const grid = treeGrid()
        await renderGrid(grid)

        ;(grid.api.expandAllRows as () => void)()
        await expect.poll(() => renderedIds(grid).length).toBe(5)
        ;(grid.api.collapseAllRows as () => void)()
        await expect.poll(() => renderedIds(grid)).toEqual(['src', 'readme'])
    })

    it('keeps a filtered descendant reachable after its parent is gone', async () => {
        const grid = treeGrid()
        await renderGrid(grid)
        ;(grid.api.setQuickFilter as (query: string) => void)('grid.ts')

        await expect.poll(() => renderedIds(grid)).toEqual(['grid.ts'])
    })

    it('refuses a config with no way to find the hierarchy', () => {
        expect(() =>
            createDataGrid<Node>({
                columns,
                data: rows,
                getRowId: (row) => row.id,
                features: [tree({})]
            })
        ).toThrow(/getChildren or getParentId/)
    })

    it('is axe-clean with the tree open', async () => {
        const grid = treeGrid(2)
        const screen = await renderGrid(grid)
        await expect.poll(() => renderedIds(grid).length).toBe(5)

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })
})

interface Order {
    id: number
    customer: string
    lines: number
}

const orders: Order[] = [
    { id: 1, customer: 'Alice', lines: 3 },
    { id: 2, customer: 'Bob', lines: 0 },
    { id: 3, customer: 'Charlie', lines: 2 }
]

const orderColumns: ColumnDef<Order>[] = [
    { id: 'customer', header: 'Customer', width: 200 },
    { id: 'lines', header: 'Lines', align: 'right', width: 100 }
]

const TypedOrders = DataGrid as unknown as Component<DataGridProps<Order>>

function detailGrid(single = false): GridState<Order> {
    return createDataGrid<Order>({
        columns: orderColumns,
        data: orders,
        getRowId: (order) => String(order.id),
        features: [masterDetail({ hasDetail: (order) => order.lines > 0, single })]
    })
}

describe('master / detail', () => {
    it('opens a full-width panel under the master row', async () => {
        const grid = detailGrid()
        const screen = await render(TypedOrders, { grid })
        await expect.element(screen.getByRole('treegrid')).toBeVisible()

        expect(grid.nodes.map((node) => node.id)).toEqual(['1', '2', '3'])

        await page.getByRole('button', { name: 'Expand row' }).first().click()
        await expect
            .poll(() => grid.nodes.map((node) => node.id))
            .toEqual(['1', 'detail:1', '2', '3'])
        expect(grid.nodes[1]!.meta?.fullWidth).toBe(true)
    })

    it('offers no chevron to a row with nothing to show', async () => {
        const grid = detailGrid()
        await render(TypedOrders, { grid })
        await expect.poll(() => grid.nodes.length).toBe(3)

        const buttons = await page.getByRole('button', { name: 'Expand row' }).all()
        expect(buttons).toHaveLength(2)
    })

    it('keeps a single panel open when asked', async () => {
        const grid = detailGrid(true)
        await render(TypedOrders, { grid })
        await expect.poll(() => grid.nodes.length).toBe(3)

        getMasterDetail(grid)!.toggle('1')
        await expect.poll(() => grid.nodes.length).toBe(4)

        getMasterDetail(grid)!.toggle('3')
        await expect
            .poll(() => grid.nodes.map((node) => node.id))
            .toEqual(['1', '2', '3', 'detail:3'])
    })

    it('closes every panel through the api', async () => {
        const grid = detailGrid()
        await render(TypedOrders, { grid })
        getMasterDetail(grid)!.toggle('1')
        await expect.poll(() => grid.nodes.length).toBe(4)

        ;(grid.api.closeAllDetails as () => void)()
        await expect.poll(() => grid.nodes.length).toBe(3)
    })

    it('toggles with the keyboard like any other expandable row', async () => {
        const grid = detailGrid()
        const screen = await render(TypedOrders, { grid })
        await expect.poll(() => grid.nodes.length).toBe(3)

        screen.container.querySelector<HTMLElement>('[data-dg-cell="0:0"]')!.focus()
        await userEvent.keyboard('{Enter}')
        await expect.poll(() => grid.nodes.length).toBe(4)
    })
})

describe('tree and detail interop', () => {
    it('reports which nodes are detail rows', async () => {
        const grid = detailGrid()
        await render(TypedOrders, { grid })
        getMasterDetail(grid)!.toggle('1')
        await expect.poll(() => grid.nodes.length).toBe(4)

        const detail = grid.nodes[1]!
        expect(getMasterDetail(grid)!.isDetailRow(detail)).toBe(true)
        expect(getMasterDetail(grid)!.masterOf(detail)).toBe('1')
        expect(getTree(grid)).toBeUndefined()
    })
})
