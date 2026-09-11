import {
    createDataGrid,
    DataGrid,
    masterDetail,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'
import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'

interface Order {
    id: number
    sku: string
    customer: string
    placed: string
    status: string
    total: number
}

const columns: ColumnDef<Order>[] = [
    { id: 'sku' },
    { id: 'customer' },
    { id: 'placed' },
    { id: 'status' },
    { id: 'total' }
]

const orders: Order[] = [
    { id: 1, sku: 'SO-2101', customer: 'Anh', placed: '2026-03-01', status: 'open', total: 544 }
]

const TypedGrid = DataGrid as unknown as Component<DataGridProps<Order>>

function spanning(container: Element) {
    const grid = container.querySelector('[role="grid"],[role="treegrid"]')!
    const cells = [...container.querySelectorAll('[role="gridcell"]')].filter((cell) =>
        (cell.getAttribute('style') ?? '').includes('1 / -1')
    )
    return {
        colcount: grid.getAttribute('aria-colcount'),
        cells: cells.map((cell) => ({
            colindex: cell.getAttribute('aria-colindex'),
            colspan: cell.getAttribute('aria-colspan')
        }))
    }
}

async function drawn(grid: GridState<Order>, role: 'grid' | 'treegrid') {
    const screen = await render(TypedGrid, { grid } as never)
    await expect.element(page.getByRole(role)).toBeVisible()
    return screen
}

describe('a cell that covers the whole row says so', () => {
    it('on a detail panel, matching the count the grid declares', async () => {
        const grid = createDataGrid<Order>({
            columns,
            data: orders,
            getRowId: (order) => String(order.id),
            features: [masterDetail({})]
        })
        const screen = await drawn(grid, 'treegrid')

        grid.expansion.expand('1')
        await expect.poll(() => spanning(screen.container).cells.length).toBe(1)
        expect(spanning(screen.container)).toEqual({
            colcount: '5',
            cells: [{ colindex: '1', colspan: '5' }]
        })
    })

    it('follows a column being hidden, the way aria-colcount does', async () => {
        const grid = createDataGrid<Order>({
            columns,
            data: orders,
            getRowId: (order) => String(order.id),
            features: [masterDetail({})]
        })
        const screen = await drawn(grid, 'treegrid')
        grid.expansion.expand('1')
        await expect.poll(() => spanning(screen.container).cells.length).toBe(1)

        grid.columns.defs = grid.columns.defs.map((def) =>
            def.id === 'total' ? { ...def, hidden: true } : def
        )
        await expect.poll(() => spanning(screen.container).colcount).toBe('4')
        expect(spanning(screen.container).cells).toEqual([{ colindex: '1', colspan: '4' }])
    })

    it('on the row that says there is no data', async () => {
        const grid = createDataGrid<Order>({
            columns,
            data: [],
            getRowId: (order) => String(order.id)
        })
        const screen = await drawn(grid, 'grid')

        expect(spanning(screen.container)).toEqual({
            colcount: '5',
            cells: [{ colindex: '1', colspan: '5' }]
        })
    })

    it('on the row that reports a failed fetch', async () => {
        const grid = createDataGrid<Order>({
            columns,
            data: [],
            getRowId: (order) => String(order.id)
        })
        grid.status = { error: new Error('nope') }
        const screen = await drawn(grid, 'grid')

        expect(spanning(screen.container)).toEqual({
            colcount: '5',
            cells: [{ colindex: '1', colspan: '5' }]
        })
    })
})
