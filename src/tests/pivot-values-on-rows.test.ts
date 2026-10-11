import { describe, expect, it, vi } from 'vitest'
import {
    createDataGrid,
    sorting,
    type ColumnDef,
    type GridState,
    type RowNode
} from '$lib/index.js'
import { getPivot, isPivotColumn, pivot, type PivotOptions } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    quarter: string
    amount: number
    units: number
}

const sales: Sale[] = [
    { id: 1, region: 'North', quarter: 'Q1', amount: 100, units: 4 },
    { id: 2, region: 'North', quarter: 'Q1', amount: 80, units: 2 },
    { id: 3, region: 'North', quarter: 'Q2', amount: 150, units: 5 },
    { id: 4, region: 'South', quarter: 'Q1', amount: 200, units: 10 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'quarter' },
    { id: 'amount', type: 'number' },
    { id: 'units', type: 'number' }
]

const twoMeasures: PivotOptions<Sale>['values'] = [
    { field: 'amount', agg: 'sum' },
    { field: 'amount', agg: 'avg', header: 'Average' }
]

function build(options: Partial<PivotOptions<Sale>> = {}, extra: Record<string, unknown> = {}) {
    return createDataGrid<Sale>({
        columns,
        data: sales,
        getRowId: (row) => String(row.id),
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: twoMeasures,
                valuesOn: 'rows',
                ...options
            })
        ],
        ...extra
    })
}

const ids = (grid: GridState<Sale>): string[] => grid.columns.visible.map((column) => column.id)

const crossings = (grid: GridState<Sale>, node: RowNode<Sale>): unknown[] =>
    grid.columns.visible
        .filter((column) => isPivotColumn(column.id) && column.id !== '__pv:m')
        .map((column) => grid.getValue(node, column))

const shape = (grid: GridState<Sale>): string[] =>
    grid.preWindowNodes.map((node) => {
        const label = grid.columns.visible.find(
            (column) => column.id === (node.id.startsWith('group:') ? 'region' : '__pv:m')
        )!
        return `${node.meta?.level}:${String(grid.getValue(node, label))}`
    })

describe('a pivot with its measures on the row axis', () => {
    it('stops the column axis multiplying by the measures', () => {
        expect(ids(build())).toEqual(['region', '__pv:m', '__pv:c:Q1::0', '__pv:c:Q2::0'])
        expect(ids(build({ valuesOn: 'columns' }))).toEqual([
            'region',
            '__pv:c:Q1::0',
            '__pv:c:Q1::1',
            '__pv:c:Q2::0',
            '__pv:c:Q2::1'
        ])
    })

    it('opens each group into one row per measure, named in a column of its own', () => {
        expect(shape(build())).toEqual([
            '0:North',
            '1:amount',
            '1:Average',
            '0:South',
            '1:amount',
            '1:Average'
        ])
    })

    it('measures each opened row with its own reduction', () => {
        const grid = build()
        const rows = grid.preWindowNodes

        expect(crossings(grid, rows[1]!)).toEqual([180, 150])
        expect(crossings(grid, rows[2]!)).toEqual([90, 150])
        expect(crossings(grid, rows[4]!)).toEqual([200, undefined])
    })

    it('leaves the group row itself holding no crossing of its own', () => {
        const grid = build()

        expect(crossings(grid, grid.preWindowNodes[0]!)).toEqual([undefined, undefined])
    })

    it('gives every opened row an id of its own, hung off the group it opened', () => {
        const all = build().preWindowNodes.map((node) => node.id)
        const head = all[0]!

        expect(all).toHaveLength(6)
        expect(new Set(all).size).toBe(all.length)
        expect(all.slice(1, 3)).toEqual([`m0:${head}`, `m1:${head}`])
    })

    it('always shows the measures, a gathered row having nothing to open', () => {
        const grid = build()
        const group = grid.preWindowNodes[0]!
        const before = shape(grid)

        expect(group.meta?.expandable).toBe(false)

        grid.expansion.toggle(group.id)

        expect(shape(grid)).toEqual(before)
        expect(before.slice(0, 3)).toEqual(['0:North', '1:amount', '1:Average'])
    })

    it('reads the total column and the total row once per measure', () => {
        const grid = build({ totalColumn: 'Total', totalRow: 'All' })
        const rows = grid.preWindowNodes
        const last = rows.slice(-3)

        expect(ids(grid)).toContain('__pv:t:0')
        expect(crossings(grid, rows[1]!).at(-1)).toBe(330)
        expect(crossings(grid, rows[2]!).at(-1)).toBe(110)
        expect(crossings(grid, last[1]!).at(-1)).toBe(530)
        expect(crossings(grid, last[2]!).at(-1)).toBe(132.5)
    })
})

describe('what follows from a column no longer naming a measure', () => {
    it('sorts the groups by the first measure and says so once', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            features: [
                sorting(),
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: twoMeasures,
                    valuesOn: 'rows',
                    sortableColumns: true
                })
            ]
        })

        grid.api.setSort?.([{ columnId: '__pv:c:Q1::0', direction: 'asc' }])
        expect(shape(grid).slice(0, 4)).toEqual(['0:North', '1:amount', '1:Average', '0:South'])

        grid.api.setSort?.([{ columnId: '__pv:c:Q1::0', direction: 'desc' }])
        expect(shape(grid).slice(0, 4)).toEqual(['0:South', '1:amount', '1:Average', '0:North'])

        expect(warn.mock.calls.filter((call) => String(call[0]).includes('first measure'))).toEqual(
            [expect.anything()]
        )
        warn.mockRestore()
    })

    it('reaches the same order whichever axis the measures sit on', () => {
        const spread: Sale[] = [
            { id: 1, region: 'North', quarter: 'Q1', amount: 100, units: 1 },
            { id: 2, region: 'South', quarter: 'Q1', amount: 500, units: 1 },
            { id: 3, region: 'East', quarter: 'Q1', amount: 300, units: 1 }
        ]
        const one = (where: 'columns' | 'rows') => {
            const grid = createDataGrid<Sale>({
                columns,
                data: spread,
                getRowId: (row) => String(row.id),
                features: [
                    sorting(),
                    pivot<Sale>({
                        rows: ['region'],
                        columns: ['quarter'],
                        values: [{ field: 'amount', agg: 'sum' }],
                        valuesOn: where,
                        sortableColumns: true
                    })
                ]
            })
            grid.api.setSort?.([{ columnId: '__pv:c:Q1::0', direction: 'asc' }])
            const region = grid.columns.visible.find((column) => column.id === 'region')!
            return grid.preWindowNodes
                .filter((node) => node.id.startsWith('group:'))
                .map((node) => grid.getValue(node, region))
        }

        expect(one('columns')).toEqual(['North', 'East', 'South'])
        expect(one('rows')).toEqual(one('columns'))
    })

    it('drops the column type when the measures do not agree on one', () => {
        const typed = build({ values: [{ field: 'amount', agg: 'sum', type: 'currency' }] })
        const mixed = build({
            values: [
                { field: 'amount', agg: 'sum', type: 'currency' },
                { field: 'units', agg: 'sum', type: 'number' }
            ]
        })
        const typeOf = (grid: GridState<Sale>) =>
            grid.columns.visible.find((column) => column.id === '__pv:c:Q1::0')!.def.type

        expect(typeOf(typed)).toBe('currency')
        expect(typeOf(mixed)).toBeUndefined()
    })

    it('keeps a group apart from an opened row when the data reads like one', () => {
        const awkward: Sale[] = [
            { id: 1, region: 'North::v0', quarter: 'Q1', amount: 10, units: 1 },
            { id: 2, region: 'North', quarter: 'Q1', amount: 20, units: 2 }
        ]
        const grid = createDataGrid<Sale>({
            columns,
            data: awkward,
            getRowId: (row) => String(row.id),
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: twoMeasures,
                    valuesOn: 'rows'
                })
            ]
        })
        const all = grid.preWindowNodes.map((node) => node.id)
        const state = getPivot(grid)!
        const opened = grid.preWindowNodes.filter((node) => !node.id.startsWith('group:'))

        expect(new Set(all).size).toBe(all.length)
        for (const node of opened) {
            expect(state.rowsBehind(node, '__pv:c:Q1::0')).not.toEqual([])
        }
    })

    it('drops the column type when the measures agree on it but not on how it reads', () => {
        const priced: ColumnDef<Sale>[] = [
            { id: 'region' },
            { id: 'quarter' },
            { id: 'amount', type: 'currency', typeOptions: { currency: 'USD' } },
            { id: 'units', type: 'currency', typeOptions: { currency: 'EUR' } }
        ]
        const grid = createDataGrid<Sale>({
            columns: priced,
            data: sales,
            getRowId: (row) => String(row.id),
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [
                        { field: 'amount', agg: 'sum' },
                        { field: 'units', agg: 'sum' }
                    ],
                    valuesOn: 'rows'
                })
            ]
        })
        const leaf = grid.columns.visible.find((column) => column.id === '__pv:c:Q1::0')!

        expect(leaf.def.type).toBeUndefined()
        expect(leaf.def.typeOptions).toBeUndefined()
    })

    it('answers the rows behind a cell from an opened row', () => {
        const grid = build()
        const state = getPivot(grid)!
        const behind = state.rowsBehind(grid.preWindowNodes[2]!, '__pv:c:Q1::0')

        expect(behind.map((row) => row.id)).toEqual([1, 2])
    })

    it('counts one leaf per crossing against maxColumns', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const tight = build({ maxColumns: 2 })
        const overflowed = build({ maxColumns: 2, valuesOn: 'columns' })

        expect(ids(tight)).toContain('__pv:c:Q1::0')
        expect(ids(overflowed)).toEqual(['region', 'quarter', 'amount', 'units'])
        warn.mockRestore()
    })

    it('carries the axis the measures sit on through a snapshot', () => {
        const grid = build()
        const saved = grid.getState()

        const fresh = build({ valuesOn: 'columns' })
        fresh.setState(saved)

        expect(ids(fresh)).toEqual(['region', '__pv:m', '__pv:c:Q1::0', '__pv:c:Q2::0'])
    })
})
