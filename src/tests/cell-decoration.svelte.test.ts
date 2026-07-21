import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import {
    createDataGrid,
    DataGrid,
    pagination,
    sorting,
    type ColumnDef,
    type DataGridProps,
    type GridFeature,
    type GridState
} from '$lib/index.js'

interface Cell {
    id: number
    a: string
    b: string
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Cell>>

const columns: ColumnDef<Cell>[] = [
    { id: 'a', header: 'A', width: 140 },
    { id: 'b', header: 'B', width: 140 }
]

const data: Cell[] = [
    { id: 1, a: 'a1', b: 'b1' },
    { id: 2, a: 'a2', b: 'b2' },
    { id: 3, a: 'a3', b: 'b3' }
]

function makeGrid(features: GridFeature<Cell>[] = []): GridState<Cell> {
    return createDataGrid<Cell>({
        columns,
        data,
        getRowId: (row) => String(row.id),
        features: [sorting(), ...features, pagination({})]
    })
}

/** Decorates the 2x2 block at rows 0-1, columns 0-1. */
function blockDecorator(className: string): GridFeature<Cell> {
    return {
        id: 'demo-decorator',
        cellDecoration: ({ rowIndex, colIndex }) =>
            rowIndex <= 1 && colIndex <= 1 ? { class: className, selected: true } : undefined
    }
}

function cellAt(container: Element, row: number, col: number): HTMLElement {
    return container.querySelector<HTMLElement>(`[data-dg-cell="${row}:${col}"]`)!
}

async function renderGrid(grid: GridState<Cell>) {
    const screen = await render(TypedDataGrid, { grid })
    await expect.element(screen.getByRole('grid')).toBeVisible()
    return screen
}

describe('cellDecoration extension point', () => {
    it('merges the class onto decorated cells only', async () => {
        const screen = await renderGrid(makeGrid([blockDecorator('x-decorated')]))

        expect(cellAt(screen.container, 0, 0).className).toContain('x-decorated')
        expect(cellAt(screen.container, 1, 1).className).toContain('x-decorated')
        expect(cellAt(screen.container, 2, 0).className).not.toContain('x-decorated')
        // the cell keeps its own classes
        expect(cellAt(screen.container, 0, 0).className).toContain('items-center')
    })

    it('sets aria-selected from the decoration', async () => {
        const screen = await renderGrid(makeGrid([blockDecorator('x-decorated')]))

        expect(cellAt(screen.container, 0, 0).getAttribute('aria-selected')).toBe('true')
        expect(cellAt(screen.container, 2, 0).getAttribute('aria-selected')).toBeNull()
    })

    it('combines decorations from several features', async () => {
        const second: GridFeature<Cell> = {
            id: 'second-decorator',
            cellDecoration: ({ colIndex }) => (colIndex === 0 ? { class: 'x-bold' } : undefined)
        }
        const screen = await renderGrid(makeGrid([blockDecorator('x-decorated'), second]))

        const both = cellAt(screen.container, 0, 0).className
        expect(both).toContain('x-decorated')
        expect(both).toContain('x-bold')
        expect(cellAt(screen.container, 0, 1).className).not.toContain('x-bold')
    })

    it('leaves cells untouched when no feature decorates', async () => {
        const screen = await renderGrid(makeGrid())

        const cell = cellAt(screen.container, 0, 0)
        expect(cell.getAttribute('aria-selected')).toBeNull()
        expect(cell.className).not.toContain('x-decorated')
    })

    it('follows the row as the data is re-sorted', async () => {
        const grid = makeGrid([
            {
                id: 'demo-decorator',
                cellDecoration: ({ node }) =>
                    node.id === '3' ? { class: 'x-decorated' } : undefined
            }
        ])
        const screen = await renderGrid(grid)
        expect(cellAt(screen.container, 2, 0).className).toContain('x-decorated')

        const setSort = grid.api.setSort as (
            sort: { columnId: string; direction: 'desc' }[]
        ) => void
        setSort([{ columnId: 'a', direction: 'desc' }])

        await expect.poll(() => cellAt(screen.container, 0, 0).className).toContain('x-decorated')
    })
})
