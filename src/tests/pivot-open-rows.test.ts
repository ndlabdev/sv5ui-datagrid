import { describe, expect, it } from 'vitest'
import { createDataGrid, type ColumnDef, type GridState } from '$lib/index.js'
import { getPivot, pivot, type PivotOptions } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    product: string
    amount: number
}

const sales: Sale[] = ['North', 'South', 'East'].flatMap((region, r) =>
    ['Widget', 'Gadget'].map((product, p) => ({
        id: r * 10 + p,
        region,
        product,
        amount: (r + 1) * 10 + p
    }))
)

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'product' },
    { id: 'amount', type: 'number' }
]

const build = (options: Partial<PivotOptions<Sale>> = {}): GridState<Sale> =>
    createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: (row) => String(row.id),
        features: [
            pivot<Sale>({
                rows: ['region', 'product'],
                columns: ['amount'],
                values: [{ field: 'amount', agg: 'sum' }],
                maxColumns: 200,
                ...options
            })
        ]
    })

const levels = (grid: GridState<Sale>) => grid.preWindowNodes.map((node) => node.meta?.level ?? 0)

describe('opening and shutting the row axis in one go', () => {
    it('starts shut, showing only the outermost tier', () => {
        const grid = build()
        expect(new Set(levels(grid))).toEqual(new Set([0]))
        expect(grid.api.pivotRowsOpen!()).toBe(false)
    })

    it('opens every tier at once', () => {
        const grid = build()
        grid.api.expandAllPivotRows!()

        expect(new Set(levels(grid))).toEqual(new Set([0, 1]))
        expect(grid.api.pivotRowsOpen!()).toBe(true)
    })

    it('shuts every tier again', () => {
        const grid = build()
        grid.api.expandAllPivotRows!()
        grid.api.collapseAllPivotRows!()

        expect(new Set(levels(grid))).toEqual(new Set([0]))
        expect(grid.api.pivotRowsOpen!()).toBe(false)
    })

    it('reaches the innermost tier of a three field axis', () => {
        const grid = build({ rows: ['region', 'product', 'amount'], columns: ['product'] })
        grid.api.expandAllPivotRows!()

        expect(new Set(levels(grid))).toEqual(new Set([0, 1, 2]))
    })

    it('says nothing is open on an axis with one field, which cannot nest', () => {
        const grid = build({ rows: ['region'] })
        grid.api.expandAllPivotRows!()

        expect(new Set(levels(grid))).toEqual(new Set([0]))
        expect(grid.api.pivotRowsOpen!()).toBe(false)
    })

    it('leaves a row a reader opened by hand open', () => {
        const grid = build()
        const head = grid.preWindowNodes[0]!
        grid.expansion.expand(head.id)
        expect(grid.api.pivotRowsOpen!()).toBe(true)

        grid.api.expandAllPivotRows!()
        expect(grid.expansion.isExpanded(head.id)).toBe(true)
    })

    it('does not carry what was opened into a saved view', () => {
        const grid = build()
        grid.api.expandAllPivotRows!()
        const snapshot = grid.api.getState!()
        expect(JSON.stringify(snapshot)).not.toContain('group:')

        const fresh = build()
        fresh.api.setState!(snapshot)

        expect(fresh.api.pivotRowsOpen!()).toBe(false)
        expect(new Set(levels(fresh))).toEqual(new Set([0]))
    })

    it('offers nothing when the crossing is off', () => {
        const grid = build()
        grid.api.clearPivot!()

        expect(getPivot(grid)!.rowsOpen).toBe(false)
    })
})

describe('opening the axis beside the rest of what a crossing does', () => {
    const openIds = (grid: GridState<Sale>) => [...grid.expansion.expandedIds]

    it('opens the field tiers when the measures run down the page as well', () => {
        const grid = build({
            rows: ['region', 'product'],
            columns: ['amount'],
            values: [
                { field: 'amount', agg: 'sum' },
                { field: 'amount', agg: 'avg', header: 'Mean' }
            ],
            valuesOn: 'rows'
        })
        grid.api.expandAllPivotRows!()

        expect(new Set(levels(grid))).toEqual(new Set([0, 1, 2]))
        expect(grid.api.pivotRowsOpen!()).toBe(true)
    })

    it('never counts a measure row as something to open', () => {
        const grid = build({
            rows: ['region'],
            columns: ['amount'],
            values: [
                { field: 'amount', agg: 'sum' },
                { field: 'amount', agg: 'avg', header: 'Mean' }
            ],
            valuesOn: 'rows'
        })
        grid.api.expandAllPivotRows!()

        expect(grid.api.pivotRowsOpen!()).toBe(false)
        expect(openIds(grid)).toEqual([])
    })

    it('leaves the grand total row shut, it gathers nothing to open', () => {
        const grid = build({ totalRow: 'All' })
        grid.api.expandAllPivotRows!()

        expect(openIds(grid).some((id) => id.startsWith('total:'))).toBe(false)
    })

    it('opens what keepRows left standing, and nothing it cut', () => {
        const grid = build({ keepRows: { top: 2, others: 'Rest' } })
        grid.api.expandAllPivotRows!()

        expect(new Set(levels(grid))).toEqual(new Set([0, 1]))
    })

    it('says nothing is open on an empty grid, and does not throw', () => {
        const grid = createDataGrid<Sale>({
            data: [],
            columns,
            getRowId: (row) => String(row.id),
            features: [
                pivot<Sale>({
                    rows: ['region', 'product'],
                    columns: ['amount'],
                    values: [{ field: 'amount', agg: 'sum' }]
                })
            ]
        })

        expect(() => grid.api.expandAllPivotRows!()).not.toThrow()
        expect(grid.api.pivotRowsOpen!()).toBe(false)
    })

    it('opens the same set twice without piling anything up', () => {
        const grid = build()
        grid.api.expandAllPivotRows!()
        const once = openIds(grid).length

        grid.api.expandAllPivotRows!()

        expect(openIds(grid).length).toBe(once)
    })

    it('drops the rows that are gone the next time it opens everything', () => {
        const grid = build()
        grid.api.expandAllPivotRows!()
        expect(openIds(grid).length).toBe(3)

        grid.data = sales.filter((row) => row.region === 'North')
        grid.api.expandAllPivotRows!()

        expect(openIds(grid)).toEqual(['group:region=North'])
    })

    it('remembers across a filter until something opens everything again', () => {
        const grid = build()
        grid.api.expandAllPivotRows!()

        grid.data = sales.filter((row) => row.region === 'North')
        grid.data = sales

        expect(new Set(levels(grid))).toEqual(new Set([0, 1]))
    })

    it('remembers an axis it is sent back to', () => {
        const grid = build()
        grid.api.expandAllPivotRows!()

        grid.api.setPivotRows!(['product', 'region'])
        expect(new Set(levels(grid))).toEqual(new Set([0]))

        grid.api.setPivotRows!(['region', 'product'])
        expect(new Set(levels(grid))).toEqual(new Set([0, 1]))
    })

    it('holds what was open while the crossing is off, and gives it back', () => {
        const grid = build()
        grid.api.expandAllPivotRows!()
        grid.api.clearPivot!()

        grid.api.setPivotRows!(['region', 'product'])
        grid.api.setPivotColumns!(['amount'])

        expect(new Set(levels(grid))).toEqual(new Set([0, 1]))
    })
})
