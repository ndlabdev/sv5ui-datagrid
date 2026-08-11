import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    type ColumnDef,
    type DataGridCellContext,
    type DataGridProps
} from '$lib/index.js'
import Renderers from '../routes/renderers/+page.svelte'
import FormattedCells from './FormattedCells.svelte'

interface Row {
    id: number
    amount: number | null
    done: boolean
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Row>>

/**
 * What a snippet is handed. AG Grid calls it `valueFormatted` and MUI calls it
 * `formattedValue`; either way the grid formats and the renderer decorates,
 * rather than the renderer restating the column's own options.
 */
describe('formatted, handed to a cell snippet', () => {
    it('prints through the built-in renderer when no snippet takes over', async () => {
        const columns: ColumnDef<Row>[] = [
            {
                id: 'plain',
                header: 'Plain',
                accessor: (row) => row.amount,
                type: 'currency',
                typeOptions: { currency: 'EUR', locale: 'de-DE' },
                width: 170
            }
        ]
        const grid = createDataGrid<Row>({
            columns,
            data: [{ id: 1, amount: 1234.5, done: true }],
            getRowId: (row) => String(row.id)
        })
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        // The same string the snippet test reads off `formatted`, so the two
        // paths are pinned to one another rather than to a literal each.
        const printed = screen.container.querySelector('[data-dg-cell="0:0"]')!.textContent?.trim()
        expect(printed).toContain('1.234,50')
    })

    it('gives a snippet the column and the formatted text, widgets excepted', async () => {
        const contexts: DataGridCellContext<Row>[] = []
        const screen = await render(
            FormattedCells as never,
            {
                onCell: (ctx: DataGridCellContext<Row>) => contexts.push(ctx)
            } as never
        )
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const byId = (id: string) => contexts.find((ctx) => ctx.column.id === id)
        expect(byId('money')?.formatted).toBe('$1,235')
        expect(byId('when')?.formatted).toBe('Aug 11, 2026')
        expect(byId('plain')?.formatted).toBe('hello')
        expect(byId('empty')?.formatted).toBe('—')
        // A widget has no string standing for it.
        expect(byId('bar')?.formatted).toBeUndefined()
        expect(byId('flag')?.formatted).toBeUndefined()
        // And the column comes with it, so nothing is restated.
        expect(byId('money')?.column.def.typeOptions?.currency).toBe('USD')
    })

    it('renders the demo cell that decorates the formatted text', async () => {
        render(Renderers as never)
        await expect.element(page.getByRole('grid').first()).toBeVisible()
        const cell = document.querySelector('[data-testid="budget-cell"]')
        expect(cell?.textContent?.trim()).toMatch(/^\$[\d,]+/)
    })
})
