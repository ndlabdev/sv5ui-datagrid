import { describe, expect, it, vi } from 'vitest'
import { flushSync } from 'svelte'
import {
    createDataGrid,
    filtering,
    getFiltering,
    getSorting,
    serverRowModel,
    sorting,
    type ColumnDef,
    type GridFeature
} from '$lib/index.js'
import { getPivot, pivot } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    quarter: string
    amount: number
}

const columns: ColumnDef<Sale>[] = [
    { id: 'region', filter: 'text', sortable: true },
    { id: 'quarter', filter: 'text' },
    { id: 'amount', type: 'number', sortable: true }
]

function rows(count: number): Sale[] {
    const quarters = ['Q1', 'Q2', 'Q3', 'Q4']
    return Array.from({ length: count }, (_, index) => ({
        id: index,
        region: `R${index % 5}`,
        quarter: quarters[index % 4]!,
        amount: index
    }))
}

function counted(): { feature: GridFeature<Sale>; runs: () => number } {
    const base = pivot<Sale>({
        rows: ['region'],
        columns: ['quarter'],
        values: [{ field: 'amount', agg: 'sum' }]
    })
    let runs = 0
    const shape = base.columns!
    return {
        feature: {
            ...base,
            columns: (defs, grid) => {
                runs++
                return shape(defs, grid)
            }
        },
        runs: () => runs
    }
}

describe('the column shaper settles', () => {
    it('runs once for a read and not again for the next one', () => {
        const cleanup = $effect.root(() => {
            const { feature, runs } = counted()
            const grid = createDataGrid<Sale>({
                columns,
                data: rows(200),
                getRowId: (row) => String(row.id),
                features: [filtering(), sorting(), feature]
            })

            expect(grid.columns.visible).toHaveLength(5)
            const afterFirst = runs()
            expect(afterFirst).toBeLessThanOrEqual(2)

            void grid.columns.visible
            void grid.columns.visible
            expect(runs()).toBe(afterFirst)
        })
        cleanup()
    })

    it('does not close a loop with the filter that reads it', () => {
        const cleanup = $effect.root(() => {
            const { feature, runs } = counted()
            const grid = createDataGrid<Sale>({
                columns,
                data: rows(200),
                getRowId: (row) => String(row.id),
                features: [filtering(), sorting(), feature]
            })

            void grid.preWindowNodes
            const settled = runs()

            getFiltering(grid)!.setColumnFilter('quarter', {
                kind: 'text',
                op: 'equals',
                value: 'Q1'
            })
            flushSync()
            void grid.preWindowNodes

            expect(runs()).toBe(settled)
            expect(grid.columns.visible).toHaveLength(5)
        })
        cleanup()
    })

    it('does not reshape for a sort', () => {
        const cleanup = $effect.root(() => {
            const { feature, runs } = counted()
            const grid = createDataGrid<Sale>({
                columns,
                data: rows(200),
                getRowId: (row) => String(row.id),
                features: [filtering(), sorting(), feature]
            })

            void grid.preWindowNodes
            const settled = runs()

            getSorting(grid)!.setSort([{ columnId: 'region', direction: 'desc' }])
            flushSync()
            void grid.preWindowNodes

            expect(runs()).toBe(settled)
        })
        cleanup()
    })

    it('reshapes once when the data brings a new key', () => {
        const cleanup = $effect.root(() => {
            const { feature, runs } = counted()
            const grid = createDataGrid<Sale>({
                columns,
                data: rows(200),
                getRowId: (row) => String(row.id),
                features: [filtering(), sorting(), feature]
            })

            void grid.columns.visible
            const settled = runs()

            grid.data = [...rows(200), { id: 999, region: 'R9', quarter: 'Q5', amount: 1 }]
            flushSync()

            expect(grid.columns.visible).toHaveLength(6)
            expect(runs() - settled).toBeLessThanOrEqual(2)
        })
        cleanup()
    })
})

describe('the axis a server answered settles too', () => {
    it('holds the shaped columns steady when the keys come back unchanged', async () => {
        const getRows = vi.fn(async () => ({
            rows: [{ id: 1, region: 'R0', quarter: 'Q1', amount: 1 }],
            rowCount: 1,
            pivotColumns: [['Q1'], ['Q2']]
        }))

        let grid: ReturnType<typeof createDataGrid<Sale>>
        const cleanup = $effect.root(() => {
            grid = createDataGrid<Sale>({
                columns,
                data: [],
                getRowId: (row) => String(row.id),
                rowModel: 'server',
                features: [
                    pivot<Sale>({
                        rows: ['region'],
                        columns: ['quarter'],
                        values: [{ field: 'amount', agg: 'sum' }]
                    }),
                    serverRowModel<Sale>({ getRows }, { mode: 'paged' })
                ]
            })
        })

        grid!.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await vi.waitFor(() => expect(grid.columns.visible.length).toBeGreaterThan(1))

        const shaped = grid!.columns.shaped
        grid!.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await vi.waitFor(() => expect(getRows.mock.calls.length).toBeGreaterThan(1))
        flushSync()

        expect(grid!.columns.shaped).toBe(shaped)
        cleanup()
    })
})

describe('a crossing can be changed while the grid is open', () => {
    const data: Sale[] = [
        { id: 1, region: 'N', quarter: 'Q1', amount: 10 },
        { id: 2, region: 'N', quarter: 'Q2', amount: 20 },
        { id: 3, region: 'S', quarter: 'Q1', amount: 30 }
    ]

    const withProduct: ColumnDef<Sale>[] = [
        { id: 'region' },
        { id: 'quarter' },
        { id: 'amount', type: 'number' }
    ]

    it('redraws the axis when the column field is swapped through the api', () => {
        const cleanup = $effect.root(() => {
            const grid = createDataGrid<Sale>({
                columns: withProduct,
                data,
                getRowId: (row) => String(row.id),
                features: [
                    pivot<Sale>({
                        rows: ['region'],
                        columns: ['quarter'],
                        values: [{ field: 'amount', agg: 'sum' }]
                    })
                ]
            })

            const leaves = () =>
                grid.columns.visible
                    .filter((column) => column.id.startsWith('__pv'))
                    .map((column) => String(column.def.header))
            const north = () => grid.preWindowNodes.find((node) => node.id.startsWith('group:'))!

            expect(leaves()).toEqual(['Q1', 'Q2'])
            expect(grid.getValue(north(), grid.columns.get('__pv:c:Q1::0')!)).toBe(10)

            grid.api.setPivotValues?.([{ field: 'amount', agg: 'count' }])
            flushSync()
            expect(grid.getValue(north(), grid.columns.get('__pv:c:Q1::0')!)).toBe(1)

            grid.api.setPivotColumns?.(['region'])
            flushSync()
            expect(leaves()).toEqual(['N', 'S'])
        })
        cleanup()
    })

    it('stops crossing when the last field is taken out, and starts again', () => {
        const cleanup = $effect.root(() => {
            const grid = createDataGrid<Sale>({
                columns: withProduct,
                data,
                getRowId: (row) => String(row.id),
                features: [
                    pivot<Sale>({
                        rows: ['region'],
                        columns: ['quarter'],
                        values: [{ field: 'amount', agg: 'sum' }]
                    })
                ]
            })
            const ids = () => grid.columns.visible.map((column) => column.id)

            expect(grid.api.isPivoting?.()).toBe(true)

            grid.api.clearPivot?.()
            flushSync()
            expect(grid.api.isPivoting?.()).toBe(false)
            expect(ids()).toEqual(['region', 'quarter', 'amount'])
            expect(grid.preWindowNodes).toHaveLength(data.length)

            grid.api.addPivotRowField?.('region')
            grid.api.addPivotColumnField?.('quarter')
            flushSync()
            expect(grid.api.isPivoting?.()).toBe(true)
            expect(ids().filter((id) => id.startsWith('__pv'))).toHaveLength(2)
        })
        cleanup()
    })

    it('will not put one field on both axes at once', () => {
        const cleanup = $effect.root(() => {
            const grid = createDataGrid<Sale>({
                columns: withProduct,
                data,
                getRowId: (row) => String(row.id),
                features: [
                    pivot<Sale>({
                        rows: ['region'],
                        columns: ['quarter'],
                        values: [{ field: 'amount', agg: 'sum' }]
                    })
                ]
            })

            grid.api.addPivotColumnField?.('region')
            flushSync()

            expect(getPivot(grid)!.rows).toEqual([])
            expect(getPivot(grid)!.columns).toEqual(['quarter', 'region'])
        })
        cleanup()
    })
})
