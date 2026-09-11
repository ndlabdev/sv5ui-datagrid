import {
    createDataGrid,
    editing,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'
import type { Component } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import DataGrid from '../lib/components/grid/DataGrid.svelte'
import { formula } from '../lib/features/formula/formula.svelte.js'
import { tree } from '../lib/features/tree/tree.svelte.js'

interface Line {
    id: number
    unit: number
    qty: number
    total?: number
}

const columns: ColumnDef<Line>[] = [
    { id: 'unit', header: 'Unit', width: 120, editable: true },
    { id: 'qty', header: 'Qty', width: 120, editable: true },
    { id: 'total', header: 'Total', width: 140, editable: true }
]

const TypedGrid = DataGrid as unknown as Component<DataGridProps<Line>>

function makeGrid(): GridState<Line> {
    return createDataGrid<Line>({
        columns,
        data: [{ id: 1, unit: 5, qty: 4 }],
        getRowId: (row) => String(row.id),
        features: [editing(), formula<Line>({ columns: { total: 'unit * qty' } })]
    })
}

const cellOf = (container: Element, index: number): Element =>
    container.querySelectorAll('[data-dg-row-id="1"] [role="gridcell"]')[index]!

async function renderGrid(grid: GridState<Line>) {
    const screen = await render(TypedGrid, { grid })
    await expect.element(screen.getByRole('grid')).toBeVisible()
    return screen
}

describe('a formula column the app declared editable', () => {
    it('opens no editor when the cell is double-clicked', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        const cell = cellOf(screen.container, 2)
        expect(cell.textContent?.trim()).toBe('20')
        cell.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))

        await vi.waitFor(() => expect(grid.preWindowNodes[0]?.row.total).toBe(20))
        expect(screen.container.querySelectorAll('[role="gridcell"] input')).toHaveLength(0)
    })

    it('still opens one on the plain column beside it', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        cellOf(screen.container, 1).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))

        await vi.waitFor(() =>
            expect(
                screen.container.querySelectorAll('[role="gridcell"] input').length
            ).toBeGreaterThan(0)
        )
    })
})

describe('a formula on a tree built from getChildren', () => {
    interface Task {
        id: number
        name: string
        rate: number
        hours: number
        cost?: number
        children?: Task[]
    }

    const TypedTree = DataGrid as unknown as Component<DataGridProps<Task>>

    it('draws a computed value on a child three levels down', async () => {
        const grid = createDataGrid<Task>({
            columns: [
                { id: 'name', header: 'Name', flex: 1, minWidth: 160 },
                { id: 'rate', header: 'Rate', width: 100 },
                { id: 'hours', header: 'Hours', width: 100 },
                { id: 'cost', header: 'Cost', width: 140 }
            ],
            data: [
                {
                    id: 1,
                    name: 'design',
                    rate: 100,
                    hours: 12,
                    children: [
                        {
                            id: 2,
                            name: 'sketch',
                            rate: 50,
                            hours: 8,
                            children: [{ id: 3, name: 'revise', rate: 20, hours: 6 }]
                        }
                    ]
                }
            ],
            getRowId: (row) => String(row.id),
            features: [
                formula<Task>({ columns: { cost: 'rate * hours' } }),
                tree<Task>({ getChildren: (row) => row.children, defaultExpandedDepth: 3 })
            ]
        })

        const screen = await render(TypedTree, { grid })
        await expect.element(screen.getByRole('treegrid')).toBeVisible()

        const costOf = (rowId: string) =>
            screen.container
                .querySelector(`[data-dg-row-id="${rowId}"] [role="gridcell"]:last-child`)
                ?.textContent?.trim()

        await vi.waitFor(() => expect(costOf('3')).toBe('120'))
        expect(costOf('1')).toBe('1200')
        expect(costOf('2')).toBe('400')
    })
})
