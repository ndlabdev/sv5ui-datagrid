import { describe, expect, it, vi } from 'vitest'
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
    { id: 2, region: 'North', quarter: 'Q2', amount: 50 },
    { id: 3, region: 'North', quarter: 'Q3', amount: 150 },
    { id: 4, region: 'South', quarter: 'Q1', amount: 200 },
    { id: 5, region: 'South', quarter: 'Q3', amount: 40 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'quarter' },
    { id: 'amount', type: 'currency' }
]

function build(showAs: PivotShowAs, extra: Partial<PivotOptions<Sale>> = {}) {
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
    grid.preWindowNodes.filter((node) => node.meta?.expandable)

const across = (grid: GridState<Sale>, node: RowNode<Sale>) =>
    ['Q1', 'Q2', 'Q3'].map((key) => grid.getValue(node, grid.columns.get(`__pv:c:${key}::0`)!))

describe('a measure read along its row', () => {
    it('runs a total up to and including each crossing', () => {
        const grid = build('runningTotal')
        const [north, south] = groups(grid)

        expect(across(grid, north!)).toEqual([100, 150, 300])
        expect(across(grid, south!)).toEqual([200, 200, 240])
    })

    it('leaves the run empty where the reduction cannot be run', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'amount', agg: 'avg', showAs: 'runningTotal' }]
                })
            ]
        })

        expect(across(grid, groups(grid)[0]!)).toEqual([undefined, undefined, undefined])
        expect(
            warn.mock.calls.filter((call) => String(call[0]).includes('runs only a sum'))
        ).toHaveLength(1)
        warn.mockRestore()
    })

    it('runs a count, which adds up the same way a sum does', () => {
        const grid = build('runningTotal', {
            values: [{ field: 'amount', agg: 'count', showAs: 'runningTotal' }]
        })

        expect(across(grid, groups(grid)[0]!)).toEqual([1, 2, 3])
    })

    it('takes the crossing before it away', () => {
        const grid = build('differenceFrom')
        const [north, south] = groups(grid)

        expect(across(grid, north!)).toEqual([undefined, -50, 100])
        expect(across(grid, south!)).toEqual([undefined, undefined, undefined])
    })

    it('reads that change as a share of what came before', () => {
        const grid = build('percentDifferenceFrom')
        const north = groups(grid)[0]!

        expect(across(grid, north!)).toEqual([undefined, -0.5, 2])
    })

    it('places each crossing among the others on its row, one being the largest', () => {
        const grid = build('rankInRow')
        const [north, south] = groups(grid)

        expect(across(grid, north!)).toEqual([2, 3, 1])
        expect(across(grid, south!)).toEqual([1, undefined, 2])
    })

    it('leaves a subtotal and a total column out of the run', () => {
        const grid = build('runningTotal', {
            columns: ['quarter', 'region'],
            columnSubtotal: (header) => `${header} total`,
            totalColumn: 'Total'
        })
        const north = groups(grid)[0]!

        expect(grid.getValue(north, grid.columns.get('__pv:c:Q1::s0')!)).toBeUndefined()
        expect(grid.getValue(north, grid.columns.get('__pv:t:0')!)).toBeUndefined()
    })

    it('types the column by what the reading means, not by what it measured', () => {
        const typeOf = (showAs: PivotShowAs) => build(showAs).columns.get('__pv:c:Q1::0')!.def.type

        expect(typeOf('runningTotal')).toBe('currency')
        expect(typeOf('differenceFrom')).toBe('currency')
        expect(typeOf('percentDifferenceFrom')).toBe('percent')
        expect(typeOf('rankInRow')).toBeUndefined()
    })

    it('follows the order the crossing is drawn in, not the order rows arrived', () => {
        const shuffled = [...sales].reverse()
        const grid = createDataGrid<Sale>({
            columns,
            data: shuffled,
            getRowId: (row) => String(row.id),
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'amount', agg: 'sum', showAs: 'runningTotal' }]
                })
            ]
        })

        const north = groups(grid).find(
            (node) => grid.getValue(node, grid.columns.get('region')!) === 'North'
        )!

        expect(across(grid, north)).toEqual([100, 150, 300])
    })
})

describe('a change measured against nothing', () => {
    const cancelling: Sale[] = [
        { id: 1, region: 'North', quarter: 'Q1', amount: 40 },
        { id: 2, region: 'North', quarter: 'Q1', amount: -40 },
        { id: 3, region: 'North', quarter: 'Q2', amount: 50 },
        { id: 4, region: 'North', quarter: 'Q3', amount: 75 }
    ]

    function zeroed(showAs: PivotShowAs) {
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

    it('draws nothing rather than an infinity when the crossing before came to nought', () => {
        const grid = zeroed('percentDifferenceFrom')

        expect(across(grid, groups(grid)[0]!)).toEqual([undefined, undefined, 0.5])
    })

    it('still takes it away, nought being a number one can subtract', () => {
        const grid = zeroed('differenceFrom')

        expect(across(grid, groups(grid)[0]!)).toEqual([undefined, 50, 25])
    })
})

describe('a reading along the row, in the shapes it has to hold up in', () => {
    it('gives two crossings that tie the same place, and skips the one after', () => {
        const grid = createDataGrid<Sale>({
            columns,
            data: [
                { id: 1, region: 'North', quarter: 'Q1', amount: 100 },
                { id: 2, region: 'North', quarter: 'Q2', amount: 100 },
                { id: 3, region: 'North', quarter: 'Q3', amount: 50 }
            ],
            getRowId: (row) => String(row.id),
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'amount', agg: 'sum', showAs: 'rankInRow' }]
                })
            ]
        })

        expect(across(grid, groups(grid)[0]!)).toEqual([1, 1, 3])
    })

    it('runs one measure and leaves the other as it was measured', () => {
        const grid = build('runningTotal', {
            values: [
                { field: 'amount', agg: 'sum' },
                { field: 'amount', agg: 'sum', showAs: 'runningTotal' }
            ]
        })
        const node = groups(grid)[0]!
        const at = (id: string) => grid.getValue(node, grid.columns.get(id)!)

        expect([at('__pv:c:Q1::0'), at('__pv:c:Q2::0'), at('__pv:c:Q3::0')]).toEqual([100, 50, 150])
        expect([at('__pv:c:Q1::1'), at('__pv:c:Q2::1'), at('__pv:c:Q3::1')]).toEqual([
            100, 150, 300
        ])
    })

    it('runs across a nested axis in the order the leaves are drawn', () => {
        const grid = createDataGrid<Sale>({
            columns: [...columns, { id: 'product' }],
            data: sales.map((sale) => ({ ...sale, product: sale.id % 2 === 0 ? 'B' : 'A' })),
            getRowId: (row) => String(row.id),
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter', 'product'],
                    values: [{ field: 'amount', agg: 'sum', showAs: 'runningTotal' }]
                })
            ]
        })
        const node = groups(grid)[0]!

        const drawn = grid.columns.visible
            .filter((column) => column.id.startsWith('__pv'))
            .map((column) => grid.getValue(node, column))

        expect(drawn).toEqual([100, 100, 150, 300])
    })

    it('runs in the order the application declared, not the one the values have', () => {
        const grid = build('runningTotal', {
            columnKeys: (field) => (field === 'quarter' ? ['Q3', 'Q1', 'Q2'] : undefined)
        })
        const node = groups(grid)[0]!

        const drawn = grid.columns.visible
            .filter((column) => column.id.startsWith('__pv'))
            .map((column) => grid.getValue(node, column))

        expect(drawn).toEqual([150, 250, 300])
    })

    it('measures each crossing once, the reading costing no extra read', () => {
        let reads = 0
        const counted: ColumnDef<Sale>[] = [
            { id: 'region' },
            { id: 'quarter' },
            {
                id: 'amount',
                type: 'currency',
                accessor: (row) => {
                    reads++
                    return row.amount
                }
            }
        ]

        const count = (showAs?: PivotShowAs) => {
            reads = 0
            const grid = createDataGrid<Sale>({
                columns: counted,
                data: sales,
                getRowId: (row) => String(row.id),
                features: [
                    pivot<Sale>({
                        rows: ['region'],
                        columns: ['quarter'],
                        values: [{ field: 'amount', agg: 'sum', showAs }]
                    })
                ]
            })
            void grid.preWindowNodes
            return reads
        }

        expect(count('runningTotal')).toBe(count(undefined))
    })
})
