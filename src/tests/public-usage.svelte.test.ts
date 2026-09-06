import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { userEvent } from 'vitest/browser'
import {
    createDataGrid,
    getRangeSelection,
    rangeSelection,
    sorting,
    type ColumnDef,
    type GridState
} from '$lib/index.js'
import type { Component } from 'svelte'
import DataGridComponent from '../lib/components/grid/DataGrid.svelte'

interface Sale {
    id: number
    region: string
    amount: number
}

const columns: ColumnDef<Sale>[] = [
    { id: 'region', header: 'Region', width: 160 },
    { id: 'amount', header: 'Amount', width: 120 }
]

const sales: Sale[] = [
    { id: 1, region: 'North', amount: 100 },
    { id: 2, region: 'South', amount: 400 }
]

const DataGrid = DataGridComponent as unknown as Component<{ grid: GridState<Sale> }>

function makeGrid(withRange: boolean): GridState<Sale> {
    return createDataGrid<Sale>({
        columns,
        data: sales,
        getRowId: (row) => String(row.id),
        features: withRange ? [sorting(), rangeSelection()] : [sorting()]
    })
}

/**
 * What registering a feature is worth, driven through the DOM.
 *
 * The layer that reads these gestures used to be a component an application
 * wrapped the grid in, and this test used to be about remembering to. It is
 * about the feature list now: register `rangeSelection()` and dragging selects
 * cells, leave it out and the same drag does nothing.
 */
describe('a grid assembled from the public surface', () => {
    async function drag(container: Element): Promise<void> {
        const from = container.querySelector<HTMLElement>('[data-dg-cell="0:0"]')!
        const to = container.querySelector<HTMLElement>('[data-dg-cell="1:1"]')!
        await userEvent.dragAndDrop(from, to)
    }

    it('selects a range only when the feature is registered', async () => {
        const bare = makeGrid(false)
        const plain = await render(DataGrid, { grid: bare })
        await drag(plain.container)
        expect(getRangeSelection(bare)).toBeUndefined()

        const ranged = makeGrid(true)
        const layered = await render(DataGrid, { grid: ranged })
        await drag(layered.container)
        expect(getRangeSelection(ranged)!.ranges).toHaveLength(1)
    })
})
