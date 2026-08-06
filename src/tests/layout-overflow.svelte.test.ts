import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    editing,
    filtering,
    getColumnOps,
    sorting,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Row {
    id: number
    dept: string
    bonus: number
    note: string
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Row>>

const rows: Row[] = [
    { id: 1, dept: 'Platform Engineering', bonus: 4750, note: 'ok' },
    { id: 2, dept: 'Data', bonus: 500, note: 'ok' }
]

function makeGrid(columns: ColumnDef<Row>[], extra: 'edit' | 'plain' = 'plain'): GridState<Row> {
    return createDataGrid<Row>({
        columns,
        data: rows,
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            filtering(),
            columnOps(),
            ...(extra === 'edit' ? [editing<Row>()] : [])
        ]
    })
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

describe('cells stay inside their column', () => {
    it('clips a badge too wide for its column instead of painting over the next one', async () => {
        const screen = await mount(
            makeGrid([
                { id: 'dept', header: 'Dept', width: 90, type: 'badge' },
                { id: 'bonus', header: 'Bonus', width: 110, align: 'right' }
            ])
        )

        const badgeCell = cellAt(screen.container, 0, 0)
        // The content really is wider than the column...
        expect(badgeCell.scrollWidth).toBeGreaterThan(badgeCell.clientWidth)
        // ...so the cell has to keep it in. Overflowing it lands on the
        // neighbour, which is what the badge used to do.
        expect(getComputedStyle(badgeCell).overflow).toBe('hidden')

        const neighbour = cellAt(screen.container, 0, 1)
        expect(badgeCell.getBoundingClientRect().right).toBeLessThanOrEqual(
            Math.ceil(neighbour.getBoundingClientRect().left)
        )
    })

    it('stops clipping while a cell is being edited, so the error can show', async () => {
        const grid = makeGrid(
            [
                { id: 'note', header: 'Note', width: 120, editable: true },
                { id: 'bonus', header: 'Bonus', width: 110 }
            ],
            'edit'
        )
        const screen = await mount(grid)

        const cell = cellAt(screen.container, 0, 0)
        expect(getComputedStyle(cell).overflow).toBe('hidden')

        ;(grid.api.startEditing as (rowId: string, columnId: string) => void)('1', 'note')
        await expect
            .poll(() => getComputedStyle(cellAt(screen.container, 0, 0)).overflow)
            .toBe('visible')
    })
})

describe('autosize fits the whole header', () => {
    it('leaves room for the sort, filter and menu controls', async () => {
        const grid = makeGrid([
            { id: 'dept', header: 'Department', width: 300, sortable: true, filter: 'text' },
            { id: 'bonus', header: 'Bonus', width: 110 }
        ])
        const screen = await mount(grid)
        const ops = getColumnOps(grid)!

        ops.autoSizeColumn('dept')
        await expect.poll(() => ops.currentWidth('dept')).toBeLessThan(300)

        // The label keeps a real width rather than collapsing behind the icons.
        const label = cellAt(screen.container, -1, 0).querySelector<HTMLElement>(
            '[data-dg-truncate]'
        )!
        expect(label.clientWidth).toBeGreaterThan(0)
        expect(label.scrollWidth).toBeLessThanOrEqual(label.clientWidth + 2)
    })

    it('measures a right-aligned header past its leading spacer', async () => {
        const grid = makeGrid([
            {
                id: 'bonus',
                header: 'Annual bonus',
                width: 400,
                align: 'right',
                sortable: true,
                filter: 'number'
            },
            { id: 'dept', header: 'Dept', width: 110 }
        ])
        await mount(grid)
        const ops = getColumnOps(grid)!

        ops.autoSizeColumn('bonus')
        // The old measurement read the zero-width spacer and collapsed the
        // column to its minimum.
        await expect.poll(() => ops.currentWidth('bonus')).toBeGreaterThan(120)
    })
})

describe('a restored layout cannot break a header group', () => {
    it('pulls an interleaved order back so each group stays one stretch', async () => {
        const grid = createDataGrid<Row>({
            columns: [
                {
                    id: 'identity',
                    header: 'Identity',
                    children: [
                        { id: 'id', header: '#', width: 80 },
                        { id: 'note', header: 'Note', width: 120 }
                    ]
                },
                {
                    id: 'pay',
                    header: 'Pay',
                    children: [{ id: 'bonus', header: 'Bonus', width: 110 }]
                }
            ],
            data: rows,
            getRowId: (row) => String(row.id),
            features: [columnOps()]
        })
        const screen = await mount(grid)

        // The shape a stale snapshot can hold: Identity, Pay, Identity.
        grid.setState({ version: 1, columns: { order: ['id', 'bonus', 'note'] } })
        await expect
            .poll(() => grid.columns.visible.map((column) => column.id))
            .toEqual(['id', 'note', 'bonus'])

        const groupCells = [
            ...screen.container.querySelectorAll('[role="row"] [role="columnheader"]')
        ].filter((cell) => !cell.hasAttribute('data-dg-cell'))
        // One cell per group, not a label repeated over unrelated columns.
        expect(groupCells.map((cell) => cell.textContent?.trim())).toEqual(['Identity', 'Pay'])
    })
})
