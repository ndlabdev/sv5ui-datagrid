import { describe, expect, it } from 'vitest'
import { createDataGrid, type ColumnDef, type GridState, type RowNode } from '$lib/index.js'
import { pivot, type PivotOptions, type PivotShowAs } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    quarter: string
    amount: number
}

const sales: Sale[] = [
    { id: 1, region: 'North', quarter: 'Q1', amount: 100 },
    { id: 2, region: 'North', quarter: 'Q1', amount: 80 },
    { id: 3, region: 'North', quarter: 'Q2', amount: 150 },
    { id: 4, region: 'South', quarter: 'Q1', amount: 200 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'quarter' },
    { id: 'amount', type: 'currency' }
]

function build(showAs: PivotShowAs | undefined, extra: Partial<PivotOptions<Sale>> = {}) {
    return createDataGrid<Sale>({
        columns,
        data: sales,
        getRowId: (row) => String(row.id),
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum', showAs }],
                ...extra
            })
        ]
    })
}

const groups = (grid: GridState<Sale>): RowNode<Sale>[] =>
    grid.preWindowNodes.filter((node) => node.id.startsWith('group:'))

const at = (grid: GridState<Sale>, node: RowNode<Sale>, id: string) =>
    grid.getValue(node, grid.columns.get(id)!)

describe('a measure read as a share', () => {
    it('reads across to one, dividing by the rows the gathered row holds', () => {
        const grid = build('percentOfRow')
        const [north, south] = groups(grid)

        expect(at(grid, north!, '__pv:c:Q1::0')).toBeCloseTo(180 / 330, 6)
        expect(at(grid, north!, '__pv:c:Q2::0')).toBeCloseTo(150 / 330, 6)
        expect(at(grid, south!, '__pv:c:Q1::0')).toBeCloseTo(1, 6)
    })

    it('reads down to one, dividing by the rows under the same crossing', () => {
        const grid = build('percentOfColumn')
        const [north, south] = groups(grid)

        expect(at(grid, north!, '__pv:c:Q1::0')).toBeCloseTo(180 / 380, 6)
        expect(at(grid, south!, '__pv:c:Q1::0')).toBeCloseTo(200 / 380, 6)
        expect(at(grid, north!, '__pv:c:Q2::0')).toBeCloseTo(1, 6)
    })

    it('divides by every row the grid is showing', () => {
        const grid = build('percentOfTotal')
        const [north, south] = groups(grid)

        expect(at(grid, north!, '__pv:c:Q1::0')).toBeCloseTo(180 / 530, 6)
        expect(at(grid, north!, '__pv:c:Q2::0')).toBeCloseTo(150 / 530, 6)
        expect(at(grid, south!, '__pv:c:Q1::0')).toBeCloseTo(200 / 530, 6)
    })

    it('measures each denominator from the rows, which an average would get wrong', () => {
        const grid = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'amount', agg: 'avg', showAs: 'percentOfRow' }]
                })
            ]
        })
        const north = groups(grid)[0]!

        expect(at(grid, north, '__pv:c:Q1::0')).toBeCloseTo(90 / 110, 6)
        expect(at(grid, north, '__pv:c:Q2::0')).toBeCloseTo(150 / 110, 6)
    })

    it('draws the generated column as a percent whatever the measured column was', () => {
        expect(build('percentOfRow').columns.get('__pv:c:Q1::0')!.def.type).toBe('percent')
        expect(build(undefined).columns.get('__pv:c:Q1::0')!.def.type).toBe('currency')
    })

    it('leaves an empty crossing empty rather than calling it nought percent', () => {
        const grid = build('percentOfRow')
        const south = groups(grid)[1]!

        expect(at(grid, south, '__pv:c:Q2::0')).toBeUndefined()
    })

    it('shows one measure as a share and leaves the other as it was', () => {
        const grid = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [
                        { field: 'amount', agg: 'sum', header: 'Sum' },
                        { field: 'amount', agg: 'sum', header: 'Share', showAs: 'percentOfRow' }
                    ]
                })
            ]
        })
        const north = groups(grid)[0]!

        expect(at(grid, north, '__pv:c:Q1::0')).toBe(180)
        expect(at(grid, north, '__pv:c:Q1::1')).toBeCloseTo(180 / 330, 6)
        expect(grid.columns.get('__pv:c:Q1::0')!.def.type).toBe('currency')
        expect(grid.columns.get('__pv:c:Q1::1')!.def.type).toBe('percent')
    })

    it('makes the total column read one when the row is read across', () => {
        const grid = build('percentOfRow', { totalColumn: 'Total' })
        const north = groups(grid)[0]!

        expect(at(grid, north, '__pv:t:0')).toBeCloseTo(1, 6)
    })

    it('divides a subtotal by the same whole its leaves were divided by', () => {
        const grid = createDataGrid<Sale>({
            columns: [...columns, { id: 'note' }],
            data: sales.map((sale) => ({ ...sale, note: sale.amount > 100 ? 'big' : 'small' })),
            getRowId: (row) => String(row.id),
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter', 'note'],
                    values: [{ field: 'amount', agg: 'sum', showAs: 'percentOfRow' }],
                    columnSubtotal: (header) => `${header} total`
                })
            ]
        })
        const north = groups(grid)[0]!

        expect(at(grid, north, '__pv:c:Q1::s0')).toBeCloseTo(180 / 330, 6)
        expect(at(grid, north, '__pv:c:Q2::s0')).toBeCloseTo(150 / 330, 6)
    })
})

describe('a share of nothing', () => {
    const cancelling: Sale[] = [
        { id: 1, region: 'North', quarter: 'Q1', amount: 100 },
        { id: 2, region: 'North', quarter: 'Q2', amount: -100 },
        { id: 3, region: 'South', quarter: 'Q1', amount: 50 }
    ]

    function cancelled(showAs: PivotShowAs) {
        return createDataGrid<Sale>({
            columns,
            data: cancelling,
            getRowId: (row) => String(row.id),
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'amount', agg: 'sum', showAs }]
                })
            ]
        })
    }

    it('draws nothing rather than infinity when the rows cancel out', () => {
        const grid = cancelled('percentOfRow')
        const north = groups(grid)[0]!

        expect(at(grid, north, '__pv:c:Q1::0')).toBeUndefined()
        expect(at(grid, north, '__pv:c:Q2::0')).toBeUndefined()
    })

    it('still divides a row that does not cancel', () => {
        const grid = cancelled('percentOfRow')
        const south = groups(grid)[1]!

        expect(at(grid, south, '__pv:c:Q1::0')).toBeCloseTo(1, 6)
    })
})
