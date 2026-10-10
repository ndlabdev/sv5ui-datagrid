import { describe, expect, it, vi } from 'vitest'
import { createDataGrid, policy, type ColumnDef, type GridState } from '$lib/index.js'
import { getPivot, isPivotColumn, pivot, type PivotOptions } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    quarter: string
    amount: number
}

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'quarter' },
    { id: 'amount', type: 'number' }
]

const crossing: PivotOptions<Sale> = {
    rows: ['region'],
    columns: ['quarter'],
    values: [{ field: 'amount', agg: 'sum' }]
}

function build(data: Sale[], options: Partial<PivotOptions<Sale>> = {}): GridState<Sale> {
    return createDataGrid<Sale>({
        columns,
        data,
        getRowId: (row) => String(row.id),
        features: [pivot<Sale>({ ...crossing, ...options })]
    })
}

const generated = (grid: GridState<Sale>): string[] =>
    grid.columns.visible.filter((column) => isPivotColumn(column.id)).map((column) => column.id)

const topRow = (grid: GridState<Sale>) =>
    grid.preWindowNodes.find((node) => node.meta?.level === 0)!

const valuesOf = (grid: GridState<Sale>): unknown[] =>
    generated(grid).map((id) => grid.getValue(topRow(grid), grid.columns.get(id)!))

describe('a key that looks like the grid own id scheme', () => {
    const forged: Sale[] = [
        { id: 1, region: 'North', quarter: '__pv:t:0', amount: 1 },
        { id: 2, region: 'North', quarter: 'a::s0', amount: 2 },
        { id: 3, region: 'North', quarter: '__proto__', amount: 8 }
    ]

    it('is encoded as a key rather than taken for a total or a subtotal', () => {
        const grid = build(forged, { totalColumn: 'All' })

        expect(generated(grid)).toEqual([
            '__pv:c:__proto__::0',
            '__pv:c:__pv:t:0::0',
            '__pv:c:a::s0::0',
            '__pv:t:0'
        ])
    })

    it('measures each forged key from its own row, and the total from all of them', () => {
        expect(valuesOf(build(forged, { totalColumn: 'All' }))).toEqual([8, 1, 2, 11])
    })

    it('leaves the object prototype alone when a key is named after it', () => {
        build(forged)

        expect(({} as Record<string, unknown>).amount).toBeUndefined()
        expect(Object.prototype.hasOwnProperty.call({}, '__pv:c:__proto__::0')).toBe(false)
    })
})

describe('a saved view that names a reduction the grid does not have', () => {
    const slice = (agg: unknown): unknown => ({
        version: 1,
        features: {
            pivot: {
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg }]
            }
        }
    })

    const rows: Sale[] = [
        { id: 1, region: 'North', quarter: 'Q1', amount: 10 },
        { id: 2, region: 'North', quarter: 'Q1', amount: 90 }
    ]

    it('drops the measure rather than drawing a column of nothing', () => {
        const grid = build(rows)
        grid.api.setState!(slice('constructor') as never)

        expect(getPivot(grid)!.values.map((measure) => measure.agg)).toEqual(['sum'])
    })

    it('takes a reduction it does have', () => {
        const grid = build(rows)
        grid.api.setState!(slice('avg') as never)

        expect(getPivot(grid)!.values.map((measure) => measure.agg)).toEqual(['avg'])
        expect(valuesOf(grid)).toEqual([50])
    })
})

describe('a masked column read through a crossing', () => {
    const masked = (): GridState<Sale> =>
        createDataGrid<Sale>({
            columns,
            data: [
                { id: 1, region: 'North', quarter: 'Q1', amount: 100 },
                { id: 2, region: 'North', quarter: 'Q2', amount: 900 }
            ],
            getRowId: (row) => String(row.id),
            features: [
                policy<Sale>({ rules: [{ columns: ['amount'], mask: 'hide' }] }),
                pivot<Sale>(crossing)
            ]
        })

    it('measures nothing, rather than letting the real number out in a total', () => {
        const grid = masked()

        expect(valuesOf(grid)).toEqual([null, null])
    })

    it('says so when the drill-down hands back rows the gate never touched', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = masked()
        const behind = getPivot(grid)!.rowsBehind(topRow(grid), generated(grid)[0]!)

        expect(behind).toHaveLength(1)
        expect(
            warn.mock.calls.filter((call) => String(call[0]).includes('rowsBehind'))
        ).toHaveLength(1)
        warn.mockRestore()
    })

    it('stays quiet on a grid nothing masks', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = build([{ id: 1, region: 'North', quarter: 'Q1', amount: 10 }])
        getPivot(grid)!.rowsBehind(topRow(grid), generated(grid)[0]!)

        expect(
            warn.mock.calls.filter((call) => String(call[0]).includes('rowsBehind'))
        ).toHaveLength(0)
        warn.mockRestore()
    })
})
