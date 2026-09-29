import { describe, expect, it, vi } from 'vitest'
import {
    createDataGrid,
    getSorting,
    serverRowModel,
    sorting,
    type ColumnDef,
    type GetRowsRequest,
    type GetRowsResult,
    type GridState
} from '$lib/index.js'
import { getPivot, isPivotColumn, pivot, type PivotOptions } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    quarter: string
    amount: number
    pivot?: Record<string, unknown>
    pivotTotal?: unknown[]
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

const crossed: Sale[] = [
    { id: 1, region: 'North', quarter: '', amount: 0, pivot: { Q1: [180], Q2: [150] } },
    { id: 2, region: 'South', quarter: '', amount: 0, pivot: { Q1: [200] } }
]

function serverGrid(
    answer: GetRowsResult<Sale>,
    options: Partial<PivotOptions<Sale>> = {},
    withModel = true
) {
    const seen: GetRowsRequest[] = []
    const getRows = vi.fn(async (request: GetRowsRequest) => {
        seen.push(request)
        return answer
    })

    const grid: GridState<Sale> = createDataGrid<Sale>({
        columns,
        data: [],
        getRowId: (row) => String(row.id),
        rowModel: 'server',
        features: [
            sorting(),
            pivot<Sale>({ ...crossing, ...options }),
            ...(withModel ? [serverRowModel<Sale>({ getRows }, { mode: 'paged' })] : [])
        ]
    })
    return { grid, seen, getRows }
}

const load = async (grid: GridState<Sale>, getRows: { mock: { calls: unknown[] } }) => {
    grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
    await vi.waitFor(() => expect(getRows.mock.calls.length).toBeGreaterThan(0))
    await vi.waitFor(() => expect(grid.data.length).toBeGreaterThan(0))
}

const columnIds = (grid: GridState<Sale>): string[] => grid.columns.visible.map((c) => c.id)

describe('the crossing goes out on the request', () => {
    it('carries the fields and the named reductions', async () => {
        const { grid, seen, getRows } = serverGrid({ rows: crossed, rowCount: 2 })
        await load(grid, getRows)

        expect(seen[0]!.pivot).toEqual({
            rows: ['region'],
            columns: ['quarter'],
            values: [{ field: 'amount', agg: 'sum' }]
        })
    })

    it('carries every row field and column field, outermost first', async () => {
        const { grid, seen, getRows } = serverGrid(
            { rows: crossed },
            {
                rows: ['region', 'quarter'],
                columns: ['quarter', 'region']
            }
        )
        await load(grid, getRows)

        expect(seen[0]!.pivot!.rows).toEqual(['region', 'quarter'])
        expect(seen[0]!.pivot!.columns).toEqual(['quarter', 'region'])
    })

    it('sends no crossing at all rather than one missing a measure', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { grid, seen, getRows } = serverGrid(
            { rows: crossed },
            {
                values: [
                    { field: 'amount', agg: 'sum' },
                    { field: 'amount', agg: (values) => values.length }
                ]
            }
        )
        await load(grid, getRows)

        expect(seen[0]!.pivot).toBeUndefined()
        expect(
            warn.mock.calls.filter((call) => String(call[0]).includes('only the named ones'))
        ).toHaveLength(1)
        warn.mockRestore()
    })

    it('sends nothing when pivot is not registered', async () => {
        const seen: GetRowsRequest[] = []
        const getRows = vi.fn(async (request: GetRowsRequest) => {
            seen.push(request)
            return { rows: [] as Sale[], rowCount: 0 }
        })
        const grid = createDataGrid<Sale>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [serverRowModel<Sale>({ getRows }, { mode: 'paged' })]
        })
        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await vi.waitFor(() => expect(getRows.mock.calls.length).toBeGreaterThan(0))

        expect(seen[0]!.pivot).toBeUndefined()
    })
})

describe('the column axis comes back from the server', () => {
    it('draws the keys the server named, not keys read from the data', async () => {
        const { grid, getRows } = serverGrid({
            rows: crossed,
            rowCount: 2,
            pivotColumns: [['Q1'], ['Q2'], ['Q3']]
        })
        await load(grid, getRows)

        expect(columnIds(grid).filter(isPivotColumn)).toEqual([
            '__pv:c:Q1::0',
            '__pv:c:Q2::0',
            '__pv:c:Q3::0'
        ])
    })

    it('reads each cell out of the row the server sent', async () => {
        const { grid, getRows } = serverGrid({
            rows: crossed,
            rowCount: 2,
            pivotColumns: [['Q1'], ['Q2']]
        })
        await load(grid, getRows)

        const north = grid.preWindowNodes[0]!
        const south = grid.preWindowNodes[1]!
        const at = (node: typeof north, id: string) => grid.getValue(node, grid.columns.get(id)!)

        expect(at(north, '__pv:c:Q1::0')).toBe(180)
        expect(at(north, '__pv:c:Q2::0')).toBe(150)
        expect(at(south, '__pv:c:Q1::0')).toBe(200)
        expect(at(south, '__pv:c:Q2::0')).toBeUndefined()
    })

    it('nests the keys the server sent as header groups', async () => {
        const { grid, getRows } = serverGrid(
            {
                rows: [
                    { id: 1, region: 'North', quarter: '', amount: 0, pivot: { Q1: { W: [10] } } }
                ],
                pivotColumns: [
                    ['Q1', 'W'],
                    ['Q1', 'G']
                ]
            },
            { columns: ['quarter', 'product'] }
        )
        await load(grid, getRows)

        const shaped = grid.columns.shaped.filter((def) => isPivotColumn(def.id))
        expect(shaped.map((def) => def.header)).toEqual(['Q1'])
        expect(shaped[0]!.children?.map((child) => child.header)).toEqual(['W', 'G'])
        expect(grid.getValue(grid.preWindowNodes[0]!, grid.columns.get('__pv:c:Q1|W::0')!)).toBe(10)
    })

    it('reads a total column out of its own property', async () => {
        const { grid, getRows } = serverGrid(
            {
                rows: [
                    {
                        id: 1,
                        region: 'North',
                        quarter: '',
                        amount: 0,
                        pivot: { Q1: [180] },
                        pivotTotal: [330]
                    }
                ],
                pivotColumns: [['Q1']]
            },
            { totalColumn: 'Total' }
        )
        await load(grid, getRows)

        expect(grid.getValue(grid.preWindowNodes[0]!, grid.columns.get('__pv:t:0')!)).toBe(330)
    })

    it('does not rebuild the axis when a later block answers the same keys', async () => {
        const getRows = vi.fn(async () => ({
            rows: crossed,
            rowCount: 2,
            pivotColumns: [['Q1'], ['Q2']]
        }))
        const grid = createDataGrid<Sale>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [pivot<Sale>(crossing), serverRowModel<Sale>({ getRows }, { mode: 'paged' })]
        })
        await load(grid, getRows)

        const first = getPivot(grid)!.serverColumns

        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await vi.waitFor(() => expect(getRows.mock.calls.length).toBeGreaterThan(1))

        expect(getPivot(grid)!.serverColumns).toBe(first)
    })

    it('rebuilds the axis when the server answers different keys', async () => {
        let answer = [['Q1']]
        const getRows = vi.fn(async () => ({
            rows: crossed,
            rowCount: 2,
            pivotColumns: answer
        }))
        const grid = createDataGrid<Sale>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [pivot<Sale>(crossing), serverRowModel<Sale>({ getRows }, { mode: 'paged' })]
        })
        await load(grid, getRows)
        expect(columnIds(grid).filter(isPivotColumn)).toEqual(['__pv:c:Q1::0'])

        answer = [['Q1'], ['Q2']]
        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await vi.waitFor(() =>
            expect(columnIds(grid).filter(isPivotColumn)).toEqual(['__pv:c:Q1::0', '__pv:c:Q2::0'])
        )
    })

    it('draws no crossing until the server has answered one', () => {
        const { grid } = serverGrid({ rows: crossed })

        expect(columnIds(grid).some(isPivotColumn)).toBe(false)
        expect(columnIds(grid)).toEqual(['region'])
    })
})

describe('the client never crosses a server grid for itself', () => {
    it('gathers no rows even once the data has arrived', async () => {
        const { grid, getRows } = serverGrid({
            rows: crossed,
            rowCount: 2,
            pivotColumns: [['Q1'], ['Q2']]
        })
        await load(grid, getRows)

        expect(grid.preWindowNodes.some((node) => node.meta?.expandable)).toBe(false)
        expect(grid.preWindowNodes).toHaveLength(2)
    })

    it('measures nothing itself, so a wrong key reads empty rather than plausible', async () => {
        const { grid, getRows } = serverGrid({
            rows: crossed,
            rowCount: 2,
            pivotColumns: [['Q9']]
        })
        await load(grid, getRows)

        expect(grid.getValue(grid.preWindowNodes[0]!, grid.columns.get('__pv:c:Q9::0')!)).toBe(
            undefined
        )
    })
})

describe('the warning tells the two situations apart', () => {
    it('stays quiet when a server row model is carrying the crossing', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { grid, getRows } = serverGrid({
            rows: crossed,
            pivotColumns: [['Q1']]
        })
        await load(grid, getRows)
        void grid.preWindowNodes

        expect(warn.mock.calls.filter((call) => String(call[0]).includes('pivot()'))).toHaveLength(
            0
        )
        expect(getPivot(grid)!.serverHandled).toBe(true)
        warn.mockRestore()
    })

    it('speaks up once when nothing is carrying it', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { grid } = serverGrid({ rows: crossed }, {}, false)

        void grid.preWindowNodes
        void grid.preWindowNodes

        expect(warn.mock.calls.filter((call) => String(call[0]).includes('pivot()'))).toHaveLength(
            1
        )
        expect(getPivot(grid)!.serverHandled).toBe(false)
        warn.mockRestore()
    })

    it('reports serverHandled false on a client grid', () => {
        const grid = createDataGrid<Sale>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            features: [pivot<Sale>(crossing)]
        })

        expect(getPivot(grid)!.serverHandled).toBe(false)
    })
})

describe('a server answer is not taken on trust', () => {
    it('refuses an axis past maxColumns, wherever the keys came from', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const many = Array.from({ length: 300 }, (_, index) => [`K${index}`])
        const { grid, getRows } = serverGrid(
            { rows: crossed, pivotColumns: many },
            { maxColumns: 10 }
        )
        await load(grid, getRows)

        expect(columnIds(grid).some(isPivotColumn)).toBe(false)
        expect(
            warn.mock.calls.filter((call) => String(call[0]).includes('leaf columns'))
        ).toHaveLength(1)
        warn.mockRestore()
    })

    it('draws a key the server sent twice only once', async () => {
        const { grid, getRows } = serverGrid({
            rows: crossed,
            pivotColumns: [['Q1'], ['Q1'], ['Q2']]
        })
        await load(grid, getRows)

        expect(columnIds(grid).filter(isPivotColumn)).toEqual(['__pv:c:Q1::0', '__pv:c:Q2::0'])
    })

    it('ignores an empty key path rather than drawing a nameless column', async () => {
        const { grid, getRows } = serverGrid({ rows: crossed, pivotColumns: [[], ['Q1']] })
        await load(grid, getRows)

        expect(columnIds(grid).filter(isPivotColumn)).toEqual(['__pv:c:Q1::0'])
    })
})

describe('what the client cannot do on a server grid, it says', () => {
    it('draws no total row, and says who should send it', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { grid, getRows } = serverGrid(
            { rows: crossed, pivotColumns: [['Q1']] },
            { totalRow: 'All' }
        )
        await load(grid, getRows)
        void grid.columns.visible

        expect(grid.preWindowNodes).toHaveLength(2)
        expect(
            warn.mock.calls.filter((call) => String(call[0]).includes('no totalRow'))
        ).toHaveLength(1)
        warn.mockRestore()
    })

    it('still says a pivot field names no column of the grid', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { grid, getRows } = serverGrid(
            { rows: crossed, pivotColumns: [['Q1']] },
            { columns: ['quaarter'] }
        )
        await load(grid, getRows)
        void grid.columns.visible

        const said = warn.mock.calls.filter((call) => String(call[0]).includes('no column defined'))
        expect(said).toHaveLength(1)
        expect(String(said[0]![0])).toContain('quaarter')
        warn.mockRestore()
    })
})

describe('an order on a crossing goes to the server', () => {
    async function ordered(columnId: string, sortable = true) {
        const { grid, seen, getRows } = serverGrid(
            { rows: crossed, pivotColumns: [['Q1'], ['Q2']] },
            { sortableColumns: sortable, totalColumn: 'Total' }
        )
        await load(grid, getRows)
        getSorting(grid)!.setSort([{ columnId, direction: 'desc' }])
        await vi.waitFor(() => expect(getRows.mock.calls.length).toBeGreaterThan(1))
        return { grid, seen }
    }

    it('names the crossing the way pivotColumns does', async () => {
        const { seen } = await ordered('__pv:c:Q1::0')

        expect(seen[seen.length - 1]!.pivot!.sort).toEqual([
            { keys: ['Q1'], measure: 0, direction: 'desc' }
        ])
    })

    it('sends an empty key path for the total column', async () => {
        const { seen } = await ordered('__pv:t:0')

        expect(seen[seen.length - 1]!.pivot!.sort).toEqual([
            { keys: [], measure: 0, direction: 'desc' }
        ])
    })

    it('sends nothing for a sort on an ordinary column', async () => {
        const { seen } = await ordered('region')

        expect(seen[seen.length - 1]!.pivot!.sort).toBeUndefined()
    })

    it('never reorders the block it is holding', async () => {
        const { grid } = await ordered('__pv:c:Q1::0')

        expect(grid.preWindowNodes.map((node) => node.id)).toEqual(['1', '2'])
    })

    it('does not offer the crossing for sorting unless asked', async () => {
        const { grid, getRows } = serverGrid({ rows: crossed, pivotColumns: [['Q1']] })
        await load(grid, getRows)

        expect(grid.columns.get('__pv:c:Q1::0')!.def.sortable).toBe(false)
    })
})

describe('what the client cannot know, it does not guess', () => {
    it('answers no rows behind a cell, and says why once', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { grid, getRows } = serverGrid({ rows: crossed, pivotColumns: [['Q1']] })
        await load(grid, getRows)

        const node = grid.preWindowNodes[0]!
        expect(getPivot(grid)!.rowsBehind(node, '__pv:c:Q1::0')).toEqual([])
        expect(getPivot(grid)!.rowsBehind(node, '__pv:c:Q1::0')).toEqual([])

        expect(
            warn.mock.calls.filter((call) => String(call[0]).includes('which rows are behind'))
        ).toHaveLength(1)
        warn.mockRestore()
    })
})

describe('a ratio crosses the wire', () => {
    it('carries the divisor with the measure it divides', async () => {
        const { grid, seen, getRows } = serverGrid(
            { rows: crossed },
            {
                values: [{ field: 'amount', agg: 'sum', per: 'quarter' }]
            }
        )
        await load(grid, getRows)

        expect(seen[0]!.pivot!.values).toEqual([{ field: 'amount', agg: 'sum', per: 'quarter' }])
    })

    it('leaves it off a measure that has none', async () => {
        const { grid, seen, getRows } = serverGrid({ rows: crossed })
        await load(grid, getRows)

        expect(seen[0]!.pivot!.values).toEqual([{ field: 'amount', agg: 'sum' }])
    })
})
