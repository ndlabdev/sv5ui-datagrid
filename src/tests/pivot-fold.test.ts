import { describe, expect, it } from 'vitest'
import {
    createDataGrid,
    pickColumns,
    rowsToMatrix,
    toCsv,
    type ColumnDef,
    type GridState
} from '$lib/index.js'
import { isPivotColumn, pivot, type PivotOptions } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    quarter: string
    product: string
    amount: number
}

const sales: Sale[] = [
    { id: 1, region: 'North', quarter: 'Q1', product: 'Widget', amount: 100 },
    { id: 2, region: 'North', quarter: 'Q1', product: 'Gadget', amount: 60 },
    { id: 3, region: 'North', quarter: 'Q2', product: 'Widget', amount: 150 },
    { id: 4, region: 'South', quarter: 'Q1', product: 'Widget', amount: 200 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'quarter' },
    { id: 'product' },
    { id: 'amount', type: 'number' }
]

function build(options: Partial<PivotOptions<Sale>> = {}): GridState<Sale> {
    return createDataGrid<Sale>({
        columns,
        data: sales,
        getRowId: (row) => String(row.id),
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter', 'product'],
                values: [{ field: 'amount', agg: 'sum' }],
                columnSubtotal: (header) => `${header} total`,
                columnGroups: 'open',
                ...options
            })
        ]
    })
}

const drawn = (grid: GridState<Sale>) =>
    grid.columns.visible
        .filter((column) => isPivotColumn(column.id))
        .map((column) => String(column.def.header))

describe('a column group folds down to its own total', () => {
    it('is not foldable unless asked', () => {
        const grid = build({ columnGroups: 'fixed' })

        expect([...grid.columns.groupToggles.keys()]).toEqual([])
        expect(grid.columns.setGroupCollapsed('__pv:c:Q1', true)).toBe(false)
    })

    it('offers every key group as a fold, and no leaf', () => {
        expect([...build().columns.groupToggles.keys()]).toEqual(['__pv:c:Q1', '__pv:c:Q2'])
    })

    it('leaves the total standing and takes the children away', () => {
        const grid = build()
        expect(drawn(grid)).toEqual(['Gadget', 'Widget', 'Q1 total', 'Widget', 'Q2 total'])

        grid.columns.setGroupCollapsed('__pv:c:Q1', true)
        expect(drawn(grid)).toEqual(['Q1 total', 'Widget', 'Q2 total'])
    })

    it('folds one branch without touching its neighbour', () => {
        const grid = build()
        grid.columns.setGroupCollapsed('__pv:c:Q2', true)

        expect(drawn(grid)).toEqual(['Gadget', 'Widget', 'Q1 total', 'Q2 total'])
    })

    it('keeps the number the total was showing while it was open', () => {
        const grid = build()
        const north = () => grid.preWindowNodes.find((node) => node.id.startsWith('group:'))!
        const before = grid.getValue(north(), grid.columns.get('__pv:c:Q1::s0')!)

        grid.columns.setGroupCollapsed('__pv:c:Q1', true)

        expect(before).toBe(160)
        expect(grid.getValue(north(), grid.columns.get('__pv:c:Q1::s0')!)).toBe(160)
    })

    it('starts folded when it is asked to', () => {
        expect(drawn(build({ columnGroups: 'closed' }))).toEqual(['Q1 total', 'Q2 total'])
    })

    it('unfolds again', () => {
        const grid = build({ columnGroups: 'closed' })
        grid.columns.setGroupCollapsed('__pv:c:Q1', false)

        expect(drawn(grid)).toEqual(['Gadget', 'Widget', 'Q1 total', 'Q2 total'])
    })

    it('folds to a rail when there is no total to fold down to', () => {
        const grid = build({ columnSubtotal: undefined })

        expect(grid.columns.groupDef('__pv:c:Q1')?.collapseMode).toBe('rail')
        expect(grid.columns.setGroupCollapsed('__pv:c:Q1', true)).toBe(true)
        expect(drawn(grid)).toEqual(['Widget'])
    })

    it('offers no fold when there is only one column field, every column being a leaf', () => {
        const grid = build({ columns: ['quarter'] })

        expect([...grid.columns.groupToggles.keys()]).toEqual([])
        expect(drawn(grid)).toEqual(['Q1', 'Q2'])
    })

    it('keeps a fold the reader made when the data brings a new key', () => {
        const grid = build()
        grid.columns.setGroupCollapsed('__pv:c:Q1', true)

        grid.data = [
            ...sales,
            { id: 9, region: 'North', quarter: 'Q3', product: 'Widget', amount: 10 }
        ]

        expect(drawn(grid)).toEqual(['Q1 total', 'Widget', 'Q2 total', 'Widget', 'Q3 total'])
    })
})

describe('a fold is part of the view', () => {
    it('comes back after a saved view is reloaded', () => {
        const grid = build()
        grid.columns.setGroupCollapsed('__pv:c:Q1', true)
        expect(drawn(grid)).toEqual(['Q1 total', 'Widget', 'Q2 total'])

        const snapshot = grid.api.getState!()

        const fresh = build()
        expect(drawn(fresh)).toEqual(['Gadget', 'Widget', 'Q1 total', 'Widget', 'Q2 total'])

        fresh.api.setState!(snapshot)
        expect(drawn(fresh)).toEqual(['Q1 total', 'Widget', 'Q2 total'])
    })

    it('comes back even when the view also changes which fields are crossed', () => {
        const grid = build()
        grid.api.setPivotColumns?.(['product', 'quarter'])
        grid.columns.setGroupCollapsed('__pv:c:Widget', true)
        const folded = drawn(grid)

        const snapshot = grid.api.getState!()
        const fresh = build()
        fresh.api.setState!(snapshot)

        expect(folded).toContain('Widget total')
        expect(drawn(fresh)).toEqual(folded)
        expect(fresh.columns.isCollapsed('__pv:c:Widget')).toBe(true)
    })
})

describe('what a fold means to everything downstream', () => {
    it('exports what the reader is looking at, not what is folded away', () => {
        const grid = build()
        const csv = () =>
            toCsv(
                rowsToMatrix(grid.preWindowNodes, pickColumns(grid.columns.visible), undefined, {
                    read: (column) => grid.readerFor(column.id, 'export')
                })
            )

        expect(csv()).toBe('North,60,100,160,150,150\r\nSouth,,200,200,,')

        grid.columns.setGroupCollapsed('__pv:c:Q1', true)
        expect(csv()).toBe('North,160,150,150\r\nSouth,200,,')
    })

    it('is driven from the api the same way every other setting is', () => {
        const grid = build({ columnGroups: 'fixed' })
        expect(grid.columns.setGroupCollapsed('__pv:c:Q1', true)).toBe(false)

        grid.api.setPivotColumnGroups?.('open')
        expect(grid.columns.setGroupCollapsed('__pv:c:Q1', true)).toBe(true)
        expect(drawn(grid)).toEqual(['Q1 total', 'Widget', 'Q2 total'])
    })
})
