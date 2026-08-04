import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    getColumnOps,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Person {
    id: number
    name: string
    note: string
    score: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

const people: Person[] = [
    { id: 1, name: 'Ada', note: 'a long note that will not fit', score: 91 },
    { id: 2, name: 'Linus', note: '', score: 74 }
]

function makeGrid(columns: ColumnDef<Person>[]): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (person) => String(person.id),
        features: [columnOps()]
    })
}

function cellAt(container: Element, row: number, col: number): HTMLElement {
    const cell = container.querySelector<HTMLElement>(`[data-dg-cell="${row}:${col}"]`)
    if (!cell) throw new Error(`no cell at ${row}:${col}`)
    return cell
}

describe('ColumnDef.resizable', () => {
    it('withholds the resize handle from a frozen column only', async () => {
        const grid = makeGrid([
            { id: 'id', header: '#', width: 60, resizable: false },
            { id: 'name', header: 'Name', width: 160 }
        ])
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const handles = screen.container.querySelectorAll('[role="separator"]')
        expect([...handles].map((handle) => handle.getAttribute('aria-label'))).toEqual([
            'Resize Name column'
        ])
    })

    it('refuses a width change through the API too', async () => {
        const grid = makeGrid([
            { id: 'id', header: '#', width: 60, resizable: false },
            { id: 'name', header: 'Name', width: 160 }
        ])
        await render(TypedDataGrid, { grid })
        const ops = getColumnOps(grid)!

        expect(ops.canResizeColumn('id')).toBe(false)
        expect(ops.canResizeColumn('name')).toBe(true)

        ops.setColumnWidth('id', 300)
        ops.setColumnWidth('name', 300)
        expect(ops.currentWidth('id')).toBe(60)
        expect(ops.currentWidth('name')).toBe(300)
    })

    it('leaves a frozen column out of autosize', async () => {
        const grid = makeGrid([
            { id: 'id', header: '#', width: 60, resizable: false },
            { id: 'name', header: 'Name', width: 160 }
        ])
        await render(TypedDataGrid, { grid })

        const ops = getColumnOps(grid)!
        ops.autoSizeColumns()
        expect(ops.currentWidth('id')).toBe(60)
    })
})

describe('ColumnDef.tooltip', () => {
    it('titles every cell with its value when set to true', async () => {
        const grid = makeGrid([{ id: 'name', header: 'Name', width: 160, tooltip: true }])
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        expect(cellAt(screen.container, 0, 0).title).toBe('Ada')
        expect(cellAt(screen.container, 1, 0).title).toBe('Linus')
    })

    it('takes the text from a callback', async () => {
        const grid = makeGrid([
            {
                id: 'score',
                header: 'Score',
                width: 120,
                tooltip: ({ row, value }) => `${row.name}: ${value}/100`
            }
        ])
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        expect(cellAt(screen.container, 0, 0).title).toBe('Ada: 91/100')
    })

    it('leaves a blank cell untitled rather than showing "null"', async () => {
        const grid = makeGrid([{ id: 'note', header: 'Note', width: 120, tooltip: true }])
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        expect(cellAt(screen.container, 1, 0).title).toBe('')
    })

    it('marks a column that manages its own tooltip so hover stays out of it', async () => {
        const grid = makeGrid([
            { id: 'name', header: 'Name', width: 120, tooltip: false },
            { id: 'note', header: 'Note', width: 120 }
        ])
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        expect(cellAt(screen.container, 0, 0).hasAttribute('data-dg-manual-tooltip')).toBe(true)
        // The column that said nothing is still the hover measure's business.
        expect(cellAt(screen.container, 0, 1).hasAttribute('data-dg-manual-tooltip')).toBe(false)
    })
})

describe('ColumnDef.meta', () => {
    it('rides along untouched for a renderer or feature to read', async () => {
        const meta = { exportGroup: 'identity', width: 'auto' }
        const grid = makeGrid([{ id: 'name', header: 'Name', width: 160, meta }])
        await render(TypedDataGrid, { grid })

        expect(grid.columns.get('name')?.def.meta).toBe(meta)
    })
})
