import { describe, expect, it, vi } from 'vitest'
import {
    createDataGrid,
    serverRowModel,
    type ColumnDef,
    type GetRowsRequest,
    type GetRowsResult,
    type GridState
} from '$lib/index.js'
import { isPivotColumn, pivot, type PivotOptions } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    quarter: string
    product: string
    amount: number
    units: number
}

const sales: Sale[] = [
    { id: 1, region: 'North', quarter: 'Q1', product: 'Widget', amount: 100, units: 9 },
    { id: 2, region: 'North', quarter: 'Q2', product: 'Widget', amount: 200, units: 1 },
    { id: 3, region: 'South', quarter: 'Q2', product: 'Gadget', amount: 100, units: 1 },
    { id: 4, region: 'North', quarter: 'Q3', product: 'Gadget', amount: 150, units: 2 },
    { id: 5, region: 'South', quarter: 'Q3', product: 'Widget', amount: 50, units: 2 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'quarter' },
    { id: 'product' },
    { id: 'amount', type: 'number' },
    { id: 'units', type: 'number' }
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

const headers = (grid: GridState<Sale>): string[] =>
    grid.columns.visible
        .filter((column) => isPivotColumn(column.id))
        .map((column) => String(column.def.header))

describe('putting the column axis in the order a measure ranks it', () => {
    it('leaves the keys in their own order when nothing asks otherwise', () => {
        expect(headers(build())).toEqual(['Q1', 'Q2', 'Q3'])
    })

    it('puts the largest first when asked', () => {
        expect(headers(build({ orderColumns: {} }))).toEqual(['Q2', 'Q3', 'Q1'])
    })

    it('puts the smallest first when asked the other way', () => {
        expect(headers(build({ orderColumns: { direction: 'asc' } }))).toEqual(['Q1', 'Q3', 'Q2'])
    })

    it('ranks by the measure it was pointed at, not always the first', () => {
        const grid = build({
            orderColumns: { measure: 1 },
            values: [
                { field: 'amount', agg: 'sum', header: 'Tiền' },
                { field: 'units', agg: 'sum', header: 'Cái' }
            ]
        })

        const keys = grid.columns.visible
            .filter((column) => isPivotColumn(column.id))
            .map((column) => column.id.replace('__pv:c:', '').split('::')[0])

        expect([...new Set(keys)]).toEqual(['Q1', 'Q3', 'Q2'])
    })

    it('ranks every tier among its own siblings, not only the outermost', () => {
        const grid = build({ columns: ['quarter', 'product'], orderColumns: {} })
        const leaves = grid.columns.visible.filter((column) => isPivotColumn(column.id))

        expect(leaves.map((column) => String(column.def.header))).toEqual([
            'Widget',
            'Gadget',
            'Gadget',
            'Widget',
            'Widget'
        ])
    })

    it('lets a declared order outrank a measured one', () => {
        const grid = build({
            orderColumns: {},
            columnKeys: (field) => (field === 'quarter' ? ['Q3', 'Q1', 'Q2'] : undefined)
        })

        expect(headers(grid)).toEqual(['Q3', 'Q1', 'Q2'])
    })

    it('falls back to the order the keys have when nothing can rank them', () => {
        expect(headers(build({ orderColumns: { measure: 9 } }))).toEqual(['Q1', 'Q2', 'Q3'])
    })

    it('carries the readings that follow the drawn order along with it', () => {
        const grid = build({
            orderColumns: {},
            values: [{ field: 'amount', agg: 'sum', showAs: 'runningTotal' }]
        })
        const north = grid.preWindowNodes[0]!
        const cells = grid.columns.visible
            .filter((column) => isPivotColumn(column.id))
            .map((column) => grid.getValue(north, column))

        expect(headers(grid)).toEqual(['Q2', 'Q3', 'Q1'])
        expect(cells).toEqual([200, 350, 450])
    })

    it('carries the order it was given through a snapshot', () => {
        const grid = build({ orderColumns: { direction: 'asc', measure: 0 } })
        const saved = grid.api.getState?.()

        const fresh = build()
        fresh.api.setState?.(saved as never)

        expect(fresh.api.pivotOrderColumns?.()).toEqual({ measure: 0, direction: 'asc' })
        expect(headers(fresh)).toEqual(['Q1', 'Q3', 'Q2'])
    })

    it('keeps the order the server sent, and says why', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const crossed = [
            {
                id: 1,
                region: 'North',
                quarter: '',
                product: '',
                amount: 0,
                units: 0,
                pivot: { Q1: [100], Q2: [200] }
            }
        ]
        const getRows = vi.fn(async (_request: GetRowsRequest): Promise<GetRowsResult<never>> => ({
            rows: crossed as never[],
            rowCount: 1,
            pivotColumns: [['Q1'], ['Q2']]
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
                    orderColumns: {}
                }),
                serverRowModel<Sale>({ getRows: getRows as never }, { mode: 'paged' })
            ]
        })

        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await vi.waitFor(() => expect(getRows.mock.calls.length).toBeGreaterThan(0))
        await vi.waitFor(() => expect(grid.data.length).toBeGreaterThan(0))

        expect(headers(grid)).toEqual(['Q1', 'Q2'])
        expect(
            warn.mock.calls.filter((call) => String(call[0]).includes('keeps the order the server'))
        ).toEqual([expect.anything()])
        warn.mockRestore()
    })
})
