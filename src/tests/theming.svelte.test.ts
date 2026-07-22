import { afterEach, describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    defineDataGridConfig,
    resetDataGridConfig,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Row {
    id: number
    name: string
    amount: number
}

const rows: Row[] = [
    { id: 1, name: 'Alice', amount: 120 },
    { id: 2, name: 'Bob', amount: -40 },
    { id: 3, name: 'Carol', amount: 0 }
]

const columns: ColumnDef<Row>[] = [{ id: 'name' }, { id: 'amount' }]

function renderGrid(props: Partial<DataGridProps<Row>> = {}) {
    return render(
        DataGrid as never,
        {
            data: rows,
            columns,
            getRowId: (row: Row) => String(row.id),
            ...props
        } as never
    )
}

function cellOf(text: string): HTMLElement {
    const cells = [...document.querySelectorAll<HTMLElement>('[role="gridcell"]')]
    const cell = cells.find((candidate) => candidate.textContent?.trim() === text)
    if (!cell) throw new Error(`no cell rendering ${text}`)
    return cell
}

afterEach(() => resetDataGridConfig())

describe('theming — per-instance ui', () => {
    it('adds slot classes without dropping the variant’s own', async () => {
        renderGrid({ ui: { cell: 'font-mono', headerCell: 'uppercase' } })
        await expect.element(page.getByRole('grid')).toBeVisible()

        const cell = cellOf('Alice')
        expect(cell.className).toContain('font-mono')
        // The variant's own layout classes survive the merge.
        expect(cell.className).toContain('items-center')

        const header = document.querySelector<HTMLElement>('[role="columnheader"]')!
        expect(header.className).toContain('uppercase')
    })

    it('lets a slot override conflicting variant utilities', async () => {
        renderGrid({ ui: { cell: 'px-8' } })
        await expect.element(page.getByRole('grid')).toBeVisible()

        const cell = cellOf('Alice')
        expect(cell.className).toContain('px-8')
        expect(cell.className).not.toContain('px-3')
    })
})

describe('theming — global config', () => {
    it('applies config slots to every grid', async () => {
        defineDataGridConfig({ slots: { cell: 'tracking-wide' } })
        renderGrid()
        await expect.element(page.getByRole('grid')).toBeVisible()

        expect(cellOf('Alice').className).toContain('tracking-wide')
    })

    it('lets a per-instance ui win over the config', async () => {
        defineDataGridConfig({ slots: { cell: 'px-8' } })
        renderGrid({ ui: { cell: 'px-1' } })
        await expect.element(page.getByRole('grid')).toBeVisible()

        const cell = cellOf('Alice')
        expect(cell.className).toContain('px-1')
        expect(cell.className).not.toContain('px-8')
    })

    it('supplies the density a grid did not ask for', async () => {
        defineDataGridConfig({ defaultVariants: { density: 'compact' } })
        const grid: GridState<Row> = createDataGrid<Row>({
            data: rows,
            columns,
            getRowId: (row) => String(row.id)
        })
        render(DataGrid as never, { grid } as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        expect(grid.density).toBe('compact')
    })

    it('leaves an explicit density alone', async () => {
        defineDataGridConfig({ defaultVariants: { density: 'compact' } })
        const grid: GridState<Row> = createDataGrid<Row>({
            data: rows,
            columns,
            getRowId: (row) => String(row.id),
            density: 'comfortable'
        })
        render(DataGrid as never, { grid } as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        expect(grid.density).toBe('comfortable')
    })

    it('is back to defaults once reset', async () => {
        defineDataGridConfig({ slots: { cell: 'tracking-wide' } })
        resetDataGridConfig()
        renderGrid()
        await expect.element(page.getByRole('grid')).toBeVisible()

        expect(cellOf('Alice').className).not.toContain('tracking-wide')
    })
})

describe('theming — data-driven callbacks', () => {
    it('applies rowClass per row', async () => {
        renderGrid({ rowClass: (node) => node.row.amount < 0 && 'row-negative' })
        await expect.element(page.getByRole('grid')).toBeVisible()

        const rowOf = (name: string) => cellOf(name).closest('[role="row"]')!
        expect(rowOf('Bob').className).toContain('row-negative')
        expect(rowOf('Alice').className).not.toContain('row-negative')
    })

    it('applies cellClass per column and merges over the variant', async () => {
        renderGrid({
            columns: [
                { id: 'name' },
                {
                    id: 'amount',
                    cellClass: (ctx) => (Number(ctx.value) < 0 ? 'text-error' : undefined)
                }
            ]
        })
        await expect.element(page.getByRole('grid')).toBeVisible()

        expect(cellOf('-40').className).toContain('text-error')
        // The default cell colour loses to the callback rather than fighting it.
        expect(cellOf('-40').className).not.toContain('text-on-surface')
        expect(cellOf('120').className).not.toContain('text-error')
        // A column without the callback is untouched.
        expect(cellOf('Alice').className).not.toContain('text-error')
    })
})
