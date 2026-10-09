import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    getGrouping,
    grouping,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'
import { getPivot, pivot } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    quarter: string
    amount: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Sale>>

const sales: Sale[] = [
    { id: 1, region: 'North', quarter: 'Q1', amount: 100 },
    { id: 2, region: 'North', quarter: 'Q2', amount: 150 },
    { id: 3, region: 'South', quarter: 'Q1', amount: 200 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region', header: 'Region', width: 140 },
    { id: 'quarter', header: 'Quarter', width: 140 },
    { id: 'amount', header: 'Amount', type: 'number', width: 140 }
]

const menuNames = () =>
    Array.from(document.querySelectorAll('[role="menuitem"]')).map(
        (item) => item.textContent?.trim() ?? ''
    )

async function openMenuOn(header: string) {
    await page.getByRole('button', { name: `${header} column menu` }).click()
    await expect.poll(() => menuNames().length).toBeGreaterThan(0)
}

describe('the column menu offers what the features put on a column', () => {
    it('offers both pivot axes once the crossing is off and the columns are back', async () => {
        const grid: GridState<Sale> = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (sale) => String(sale.id),
            features: [
                columnOps(),
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'amount', agg: 'sum' }]
                })
            ]
        })

        render(TypedDataGrid, { grid })
        await expect.element(page.getByRole('treegrid')).toBeVisible()
        getPivot(grid)!.clearPivot()

        await openMenuOn('Amount')
        expect(menuNames()).toEqual(
            expect.arrayContaining(['Pivot down this column', 'Pivot across this column'])
        )
    })

    it('puts a column on the row axis from the menu', async () => {
        const grid: GridState<Sale> = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (sale) => String(sale.id),
            features: [
                columnOps(),
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'amount', agg: 'sum' }]
                })
            ]
        })

        render(TypedDataGrid, { grid })
        await expect.element(page.getByRole('treegrid')).toBeVisible()
        getPivot(grid)!.clearPivot()

        await openMenuOn('Quarter')
        await page.getByRole('menuitem', { name: 'Pivot down this column' }).click()

        await expect.poll(() => getPivot(grid)!.rows).toEqual(['quarter'])
    })

    it('offers to take a column back off the pivot', async () => {
        const grid: GridState<Sale> = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (sale) => String(sale.id),
            features: [
                columnOps(),
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'amount', agg: 'sum' }]
                })
            ]
        })

        render(TypedDataGrid, { grid })
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        await openMenuOn('Region')
        expect(menuNames()).toContain('Remove from pivot')

        await page.getByRole('menuitem', { name: 'Remove from pivot' }).click()
        await expect.poll(() => getPivot(grid)!.rows).toEqual([])
    })

    it('offers grouping on a column too, from the same menu', async () => {
        const grid: GridState<Sale> = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (sale) => String(sale.id),
            features: [columnOps(), grouping<Sale>({ by: [] })]
        })

        render(TypedDataGrid, { grid })
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        await openMenuOn('Region')
        expect(menuNames()).toContain('Group by this column')

        await page.getByRole('menuitem', { name: 'Group by this column' }).click()
        await expect.poll(() => getGrouping(grid)!.by).toEqual(['region'])
    })
})
