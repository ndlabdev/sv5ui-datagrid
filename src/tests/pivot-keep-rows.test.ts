import { describe, expect, it, vi } from 'vitest'
import {
    createDataGrid,
    serverRowModel,
    type ColumnDef,
    type GetRowsRequest,
    type GetRowsResult,
    type GridState
} from '$lib/index.js'
import { getPivot, isPivotColumn, pivot, type PivotOptions } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    product: string
    quarter: string
    amount: number
}

const sales: Sale[] = [
    { id: 1, region: 'North', product: 'Widget', quarter: 'Q1', amount: 100 },
    { id: 2, region: 'North', product: 'Gadget', quarter: 'Q2', amount: 80 },
    { id: 3, region: 'South', product: 'Widget', quarter: 'Q1', amount: 300 },
    { id: 4, region: 'East', product: 'Widget', quarter: 'Q1', amount: 50 },
    { id: 5, region: 'West', product: 'Gadget', quarter: 'Q2', amount: 20 },
    { id: 6, region: 'Mid', product: 'Widget', quarter: 'Q2', amount: 200 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'product' },
    { id: 'quarter' },
    { id: 'amount', type: 'number' }
]

const build = (options: Partial<PivotOptions<Sale>> = {}) =>
    createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: (sale) => String(sale.id),
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }],
                ...options
            })
        ]
    })

const labels = (grid: GridState<Sale>, field = 'region'): string[] => {
    const column = grid.columns.visible.find((candidate) => candidate.id === field)!
    return grid.preWindowNodes.map((node) => String(grid.getValue(node, column) ?? ''))
}

const across = (grid: GridState<Sale>, at: number): number => {
    const node = grid.preWindowNodes[at]!
    return grid.columns.visible
        .filter((column) => isPivotColumn(column.id))
        .reduce((total, column) => total + Number(grid.getValue(node, column) ?? 0), 0)
}

describe('keeping only some of the gathered rows', () => {
    it('keeps the largest, ranked by what the measure makes of each row', () => {
        expect(labels(build())).toEqual(['North', 'South', 'East', 'West', 'Mid'])
        expect(labels(build({ keepRows: { top: 2 } }))).toEqual(['South', 'Mid'])
    })

    it('ranks from the rows, with no total column asked for anywhere', () => {
        const grid = build({ keepRows: { top: 3 } })

        expect(labels(grid)).toEqual(['South', 'Mid', 'North'])
        expect(across(grid, 0)).toBe(300)
        expect(across(grid, 2)).toBe(180)
    })

    it('keeps the smallest when asked from the other end', () => {
        expect(labels(build({ keepRows: { bottom: 2 } }))).toEqual(['West', 'East'])
    })

    it('measures the total row over what is left, not over what was dropped', () => {
        const whole = build({ totalRow: 'Tất cả' })
        const cut = build({ keepRows: { top: 2 }, totalRow: 'Tất cả' })

        expect(across(whole, whole.preWindowNodes.length - 1)).toBe(750)
        expect(across(cut, cut.preWindowNodes.length - 1)).toBe(500)
    })

    it('gathers the rest into one row measured from those rows, and the total adds up again', () => {
        const grid = build({ keepRows: { top: 2, others: 'Khác' }, totalRow: 'Tất cả' })

        expect(labels(grid)).toEqual(['South', 'Mid', 'Khác', 'Tất cả'])
        expect(across(grid, 2)).toBe(250)
        expect(across(grid, 3)).toBe(750)
    })

    it('measures a share over what is shown', () => {
        const grid = build({
            keepRows: { top: 2 },
            values: [{ field: 'amount', agg: 'sum', showAs: 'percentOfTotal' }]
        })

        expect(across(grid, 0) + across(grid, 1)).toBeCloseTo(1, 10)
    })

    it('cuts the outermost row field and leaves every field under it whole', () => {
        const grid = build({ rows: ['region', 'product'], keepRows: { top: 2 } })

        expect(labels(grid)).toEqual(['South', 'Mid'])

        grid.expansion.setExpanded(grid.preWindowNodes.map((node) => node.id))
        expect(labels(grid, 'product')).toEqual(['', 'Widget', '', 'Widget'])
    })

    it('hands back the rows behind the row that gathered the rest', () => {
        const grid = build({ keepRows: { top: 2, others: 'Khác' } })
        const others = grid.preWindowNodes[2]!
        const leaf = grid.columns.visible.find((column) => isPivotColumn(column.id))!

        const behind = getPivot(grid)!.rowsBehind(others, leaf.id)
        expect(behind.map((row) => row.region).sort()).toEqual(['East', 'North'])
    })

    it('leaves the rows alone when there are no more of them than asked for', () => {
        expect(labels(build({ keepRows: { top: 9 } }))).toHaveLength(5)
        expect(labels(build({ keepRows: { top: 0 } }))).toHaveLength(5)
    })

    it('carries what it keeps through a snapshot', () => {
        const grid = build({ keepRows: { top: 2, others: 'Khác' } })
        const saved = grid.api.getState?.()

        const fresh = build()
        fresh.api.setState?.(saved as never)

        expect(fresh.api.pivotKeepRows?.()).toEqual({ top: 2, others: 'Khác' })
        expect(labels(fresh)).toEqual(['South', 'Mid', 'Khác'])
    })
})

describe('what it says when it cannot rank', () => {
    it('says so once when the ranking measure is not one of the measures', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = build({ keepRows: { top: 2, measure: 9 } })

        expect(grid.preWindowNodes).toHaveLength(2)
        expect(
            warn.mock.calls.filter((call) => String(call[0]).includes('keepRows ranks by'))
        ).toEqual([expect.anything()])
        warn.mockRestore()
    })

    it('takes the rows in the order the data listed them when two rows tie', () => {
        const tied: Sale[] = [
            { id: 1, region: 'A', product: 'Widget', quarter: 'Q1', amount: 300 },
            { id: 2, region: 'B', product: 'Widget', quarter: 'Q1', amount: 100 },
            { id: 3, region: 'C', product: 'Widget', quarter: 'Q1', amount: 100 }
        ]
        const grid = createDataGrid<Sale>({
            data: tied,
            columns,
            getRowId: (sale) => String(sale.id),
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'amount', agg: 'sum' }],
                    keepRows: { top: 2 }
                })
            ]
        })

        expect(labels(grid)).toEqual(['A', 'B'])
    })

    it('keeps every row the server sent, and says why', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const crossed = [
            { id: 1, region: 'A', quarter: '', amount: 0, pivot: { Q1: [300] } },
            { id: 2, region: 'B', quarter: '', amount: 0, pivot: { Q1: [200] } },
            { id: 3, region: 'C', quarter: '', amount: 0, pivot: { Q1: [100] } }
        ]
        const getRows = vi.fn(async (_request: GetRowsRequest): Promise<GetRowsResult<never>> => ({
            rows: crossed as never[],
            rowCount: 3,
            pivotColumns: [['Q1']]
        }))

        const grid = createDataGrid<Sale>({
            data: [],
            columns,
            getRowId: (sale) => String(sale.id),
            rowModel: 'server',
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'amount', agg: 'sum' }],
                    keepRows: { top: 2 }
                }),
                serverRowModel<Sale>({ getRows: getRows as never }, { mode: 'paged' })
            ]
        })

        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await vi.waitFor(() => expect(getRows.mock.calls.length).toBeGreaterThan(0))
        await vi.waitFor(() => expect(grid.data.length).toBeGreaterThan(0))

        expect(grid.preWindowNodes).toHaveLength(3)
        expect(
            warn.mock.calls.filter((call) =>
                String(call[0]).includes('keeps every row it is given')
            )
        ).toEqual([expect.anything()])
        warn.mockRestore()
    })
})
