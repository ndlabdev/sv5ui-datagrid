import { describe, expect, it, vi } from 'vitest'
import { createDataGrid, type ColumnDef, type GridState, type RowNode } from '$lib/index.js'
import {
    getPivot,
    pivot,
    type PivotMeasure,
    type PivotOptions
} from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    quarter: string
    revenue: number
    profit: number
}

const sales: Sale[] = [
    { id: 1, region: 'North', quarter: 'Q1', revenue: 100, profit: 50 },
    { id: 2, region: 'North', quarter: 'Q1', revenue: 900, profit: 90 },
    { id: 3, region: 'North', quarter: 'Q2', revenue: 200, profit: 20 },
    { id: 4, region: 'South', quarter: 'Q1', revenue: 100, profit: 0 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'quarter' },
    { id: 'revenue', type: 'currency' },
    { id: 'profit', type: 'currency' }
]

function build(values: PivotMeasure<Sale>[], extra: Partial<PivotOptions<Sale>> = {}) {
    return createDataGrid<Sale>({
        columns,
        data: sales,
        getRowId: (row) => String(row.id),
        features: [pivot<Sale>({ rows: ['region'], columns: ['quarter'], values, ...extra })]
    })
}

const groups = (grid: GridState<Sale>): RowNode<Sale>[] =>
    grid.preWindowNodes.filter((node) => node.id.startsWith('group:'))

const at = (grid: GridState<Sale>, node: RowNode<Sale>, id: string) =>
    grid.getValue(node, grid.columns.get(id)!)

const MARGIN: PivotMeasure<Sale> = { field: 'profit', agg: 'sum', per: 'revenue' }

describe('a measure divided by another', () => {
    it('divides the two reductions, not the rows', () => {
        const grid = build([MARGIN])
        const north = groups(grid)[0]!

        expect(at(grid, north, '__pv:c:Q1::0')).toBeCloseTo(140 / 1000, 6)
    })

    it('is not the average of the rows own ratios, which is the trap', () => {
        const grid = build([MARGIN])
        const north = groups(grid)[0]!

        const rowWise = (50 / 100 + 90 / 900) / 2
        expect(at(grid, north, '__pv:c:Q1::0')).not.toBeCloseTo(rowWise, 3)
        expect(rowWise).toBeCloseTo(0.3, 6)
    })

    it('draws nothing rather than an infinity when the divisor comes to nought', () => {
        const grid = build([{ field: 'revenue', agg: 'sum', per: 'profit' }])
        const south = groups(grid)[1]!

        expect(at(grid, south, '__pv:c:Q1::0')).toBeUndefined()
    })

    it('leaves a crossing with no rows empty', () => {
        const grid = build([MARGIN])
        const south = groups(grid)[1]!

        expect(at(grid, south, '__pv:c:Q2::0')).toBeUndefined()
    })

    it('divides a total column and a subtotal the same way', () => {
        const grid = build([MARGIN], { totalColumn: 'Total' })
        const north = groups(grid)[0]!

        expect(at(grid, north, '__pv:t:0')).toBeCloseTo(160 / 1200, 6)
    })

    it('keeps the measured unit off the column, a ratio being neither of them', () => {
        expect(build([MARGIN]).columns.get('__pv:c:Q1::0')!.def.type).toBeUndefined()
        expect(build([{ ...MARGIN, type: 'percent' }]).columns.get('__pv:c:Q1::0')!.def.type).toBe(
            'percent'
        )
    })

    it('lets a plain measure name its own type too', () => {
        const grid = build([{ field: 'profit', agg: 'count', type: 'number' }])

        expect(grid.columns.get('__pv:c:Q1::0')!.def.type).toBe('number')
    })

    it('refuses to run a ratio, ratios not being a thing that adds up', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = build([{ ...MARGIN, showAs: 'runningTotal' }])
        const north = groups(grid)[0]!

        expect(at(grid, north, '__pv:c:Q1::0')).toBeUndefined()
        expect(
            warn.mock.calls.filter((call) => String(call[0]).includes('A ratio does not add up'))
        ).toHaveLength(1)
        warn.mockRestore()
    })

    it('refuses the crossing when the divisor names no column', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = build([{ field: 'profit', agg: 'sum', per: 'nowhere' }])

        expect(grid.columns.visible.some((column) => column.id.startsWith('__pv'))).toBe(false)
        const said = warn.mock.calls.filter((call) => String(call[0]).includes('no column defined'))
        expect(String(said[0]?.[0])).toContain('nowhere')
        warn.mockRestore()
    })

    it('goes into a saved view and comes back whole', () => {
        const source = build([{ ...MARGIN, type: 'percent', header: 'Margin' }])
        const fresh = build([{ field: 'revenue', agg: 'sum' }])

        fresh.api.setState!(source.api.getState!())

        expect(getPivot(fresh)!.values).toEqual([
            { field: 'profit', agg: 'sum', header: 'Margin', per: 'revenue', type: 'percent' }
        ])
    })

    it('drops a divisor the grid no longer has rather than taking it on trust', () => {
        const fresh = build([{ field: 'revenue', agg: 'sum' }])

        fresh.api.setState!({
            version: 1,
            features: {
                pivot: {
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'profit', agg: 'sum', per: 'nowhere' }]
                }
            }
        } as never)

        expect(getPivot(fresh)!.values[0]!.per).toBeUndefined()
    })
})

describe('a ratio meeting the other readings', () => {
    it('takes one margin away from the one before it', () => {
        const grid = build([{ ...MARGIN, showAs: 'differenceFrom' }])
        const north = groups(grid)[0]!

        expect(at(grid, north, '__pv:c:Q1::0')).toBeUndefined()
        expect(at(grid, north, '__pv:c:Q2::0')).toBeCloseTo(20 / 200 - 140 / 1000, 6)
    })

    it('places margins against each other', () => {
        const grid = build([{ ...MARGIN, showAs: 'rankInRow' }])
        const north = groups(grid)[0]!

        expect(at(grid, north, '__pv:c:Q1::0')).toBe(1)
        expect(at(grid, north, '__pv:c:Q2::0')).toBe(2)
    })

    it('reads a margin against the whole row, which can pass one', () => {
        const grid = build([{ ...MARGIN, showAs: 'percentOfRow' }])
        const north = groups(grid)[0]!

        expect(at(grid, north, '__pv:c:Q1::0')).toBeCloseTo(0.14 / (160 / 1200), 6)
    })

    it('lets a named type win over the one a reading would have chosen', () => {
        const typeOf = (measure: PivotMeasure<Sale>) =>
            build([measure]).columns.get('__pv:c:Q1::0')!.def.type

        expect(typeOf({ ...MARGIN, showAs: 'percentOfRow' })).toBe('percent')
        expect(typeOf({ ...MARGIN, showAs: 'percentOfRow', type: 'currency' })).toBe('currency')
        expect(typeOf({ ...MARGIN, showAs: 'rankInRow', type: 'number' })).toBe('number')
    })

    it('refuses a type the snapshot made up rather than writing it onto a column', () => {
        const fresh = build([{ field: 'revenue', agg: 'sum' }])

        fresh.api.setState!({
            version: 1,
            features: {
                pivot: {
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'profit', agg: 'sum', type: 'banana' }]
                }
            }
        } as never)

        expect(getPivot(fresh)!.values[0]!.type).toBeUndefined()
        expect(fresh.columns.get('__pv:c:Q1::0')!.def.type).not.toBe('banana')
    })

    it('takes a type the snapshot got right', () => {
        const fresh = build([{ field: 'revenue', agg: 'sum' }])

        fresh.api.setState!({
            version: 1,
            features: {
                pivot: {
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'profit', agg: 'sum', type: 'percent' }]
                }
            }
        } as never)

        expect(getPivot(fresh)!.values[0]!.type).toBe('percent')
    })
})
