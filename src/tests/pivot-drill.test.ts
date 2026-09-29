import { describe, expect, it } from 'vitest'
import {
    createDataGrid,
    filtering,
    getFiltering,
    getSorting,
    sorting,
    type ColumnDef,
    type GridState,
    type RowNode
} from '$lib/index.js'
import { getPivot, pivot, type PivotOptions } from '../lib/features/pivot/index.js'

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
    { id: 'region', filter: 'text' },
    { id: 'quarter', filter: 'text' },
    { id: 'product', filter: 'text' },
    { id: 'amount', type: 'number' }
]

function build(options: Partial<PivotOptions<Sale>> = {}): GridState<Sale> {
    return createDataGrid<Sale>({
        columns,
        data: sales,
        getRowId: (row) => String(row.id),
        features: [
            filtering(),
            sorting(),
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }],
                ...options
            })
        ]
    })
}

const groups = (grid: GridState<Sale>): RowNode<Sale>[] =>
    grid.preWindowNodes.filter((node) => node.meta?.expandable)

const ids = (rows: Sale[]) => rows.map((row) => row.id).sort((a, b) => a - b)

describe('the rows behind a crossed cell', () => {
    it('hands back exactly the rows that were added into it', () => {
        const grid = build()
        const north = groups(grid)[0]!

        expect(ids(getPivot(grid)!.rowsBehind(north, '__pv:c:Q1::0'))).toEqual([1, 2])
        expect(ids(getPivot(grid)!.rowsBehind(north, '__pv:c:Q2::0'))).toEqual([3])
    })

    it('hands back nothing for a crossing with nothing behind it', () => {
        const grid = build()
        const south = groups(grid)[1]!

        expect(getPivot(grid)!.rowsBehind(south, '__pv:c:Q2::0')).toEqual([])
    })

    it('adds up to the number the cell was showing', () => {
        const grid = build()
        const north = groups(grid)[0]!
        const behind = getPivot(grid)!.rowsBehind(north, '__pv:c:Q1::0')

        expect(behind.reduce((sum, row) => sum + row.amount, 0)).toBe(
            grid.getValue(north, grid.columns.get('__pv:c:Q1::0')!)
        )
    })

    it('hands back the whole group for a total column', () => {
        const grid = build({ totalColumn: 'Total' })
        const north = groups(grid)[0]!

        expect(ids(getPivot(grid)!.rowsBehind(north, '__pv:t:0'))).toEqual([1, 2, 3])
    })

    it('hands back the branch for a subtotal, not one leaf of it', () => {
        const grid = build({
            columns: ['quarter', 'product'],
            columnSubtotal: (header) => `${header} total`
        })
        const north = groups(grid)[0]!

        expect(ids(getPivot(grid)!.rowsBehind(north, '__pv:c:Q1::s0'))).toEqual([1, 2])
        expect(ids(getPivot(grid)!.rowsBehind(north, '__pv:c:Q1|Widget::0'))).toEqual([1])
    })

    it('reads the row axis all the way down when it has more than one field', () => {
        const grid = build({ rows: ['region', 'product'] })
        grid.expansion.expandAll(groups(grid).map((node) => node.id))

        const inner = groups(grid).find((node) => node.meta?.level === 1)!
        const behind = getPivot(grid)!.rowsBehind(inner, '__pv:c:Q1::0')

        expect(behind.every((row) => row.region === 'North')).toBe(true)
        expect(new Set(behind.map((row) => row.product)).size).toBe(1)
    })

    it('hands back every row the grid is showing for the total row', () => {
        const grid = build({ totalRow: 'All' })
        const last = grid.preWindowNodes[grid.preWindowNodes.length - 1]!

        expect(ids(getPivot(grid)!.rowsBehind(last, '__pv:c:Q1::0'))).toEqual([1, 2, 4])
    })

    it('answers what the filter left, not what the data holds', () => {
        const grid = build()
        const north = () => groups(grid)[0]!
        expect(ids(getPivot(grid)!.rowsBehind(north(), '__pv:c:Q1::0'))).toEqual([1, 2])

        getFiltering(grid)!.setColumnFilter('product', {
            kind: 'text',
            op: 'equals',
            value: 'Widget'
        })

        expect(ids(getPivot(grid)!.rowsBehind(north(), '__pv:c:Q1::0'))).toEqual([1])
    })

    it('says nothing for a column that is not a crossing', () => {
        const grid = build()
        const north = groups(grid)[0]!

        expect(getPivot(grid)!.rowsBehind(north, 'region')).toEqual([])
        expect(getPivot(grid)!.rowsBehind(north, '__pv:c:Q9::0')).toEqual([])
    })

    it('is reachable from the api', () => {
        const grid = build()
        const north = groups(grid)[0]!

        expect(ids(grid.api.pivotRowsBehind?.(north, '__pv:c:Q1::0') as Sale[])).toEqual([1, 2])
    })
})

describe('a subtotal column can be sorted by', () => {
    it('orders the groups by what the branch totalled', () => {
        const ranked: Sale[] = [
            { id: 1, region: 'A', quarter: 'Q1', product: 'W', amount: 10 },
            { id: 2, region: 'B', quarter: 'Q1', product: 'W', amount: 500 },
            { id: 3, region: 'A', quarter: 'Q2', product: 'W', amount: 1 },
            { id: 4, region: 'B', quarter: 'Q2', product: 'W', amount: 1 }
        ]
        const grid = createDataGrid<Sale>({
            columns,
            data: ranked,
            getRowId: (row) => String(row.id),
            features: [
                sorting(),
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter', 'product'],
                    values: [{ field: 'amount', agg: 'sum' }],
                    columnSubtotal: (header) => `${header} total`,
                    sortableColumns: true
                })
            ]
        })

        const labels = () =>
            grid.preWindowNodes
                .filter((node) => node.meta?.expandable)
                .map((node) => String(grid.getValue(node, grid.columns.get('region')!)))

        expect(getPivot(grid)!.ownsSort('__pv:c:Q1::s0')).toBe(true)
        expect(labels()).toEqual(['A', 'B'])

        getSorting(grid)!.setSort([{ columnId: '__pv:c:Q1::s0', direction: 'desc' }])
        expect(labels()).toEqual(['B', 'A'])
    })
})
