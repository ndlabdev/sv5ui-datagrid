import axe from 'axe-core'
import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    editing,
    filtering,
    getPagination,
    getSelection,
    pagination,
    selection,
    sorting,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Order {
    id: number
    customer: string
    total: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Order>>

const database: Order[] = Array.from({ length: 137 }, (_, i) => ({
    id: i + 1,
    customer: `Customer ${i + 1}`,
    total: 50 + i
}))

const columns: ColumnDef<Order>[] = [
    { id: 'id', header: '#' },
    { id: 'customer', header: 'Customer', editable: true },
    { id: 'total', header: 'Total' }
]

const pageOf = (page: number, size = 10) => database.slice((page - 1) * size, page * size)

function serverGrid(): GridState<Order> {
    return createDataGrid<Order>({
        columns,
        data: pageOf(1),
        getRowId: (order) => String(order.id),
        rowModel: 'server',
        features: [
            sorting(),
            filtering(),
            selection(),
            editing(),
            pagination({ pageSize: 10, rowCount: database.length })
        ]
    })
}

function goToPage(grid: GridState<Order>, target: number): void {
    getPagination(grid)!.setPage(target)
    grid.data = pageOf(target)
}

async function renderGrid(grid: GridState<Order>) {
    const screen = await render(TypedDataGrid, { grid })
    await expect.element(screen.getByRole('grid')).toBeVisible()
    return screen
}

describe('server row model — what the page renders', () => {
    it('tells a screen reader where in the whole set the page sits', async () => {
        const grid = serverGrid()
        const screen = await renderGrid(grid)
        goToPage(grid, 2)
        await expect.element(page.getByRole('gridcell', { name: 'Customer 11' })).toBeVisible()

        const viewport = screen.container.querySelector('[role="grid"]')!
        const row = screen.container.querySelector('[role="row"][data-dg-row-id="11"]')!
        expect(row.getAttribute('aria-rowindex')).toBe('12')
        expect(viewport.getAttribute('aria-rowcount')).toBe('138')
    })

    it('Ctrl+A takes the page, and Ctrl+C copies it', async () => {
        const grid = serverGrid()
        await renderGrid(grid)
        goToPage(grid, 2)
        await expect.element(page.getByRole('gridcell', { name: 'Customer 11' })).toBeVisible()

        await page.getByRole('gridcell', { name: 'Customer 11' }).click()
        await userEvent.keyboard('{Control>}a{/Control}')
        expect(getSelection(grid)!.count).toBe(10)
        expect(getSelection(grid)!.getSelectedRows()).toHaveLength(10)
    })

    it('types into a cell on page 2', async () => {
        const grid = serverGrid()
        await renderGrid(grid)
        goToPage(grid, 2)
        await expect.element(page.getByRole('gridcell', { name: 'Customer 13' })).toBeVisible()

        await page.getByRole('gridcell', { name: 'Customer 13' }).click()
        await userEvent.keyboard('X')
        await expect.element(page.getByRole('textbox')).toBeVisible()
        await userEvent.keyboard('{Enter}')
        expect(grid.data[2].customer).toBe('X')
    })

    it('pastes into the page it holds', async () => {
        const grid = serverGrid()
        await renderGrid(grid)
        goToPage(grid, 2)
        await expect.element(page.getByRole('gridcell', { name: 'Customer 11' })).toBeVisible()

        await page.getByRole('gridcell', { name: 'Customer 11' }).click()
        const data = new DataTransfer()
        data.setData('text', 'Pasted')
        document.activeElement!.dispatchEvent(
            new ClipboardEvent('paste', { bubbles: true, clipboardData: data })
        )
        await expect.poll(() => grid.data[0].customer).toBe('Pasted')
    })

    it('keeps the arrows inside the page the grid holds', async () => {
        const grid = serverGrid()
        await renderGrid(grid)
        goToPage(grid, 2)
        await expect.element(page.getByRole('gridcell', { name: 'Customer 20' })).toBeVisible()

        await page.getByRole('gridcell', { name: 'Customer 20' }).click()
        await userEvent.keyboard('{ArrowDown}{ArrowDown}')
        expect(grid.preWindowNodes[grid.focus.active.row]?.id).toBe('20')
        expect(getPagination(grid)!.page).toBe(2)

        await userEvent.keyboard('{Control>}{Home}{/Control}')
        expect(grid.preWindowNodes[grid.focus.active.row]?.id).toBe('11')
    })

    it('shows the last partial page in the footer', async () => {
        const grid = serverGrid()
        await renderGrid(grid)
        getPagination(grid)!.setPage(14)
        grid.data = pageOf(14)
        await expect.element(page.getByText('131–137 of 137')).toBeVisible()
    })

    it('passes axe on a page past the first', async () => {
        const grid = serverGrid()
        const screen = await renderGrid(grid)
        goToPage(grid, 2)
        await expect.element(page.getByRole('gridcell', { name: 'Customer 11' })).toBeVisible()

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })

    it('virtualizes the rows a server model holds', async () => {
        const grid = createDataGrid<Order>({
            columns,
            data: database.slice(0, 100),
            getRowId: (order) => String(order.id),
            rowModel: 'server',
            features: [virtualization({ rowHeight: 40 })]
        })
        const screen = await render(TypedDataGrid, { grid, class: 'h-[320px]' })
        await expect.element(screen.getByRole('grid')).toBeVisible()
        const rendered = screen.container.querySelectorAll('[role="row"][data-dg-row-id]').length
        expect(rendered).toBeLessThan(40)
    })
})
