import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import {
    createDataGrid,
    DataGrid,
    filtering,
    getVirtualization,
    sorting,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'
import VirtualGrid from './VirtualGrid.svelte'

interface Row {
    id: number
    name: string
    value: number
}

const columns: ColumnDef<Row>[] = [
    { id: 'name', header: 'Name', sortable: true, flex: 1, minWidth: 160 },
    { id: 'value', header: 'Value', sortable: true, align: 'right', width: 100 }
]

function makeRows(count: number): Row[] {
    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `Row ${i + 1}`,
        value: i
    }))
}

function createVirtualGrid(count: number): GridState<Row> {
    return createDataGrid<Row>({
        data: makeRows(count),
        columns,
        getRowId: (row) => String(row.id),
        features: [filtering(), sorting(), virtualization({ rowHeight: 40, overscan: 5 })]
    })
}

function renderedRows(container: Element): Element[] {
    return [...container.querySelectorAll('[role="rowgroup"]:last-child [role="row"]')]
}

describe('virtualization', () => {
    it('renders only the visible window of a 10k-row grid', async () => {
        const grid = createVirtualGrid(10_000)
        const screen = await render(VirtualGrid, { grid })

        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '10001')
        await expect
            .element(screen.getByRole('gridcell', { name: 'Row 1', exact: true }))
            .toBeVisible()

        const count = renderedRows(screen.container).length
        expect(count).toBeGreaterThanOrEqual(10)
        expect(count).toBeLessThan(35)
    })

    it('renders new rows when the viewport scrolls', async () => {
        const grid = createVirtualGrid(10_000)
        const screen = await render(VirtualGrid, { grid })
        const viewport = screen.getByRole('grid').element() as HTMLElement

        viewport.scrollTop = 4000
        await expect
            .element(screen.getByRole('gridcell', { name: 'Row 100', exact: true }))
            .toBeVisible()
        expect(screen.container.querySelectorAll('[role="gridcell"]').length).toBeLessThan(100)

        const row100 = screen.container
            .querySelector('[role="gridcell"][aria-colindex="1"]')
            ?.closest('[role="row"]')
        expect(renderedRows(screen.container)[0]?.getAttribute('aria-rowindex')).toBe(
            String(getVirtualization(grid)!.virtualizer.range.start + 2)
        )
        expect(row100).toBeDefined()
    })

    it('scrollToRow jumps anywhere in the list', async () => {
        const grid = createVirtualGrid(10_000)
        const screen = await render(VirtualGrid, { grid })

        getVirtualization(grid)!.scrollToRow(9_999)
        await expect
            .element(screen.getByRole('gridcell', { name: 'Row 10000', exact: true }))
            .toBeVisible()

        getVirtualization(grid)!.scrollToRow(0)
        await expect
            .element(screen.getByRole('gridcell', { name: 'Row 1', exact: true }))
            .toBeVisible()
    })

    it('sorts and filters the full dataset while virtualized', async () => {
        const grid = createVirtualGrid(1_000)
        const screen = await render(VirtualGrid, { grid })

        await screen.getByRole('button', { name: 'Value', exact: true }).click()
        await screen.getByRole('button', { name: 'Value', exact: true }).click()
        await expect
            .element(screen.getByRole('columnheader', { name: 'Value' }))
            .toHaveAttribute('aria-sort', 'descending')
        await expect
            .element(screen.getByRole('gridcell', { name: 'Row 1000', exact: true }))
            .toBeVisible()

        expect(grid.totalRows).toBe(1_000)
    })

    it('ensureVisible reveals the full row below the sticky header', async () => {
        const grid = createVirtualGrid(1_000)
        const screen = await render(VirtualGrid, { grid })
        await expect
            .element(screen.getByRole('gridcell', { name: 'Row 1', exact: true }))
            .toBeVisible()

        const virt = getVirtualization(grid)!
        await expect.poll(() => virt.virtualizer.viewportHeight).toBeGreaterThan(0)
        virt.ensureVisible(50)
        await expect
            .element(screen.getByRole('gridcell', { name: 'Row 51', exact: true }))
            .toBeVisible()

        const element = screen.getByRole('grid').element() as HTMLElement
        const headerOffset = element.scrollHeight - virt.virtualizer.totalHeight
        expect(element.scrollTop).toBe(51 * 40 + headerOffset - virt.virtualizer.viewportHeight)
    })

    it('keeps the header sticky inside the scroll container', async () => {
        const grid = createVirtualGrid(10_000)
        const screen = await render(VirtualGrid, { grid })

        const header = screen.container.querySelector('[role="rowgroup"]')
        expect(header?.className).toContain('sticky')
    })

    it('supports the DataGrid virtual prop (tier 1)', async () => {
        const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Row>>
        const screen = await render(TypedDataGrid, {
            data: makeRows(5_000),
            columns,
            getRowId: (row: Row) => String(row.id),
            virtual: { rowHeight: 40 },
            class: 'h-[400px]'
        })

        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '5001')
        const count = screen.container.querySelectorAll(
            '[role="rowgroup"]:last-child [role="row"]'
        ).length
        expect(count).toBeLessThan(35)
    })
})
