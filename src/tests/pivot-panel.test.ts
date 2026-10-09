import { describe, expect, it } from 'vitest'
import { createDataGrid, type ColumnDef, type GridState } from '$lib/index.js'
import { getPivot, pivot } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    quarter: string
    product: string
    amount: number
}

const sales: Sale[] = [
    { id: 1, region: 'North', quarter: 'Q1', product: 'Widget', amount: 100 },
    { id: 2, region: 'South', quarter: 'Q2', product: 'Gadget', amount: 200 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region', header: 'Region' },
    { id: 'quarter', header: 'Quarter' },
    { id: 'product', header: 'Product' },
    { id: 'amount', header: 'Amount', type: 'currency' }
]

function build(): GridState<Sale> {
    return createDataGrid<Sale>({
        columns,
        data: sales,
        getRowId: (row) => String(row.id),
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }]
            })
        ]
    })
}

const state = (grid: GridState<Sale>) => getPivot(grid)!

describe('the fields a panel can still offer', () => {
    it('offers what the application declared, not what the crossing left drawn', () => {
        const grid = build()

        expect(grid.columns.visible.map((column) => column.id)).not.toContain('product')
        expect(
            state(grid)
                .pivotableColumns()
                .map((column) => column.id)
        ).toEqual(['product', 'amount'])
    })

    it('stops offering a field once it goes on an axis', () => {
        const grid = build()
        state(grid).addColumnField('product')

        expect(
            state(grid)
                .pivotableColumns()
                .map((column) => column.id)
        ).toEqual(['amount'])
    })

    it('carries the header the application gave, not the id', () => {
        expect(state(build()).pivotableColumns()[0]).toEqual({ id: 'product', header: 'Product' })
    })

    it('offers nothing the pivot generated, those being no column anyone declared', () => {
        const grid = build()
        expect(grid.columns.visible.some((column) => column.id.startsWith('__pv'))).toBe(true)

        expect(
            state(grid)
                .pivotableColumns()
                .some((column) => column.id.startsWith('__pv'))
        ).toBe(false)
    })
})

describe('moving a field along its axis', () => {
    function three() {
        const grid = build()
        state(grid).setColumns(['quarter', 'product', 'amount'])
        return grid
    }

    it('moves one step out and one step in', () => {
        const grid = three()
        state(grid).moveColumnField('product', -1)
        expect(state(grid).columns).toEqual(['product', 'quarter', 'amount'])

        state(grid).moveColumnField('product', 1)
        expect(state(grid).columns).toEqual(['quarter', 'product', 'amount'])
    })

    it('stays put at the near end rather than falling off', () => {
        const grid = three()
        state(grid).moveColumnField('quarter', -1)

        expect(state(grid).columns).toEqual(['quarter', 'product', 'amount'])
    })

    it('stays put at the far end rather than being carried past it', () => {
        const grid = three()
        state(grid).moveColumnField('amount', 1)

        expect(state(grid).columns).toEqual(['quarter', 'product', 'amount'])
    })

    it('refuses a step that would land outside, not just one past the end', () => {
        const grid = three()
        state(grid).moveColumnField('quarter', 5)
        expect(state(grid).columns).toEqual(['quarter', 'product', 'amount'])

        state(grid).moveColumnField('amount', -9)
        expect(state(grid).columns).toEqual(['quarter', 'product', 'amount'])
    })

    it('ignores a field that is not on that axis', () => {
        const grid = three()
        state(grid).moveRowField('quarter', 1)

        expect(state(grid).rows).toEqual(['region'])
    })

    it('redraws the crossing in the new order', () => {
        const grid = build()
        state(grid).setColumns(['quarter', 'product'])
        const shaped = () =>
            grid.columns.shaped
                .filter((def) => def.id.startsWith('__pv'))
                .map((def) => String(def.header))

        expect(shaped()).toEqual(['Q1', 'Q2'])
        state(grid).moveColumnField('product', -1)
        expect(shaped()).toEqual(['Gadget', 'Widget'])
    })
})

describe('the measures a panel edits', () => {
    it('adds one, reducing with a sum unless told otherwise', () => {
        const grid = build()
        state(grid).addValue('amount')

        expect(state(grid).values).toEqual([
            { field: 'amount', agg: 'sum' },
            { field: 'amount', agg: 'sum' }
        ])
    })

    it('changes how one reduces without touching the others', () => {
        const grid = build()
        state(grid).addValue('amount', 'count')
        state(grid).setValueAgg(0, 'avg')

        expect(state(grid).values.map((measure) => measure.agg)).toEqual(['avg', 'count'])
    })

    it('changes what one is read as, and takes it back off', () => {
        const grid = build()
        state(grid).setValueShowAs(0, 'percentOfRow')
        expect(state(grid).values[0]!.showAs).toBe('percentOfRow')

        state(grid).setValueShowAs(0, undefined)
        expect(state(grid).values[0]!.showAs).toBeUndefined()
    })

    it('removes one by where it sits, not by what it measures', () => {
        const grid = build()
        state(grid).addValue('amount', 'count')
        state(grid).removeValue(0)

        expect(state(grid).values).toEqual([{ field: 'amount', agg: 'count' }])
    })

    it('stops crossing when the last measure goes, and starts again', () => {
        const grid = build()
        state(grid).removeValue(0)

        expect(grid.api.isPivoting?.()).toBe(false)
        expect(grid.columns.visible.map((column) => column.id)).toEqual([
            'region',
            'quarter',
            'product',
            'amount'
        ])

        state(grid).addValue('amount')
        expect(grid.api.isPivoting?.()).toBe(true)
    })
})
