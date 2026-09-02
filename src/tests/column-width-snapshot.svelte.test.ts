import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import {
    createDataGrid,
    DataGrid,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Row {
    id: number
    a: string
    b: string
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Row>>

const rows: Row[] = [{ id: 1, a: 'x', b: 'y' }]
const columns: ColumnDef<Row>[] = [
    { id: 'a', header: 'A', width: 200 },
    { id: 'b', header: 'B', width: 200 }
]

function makeGrid(): GridState<Row> {
    return createDataGrid<Row>({ columns, data: rows, getRowId: (row) => String(row.id) })
}

async function mount(grid: GridState<Row>) {
    const screen = await render(TypedDataGrid, { grid })
    await expect.element(screen.getByRole('grid')).toBeVisible()
    return screen
}

function cellAt(container: Element, row: number, col: number): HTMLElement {
    const cell = container.querySelector<HTMLElement>(`[data-dg-cell="${row}:${col}"]`)
    if (!cell) throw new Error(`no cell at ${row}:${col}`)
    return cell
}

/**
 * Asserted on the computed style rather than on `widthOverrides`, because the
 * override record looked perfectly reasonable while the layout was already
 * gone: a width of `NaN` reached the custom property as `NaNpx`, which makes
 * `grid-template-columns` invalid at computed-value time. The browser drops
 * the whole declaration, every column folds into one track, and the cells
 * stack down the page. Nothing throws on the way.
 */
function tracksOf(container: Element, row: number): string[] {
    const line = cellAt(container, row, 0).parentElement
    if (!line) throw new Error('no row element')
    return getComputedStyle(line).gridTemplateColumns.split(' ')
}

describe('a column width the layout cannot draw', () => {
    it('keeps the track list when a snapshot carries NaN', async () => {
        const grid = makeGrid()
        const screen = await mount(grid)
        expect(tracksOf(screen.container, 0)).toHaveLength(2)

        grid.setState({ version: 1, columns: { widths: { a: Number.NaN } } } as never)
        await expect.poll(() => tracksOf(screen.container, 0).length).toBe(2)

        const [cellA, cellB] = [cellAt(screen.container, 0, 0), cellAt(screen.container, 0, 1)]
        expect(cellA.getBoundingClientRect().top).toBe(cellB.getBoundingClientRect().top)
        expect(cellA.getBoundingClientRect().right).toBeLessThanOrEqual(
            Math.ceil(cellB.getBoundingClientRect().left)
        )
    })

    it('keeps the track list when the width setter is handed NaN', async () => {
        const grid = makeGrid()
        const screen = await mount(grid)

        grid.columns.setWidth('a', Number.NaN)
        await expect.poll(() => tracksOf(screen.container, 0).length).toBe(2)
        expect(grid.columns.style).not.toContain('NaN')
    })

    it('still applies a width it can draw', async () => {
        const grid = makeGrid()
        const screen = await mount(grid)

        grid.setState({ version: 1, columns: { widths: { a: 320 } } } as never)
        await expect.poll(() => tracksOf(screen.container, 0)[0]).toBe('320px')
    })
})
