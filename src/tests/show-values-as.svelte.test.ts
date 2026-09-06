import { createDataGrid, type ColumnDef, type DataGridProps, type GridState } from '$lib/index.js'
import axe from 'axe-core'
import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import DataGrid from '../lib/components/grid/DataGrid.svelte'
import { grouping } from '../lib/features/grouping/grouping.svelte.js'
import { showValuesAs } from '../lib/features/show-values-as/show-values-as.svelte.js'
import type { ShowAs } from '../lib/features/show-values-as/show-values-as.types.js'

interface Sale {
    id: number
    region: string
    revenue: number
}

const sales: Sale[] = [
    { id: 1, region: 'North', revenue: 100 },
    { id: 2, region: 'North', revenue: 300 },
    { id: 3, region: 'South', revenue: 600 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region', header: 'Region', flex: 1, minWidth: 200 },
    { id: 'revenue', header: 'Revenue', type: 'percent', align: 'right', width: 140 }
]

const TypedGrid = DataGrid as unknown as Component<DataGridProps<Sale>>

function makeGrid(showAs: ShowAs, by: string[] = []): GridState<Sale> {
    return createDataGrid<Sale>({
        columns,
        data: sales,
        getRowId: (row) => String(row.id),
        features: [
            grouping<Sale>({ by, aggregations: { revenue: 'sum' } }),
            showValuesAs<Sale>({ columns: { revenue: showAs } })
        ]
    })
}

async function renderGrid(grid: GridState<Sale>) {
    const screen = await render(TypedGrid, { grid })
    await expect.element(screen.getByRole('grid').or(screen.getByRole('treegrid'))).toBeVisible()
    return screen
}

const cellText = (container: Element, rowId: string): string =>
    container
        .querySelector(`[data-dg-row-id="${rowId}"] [role="gridcell"]:last-child`)!
        .textContent!.trim()

describe('a share on screen', () => {
    it('draws the percent the column type promises, not the fraction underneath', async () => {
        const screen = await renderGrid(makeGrid('percentOfGrandTotal'))

        expect(cellText(screen.container, '1')).toBe('10%')
        expect(cellText(screen.container, '2')).toBe('30%')
        expect(cellText(screen.container, '3')).toBe('60%')
    })

    it('shows a group row and its members against their own totals', async () => {
        const screen = await renderGrid(makeGrid('percentOfParent', ['region']))

        expect(cellText(screen.container, 'group:region=North')).toBe('40%')
        expect(cellText(screen.container, '1')).toBe('25%')
        expect(cellText(screen.container, '2')).toBe('75%')
    })

    it('is axe-clean while a column is shown as a share', async () => {
        const screen = await renderGrid(makeGrid('percentOfParent', ['region']))

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })
})
