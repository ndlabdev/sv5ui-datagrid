import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import {
    createDataGrid,
    getVirtualization,
    sorting,
    virtualization,
    type ColumnDef,
    type GridState
} from '$lib/index.js'
import VirtualGrid from './VirtualGrid.svelte'

interface Row {
    id: number
    name: string
    value: number
}

const COLS = 20

function makeColumns(): ColumnDef<Row>[] {
    return Array.from({ length: COLS }, (_, i) => ({
        id: `c${i}`,
        header: `C${i}`,
        width: 120,
        sortable: i === 0,
        accessor: (row: Row) => `${i}:${row.id}`
    }))
}

function makeGrid(rowCount: number): GridState<Row> {
    return createDataGrid<Row>({
        data: Array.from({ length: rowCount }, (_, i) => ({
            id: i + 1,
            name: `Row ${i + 1}`,
            value: i
        })),
        columns: makeColumns(),
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            virtualization({ rowHeight: 40, overscan: 5, columns: { overscanPx: 120 } })
        ]
    }) as unknown as GridState<Row>
}

function headerIndices(container: Element): number[] {
    return [...container.querySelectorAll('[role="columnheader"]')].map((cell) =>
        Number(cell.getAttribute('aria-colindex'))
    )
}

function firstBodyRowIndices(container: Element): number[] {
    const row = container.querySelector('[role="rowgroup"]:last-child [role="row"]')
    return [...(row?.querySelectorAll('[role="gridcell"]') ?? [])].map((cell) =>
        Number(cell.getAttribute('aria-colindex'))
    )
}

describe('column virtualization', () => {
    it('renders only the columns intersecting the horizontal viewport', async () => {
        const grid = makeGrid(1_000)
        const screen = await render(VirtualGrid, { grid, viewportClass: 'h-100 w-150' })

        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-colcount', '20')
        await expect
            .poll(() => screen.container.querySelectorAll('[role="columnheader"]').length)
            .toBeLessThan(COLS)

        const rendered = headerIndices(screen.container)
        expect(rendered[0]).toBe(1)
        expect(rendered.length).toBeGreaterThanOrEqual(5)
    })

    it('keeps header and body windows aligned while scrolling horizontally', async () => {
        const grid = makeGrid(1_000)
        const screen = await render(VirtualGrid, { grid, viewportClass: 'h-100 w-150' })
        const viewport = screen.getByRole('grid').element() as HTMLElement

        await expect
            .poll(() => screen.container.querySelectorAll('[role="columnheader"]').length)
            .toBeLessThan(COLS)

        viewport.scrollLeft = 1200
        await expect.poll(() => headerIndices(screen.container)[0]).toBeGreaterThan(1)

        const header = headerIndices(screen.container)
        const body = firstBodyRowIndices(screen.container)
        expect(body).toEqual(header)
        expect(header.at(-1)).toBeLessThanOrEqual(COLS)
    })

    it('windows the same columns under dir="rtl", where scrollLeft goes negative', async () => {
        const ltr = makeGrid(1_000)
        const ltrScreen = await render(VirtualGrid, { grid: ltr, viewportClass: 'h-100 w-150' })
        const ltrViewport = ltrScreen.container.querySelector<HTMLElement>('[role="grid"]')!
        ltrViewport.scrollLeft = 1200
        await expect.poll(() => headerIndices(ltrScreen.container)[0]).toBeGreaterThan(1)
        const expected = headerIndices(ltrScreen.container)

        const rtl = makeGrid(1_000)
        const rtlScreen = await render(VirtualGrid, { grid: rtl, viewportClass: 'h-100 w-150' })
        const rtlViewport = rtlScreen.container.querySelector<HTMLElement>('[role="grid"]')!
        rtlViewport.dir = 'rtl'

        // RTL reports zero at the right edge and counts down from there.
        rtlViewport.scrollLeft = -1200
        await expect.poll(() => headerIndices(rtlScreen.container)).toEqual(expected)
        expect(firstBodyRowIndices(rtlScreen.container)).toEqual(expected)
    })

    it('keyboard navigation scrolls unrendered columns into view', async () => {
        const grid = makeGrid(50)
        const screen = await render(VirtualGrid, { grid, viewportClass: 'h-100 w-150' })

        await expect
            .poll(() => screen.container.querySelectorAll('[role="columnheader"]').length)
            .toBeLessThan(COLS)

        grid.focus.focusCell({ row: 0, col: COLS - 1 })
        screen.container.querySelector<HTMLElement>('[data-dg-cell]')?.focus()
        grid.focus.focusCell({ row: 0, col: COLS - 1 })

        await expect
            .poll(() => document.activeElement?.getAttribute('data-dg-cell'))
            .toBe(`0:${COLS - 1}`)
        expect(getVirtualization(grid)!.columnVirtualizer!.scrollLeft).toBeGreaterThan(0)
    })
})

describe('variable row heights', () => {
    function makeVariableGrid(): GridState<Row> {
        return createDataGrid<Row>({
            data: Array.from({ length: 2_000 }, (_, i) => ({
                id: i + 1,
                name: `Row ${i + 1}`,
                value: i
            })),
            columns: [
                { id: 'name', header: 'Name', flex: 1, minWidth: 140 },
                { id: 'value', header: 'Value', align: 'right', width: 100 }
            ],
            getRowId: (row) => String(row.id),
            features: [
                virtualization({
                    getRowHeight: (node) => 40 + (node.row.id % 3) * 24,
                    overscan: 4
                })
            ]
        }) as unknown as GridState<Row>
    }

    it('renders rows at their own heights and windows correctly', async () => {
        const grid = makeVariableGrid()
        const screen = await render(VirtualGrid, { grid })

        await expect
            .element(screen.getByRole('gridcell', { name: 'Row 1', exact: true }))
            .toBeVisible()

        const rows = [
            ...screen.container.querySelectorAll('[role="rowgroup"]:last-child [role="row"]')
        ]
        const heights = new Set(rows.slice(0, 3).map((row) => row.getBoundingClientRect().height))
        expect(heights.size).toBeGreaterThan(1)

        const count = rows.length
        expect(count).toBeLessThan(30)
    })

    it('scrollToRow lands on the exact Fenwick offset', async () => {
        const grid = makeVariableGrid()
        const screen = await render(VirtualGrid, { grid })
        await expect
            .element(screen.getByRole('gridcell', { name: 'Row 1', exact: true }))
            .toBeVisible()

        const virt = getVirtualization(grid)!
        virt.scrollToRow(1_000)
        await expect
            .element(screen.getByRole('gridcell', { name: 'Row 1001', exact: true }))
            .toBeVisible()

        const viewport = screen.getByRole('grid').element() as HTMLElement
        expect(viewport.scrollTop).toBe(virt.virtualizer.indexToOffset(1_000))
    })
})
