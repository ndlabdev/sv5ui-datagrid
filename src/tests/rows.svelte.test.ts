import axe from 'axe-core'
import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    getRowPinning,
    PIPELINE_ORDER,
    rowPinning,
    sorting,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridFeature,
    type GridState,
    type RowNode
} from '$lib/index.js'

interface Order {
    id: number
    customer: string
    total: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Order>>

const columns: ColumnDef<Order>[] = [
    { id: 'customer', header: 'Customer', flex: 1, minWidth: 160 },
    { id: 'total', header: 'Total', align: 'right', width: 120 }
]

function makeOrders(count: number): Order[] {
    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        customer: `Customer ${i + 1}`,
        total: (i + 1) * 10
    }))
}

function expandableOrders(): GridFeature<Order> {
    return {
        id: 'demo-expand',
        createState: (grid) => {
            grid.expansion.enabled = true
            return {}
        },
        pipelineStage: {
            order: PIPELINE_ORDER.flatten,
            transform: (nodes, grid) =>
                nodes.flatMap((node): RowNode<Order>[] => {
                    const parent = { ...node, meta: { expandable: true, level: 0 } }
                    if (!grid.expansion.isExpanded(node.id)) return [parent]
                    return [
                        parent,
                        {
                            id: `${node.id}:detail`,
                            row: node.row,
                            index: node.index,
                            meta: { fullWidth: true, level: 1 }
                        }
                    ]
                })
        }
    }
}

function makeExpandableGrid(count = 5): GridState<Order> {
    return createDataGrid<Order>({
        columns,
        data: makeOrders(count),
        getRowId: (order) => String(order.id),
        features: [sorting(), expandableOrders()]
    })
}

async function renderGrid(grid: GridState<Order>, props: Record<string, unknown> = {}) {
    const screen = await render(TypedDataGrid, { grid, ...props })
    await expect.element(screen.getByRole('treegrid').or(screen.getByRole('grid'))).toBeVisible()
    return screen
}

describe('expandable rows', () => {
    it('renders a treegrid with aria-level and toggles a full-width detail row', async () => {
        const grid = makeExpandableGrid()
        const screen = await renderGrid(grid)

        const treegrid = screen.container.querySelector('[role="treegrid"]')
        expect(treegrid).not.toBeNull()

        const firstRow = screen.container.querySelector('[data-dg-row-id="1"]')!
        expect(firstRow.getAttribute('aria-level')).toBe('1')
        expect(firstRow.getAttribute('aria-expanded')).toBe('false')

        await page.getByRole('button', { name: 'Expand row' }).first().click()
        expect(firstRow.getAttribute('aria-expanded')).toBe('true')

        const detail = screen.container.querySelector('[data-dg-row-id="1:detail"]')!
        expect(detail.getAttribute('aria-level')).toBe('2')
        const cells = detail.querySelectorAll('[role="gridcell"]')
        expect(cells).toHaveLength(1)

        await page.getByRole('button', { name: 'Collapse row' }).first().click()
        await expect
            .element(page.getByRole('button', { name: 'Collapse row' }))
            .not.toBeInTheDocument()
        expect(screen.container.querySelector('[data-dg-row-id="1:detail"]')).toBeNull()
    })

    it('renders the fullWidthRow snippet content for detail rows', async () => {
        const grid = makeExpandableGrid()
        grid.expansion.expand('2')
        const screen = await render(TypedDataGrid, {
            grid,
            emptyText: undefined
        })
        await expect.element(screen.getByRole('treegrid')).toBeVisible()

        const detail = screen.container.querySelector('[data-dg-row-id="2:detail"]')!
        expect(detail.textContent).toContain('Customer 2')
    })

    it('expands and collapses with ArrowRight/ArrowLeft/Enter from the first column', async () => {
        const grid = makeExpandableGrid()
        await renderGrid(grid)

        await page.getByRole('gridcell', { name: 'Customer 2' }).click()
        await userEvent.keyboard('{ArrowRight}')
        expect(grid.expansion.isExpanded('2')).toBe(true)

        await userEvent.keyboard('{ArrowLeft}')
        expect(grid.expansion.isExpanded('2')).toBe(false)

        await userEvent.keyboard('{Enter}')
        expect(grid.expansion.isExpanded('2')).toBe(true)
        await userEvent.keyboard('{Enter}')
        expect(grid.expansion.isExpanded('2')).toBe(false)
    })

    it('composes with virtualization and variable detail heights', async () => {
        const grid = createDataGrid<Order>({
            columns,
            data: makeOrders(1000),
            getRowId: (order) => String(order.id),
            features: [
                sorting(),
                expandableOrders(),
                virtualization({
                    getRowHeight: (node) => (node.meta?.fullWidth ? 120 : 40),
                    initialRows: 12
                })
            ]
        })
        grid.expansion.expand('3')
        const screen = await renderGrid(grid, { class: 'h-90' })

        const detail = screen.container.querySelector<HTMLElement>('[data-dg-row-id="3:detail"]')!
        expect(detail.style.height).toBe('120px')

        const marked = screen.container.querySelector('[data-dg-row-id="1"]') as HTMLElement & {
            __marker?: boolean
        }
        marked.__marker = true

        const viewport = screen.container.querySelector<HTMLElement>('[role="treegrid"]')!
        viewport.scrollTop = 200
        viewport.dispatchEvent(new Event('scroll'))
        await new Promise((resolve) => requestAnimationFrame(resolve))
        await new Promise((resolve) => requestAnimationFrame(resolve))

        expect(grid.totalRows).toBe(1001)
        const still = screen.container.querySelector('[data-dg-row-id="1"]') as
            (HTMLElement & { __marker?: boolean }) | null
        if (still) expect(still.__marker).toBe(true)
    })

    it('passes axe in treegrid mode with an expanded detail row', async () => {
        const grid = makeExpandableGrid()
        grid.expansion.expand('1')
        const screen = await renderGrid(grid)

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })
})

describe('row pinning', () => {
    function makePinnedGrid(): GridState<Order> {
        return createDataGrid<Order>({
            columns,
            data: makeOrders(50),
            getRowId: (order) => String(order.id),
            features: [
                sorting(),
                rowPinning({
                    isRowPinned: (order) =>
                        order.id === 1 ? 'top' : order.id === 50 ? 'bottom' : null
                }),
                virtualization({ rowHeight: 40, initialRows: 8 })
            ]
        })
    }

    it('renders sticky pinned rows outside the scrolling flow', async () => {
        const grid = makePinnedGrid()
        const screen = await renderGrid(grid, { class: 'h-90' })

        const top = screen.container.querySelector('[data-dg-row-id="1"]')!
        const bottom = screen.container.querySelector('[data-dg-row-id="50"]')!
        expect(top.closest('[role="rowgroup"]')).not.toBe(bottom.closest('[role="rowgroup"]'))
        expect(grid.totalRows).toBe(48)

        const viewport = screen.container.querySelector<HTMLElement>('[role="grid"]')!
        const before = top.getBoundingClientRect().top
        viewport.scrollTop = 400
        viewport.dispatchEvent(new Event('scroll'))
        await new Promise((resolve) => requestAnimationFrame(resolve))
        await new Promise((resolve) => requestAnimationFrame(resolve))
        expect(Math.abs(top.getBoundingClientRect().top - before)).toBeLessThanOrEqual(2)
    })

    /** Which edge of the row its hairline is drawn on, read off the ::after box. */
    function hairlineEdge(row: Element): 'top' | 'bottom' | 'none' {
        const style = getComputedStyle(row, '::after')
        if (style.display === 'none' || style.content === 'none') return 'none'
        if (style.top === '0px') return 'top'
        return style.bottom === '0px' ? 'bottom' : 'none'
    }

    it('draws each pinned section its line on the edge facing the body', async () => {
        const grid = createDataGrid<Order>({
            columns,
            data: makeOrders(8),
            getRowId: (order) => String(order.id),
            features: [
                rowPinning({
                    isRowPinned: (order) =>
                        order.id === 1 ? 'top' : order.id >= 7 ? 'bottom' : null
                })
            ]
        })
        const screen = await renderGrid(grid)

        const rowAt = (id: string) => screen.container.querySelector(`[data-dg-row-id="${id}"]`)!

        // The top section meets the body at its foot, the bottom section at its
        // head. Drawing both at the foot left the boundary above a bottom-pinned
        // row unmarked, and put a rule under the last one against the grid's own
        // bottom edge.
        expect(hairlineEdge(rowAt('1'))).toBe('bottom')
        expect(hairlineEdge(rowAt('7'))).toBe('top')
        expect(hairlineEdge(rowAt('8'))).toBe('top')

        const viewport = screen.container.querySelector<HTMLElement>('[role="grid"]')!
        const last = rowAt('8').getBoundingClientRect()
        expect(Math.abs(last.bottom - viewport.getBoundingClientRect().bottom)).toBeLessThan(4)
    })

    it('pins and unpins through the context menu', async () => {
        const grid = makePinnedGrid()
        const screen = await renderGrid(grid, { class: 'h-90' })
        const state = getRowPinning(grid)!

        const cell = screen.container.querySelector<HTMLElement>(
            '[data-dg-row-id="3"] [role="gridcell"]'
        )!
        cell.dispatchEvent(
            new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 160 })
        )
        await page.getByRole('menuitem', { name: 'Pin row top' }).click()
        expect(state.topNodes.map((node) => node.id)).toEqual(['1', '3'])

        const pinnedCell = screen.container.querySelector<HTMLElement>(
            '[data-dg-row-id="3"] [role="gridcell"]'
        )!
        pinnedCell.dispatchEvent(
            new MouseEvent('contextmenu', { bubbles: true, clientX: 120, clientY: 120 })
        )
        await page.getByRole('menuitem', { name: 'Unpin row' }).click()
        expect(state.topNodes.map((node) => node.id)).toEqual(['1'])
    })
})
