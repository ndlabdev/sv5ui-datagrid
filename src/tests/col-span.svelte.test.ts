import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { userEvent } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Row {
    id: number
    name: string
    a: string
    b: string
    c: string
    d: string
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Row>>

const rows: Row[] = [
    { id: 1, name: 'wide', a: 'A1', b: 'B1', c: 'C1', d: 'D1' },
    { id: 2, name: 'plain', a: 'A2', b: 'B2', c: 'C2', d: 'D2' }
]

// Row 1 spans column `a` (index 1) across three columns — covering 1, 2, 3 —
// leaving column `d` (index 4) as the first cell after the span. Row 2 is normal.
const columns: ColumnDef<Row>[] = [
    { id: 'name', header: 'Name' },
    { id: 'a', header: 'A', colSpan: (ctx) => (ctx.row.name === 'wide' ? 3 : 1) },
    { id: 'b', header: 'B' },
    { id: 'c', header: 'C' },
    { id: 'd', header: 'D' }
]

function grid(): GridState<Row> {
    return createDataGrid<Row>({ columns, data: rows, getRowId: (r) => String(r.id) })
}

async function renderGrid(g: GridState<Row>) {
    const screen = await render(TypedDataGrid, { grid: g })
    await expect.element(screen.getByRole('grid')).toBeVisible()
    return screen
}

function cell(container: Element, row: number, col: number): HTMLElement | null {
    return container.querySelector<HTMLElement>(`[data-dg-cell="${row}:${col}"]`)
}

function activeCell(): string | null {
    return document.activeElement?.getAttribute('data-dg-cell') ?? null
}

describe('column spanning', () => {
    it('renders a spanning cell and skips the columns it covers', async () => {
        const screen = await renderGrid(grid())

        const spanned = cell(screen.container, 0, 1)!
        expect(spanned.getAttribute('aria-colspan')).toBe('3')
        expect(cell(screen.container, 0, 2)).toBeNull()
        expect(cell(screen.container, 0, 3)).toBeNull()
        // The cell after the span still renders.
        expect(cell(screen.container, 0, 4)).not.toBeNull()
    })

    it('leaves other rows unspanned', async () => {
        const screen = await renderGrid(grid())
        expect(cell(screen.container, 1, 1)!.getAttribute('aria-colspan')).toBeNull()
        expect(cell(screen.container, 1, 2)).not.toBeNull()
        expect(cell(screen.container, 1, 3)).not.toBeNull()
    })

    it('steps keyboard focus over the covered columns', async () => {
        const g = grid()
        const screen = await renderGrid(g)

        cell(screen.container, 0, 1)!.focus()
        expect(g.focus.active).toMatchObject({ row: 0, col: 1 })

        await userEvent.keyboard('{ArrowRight}')
        // `d` (index 4) is the first cell after the 3-wide span.
        expect(activeCell()).toBe('0:4')

        await userEvent.keyboard('{ArrowLeft}')
        // Back onto the span, which owns column 1.
        expect(activeCell()).toBe('0:1')
    })

    it('snaps a vertical move into a covered column onto the spanning cell', async () => {
        const g = grid()
        const screen = await renderGrid(g)

        // Row 1 column 2 is a normal cell; moving up lands in row 0 where column
        // 2 is covered by the span, so focus snaps onto the spanning cell.
        cell(screen.container, 1, 2)!.focus()
        expect(g.focus.active).toMatchObject({ row: 1, col: 2 })

        await userEvent.keyboard('{ArrowUp}')
        expect(activeCell()).toBe('0:1')
    })
})
