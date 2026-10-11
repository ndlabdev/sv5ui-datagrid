import { describe, expect, it, vi } from 'vitest'
import { createDataGrid, sorting, type ColumnDef, type GridState } from '$lib/index.js'
import { getPivot, isPivotColumn, pivot, type PivotOptions } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    quarter: string
    product: string
    amount: number
    units: number
}

const sales: Sale[] = ['North', 'South'].flatMap((region, r) =>
    ['Q1', 'Q2'].flatMap((quarter, q) =>
        ['Widget', 'Gadget'].map((product, p) => ({
            id: r * 100 + q * 10 + p,
            region,
            quarter,
            product,
            amount: 10 * (r + 1) + q + p,
            units: 1 + p
        }))
    )
)

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'quarter' },
    { id: 'product' },
    { id: 'amount', type: 'number' },
    { id: 'units', type: 'number' }
]

const build = (options: Partial<PivotOptions<Sale>> = {}): GridState<Sale> =>
    createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: (row) => String(row.id),
        features: [
            sorting<Sale>(),
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }],
                ...options
            })
        ]
    })

const leafIds = (grid: GridState<Sale>) =>
    grid.columns.visible.filter((column) => isPivotColumn(column.id)).map((column) => column.id)

const headers = (grid: GridState<Sale>) =>
    grid.columns.visible.map((column) => String(column.def.header ?? column.id))

describe('every setter on the api reaches the state it names', () => {
    it('moves the two axes and the measures', () => {
        const grid = build()

        grid.api.setPivotRows!(['product'])
        grid.api.setPivotColumns!(['region'])
        grid.api.setPivotValues!([{ field: 'units', agg: 'sum' }])

        const state = getPivot(grid)!
        expect(state.rows).toEqual(['product'])
        expect(state.columns).toEqual(['region'])
        expect(state.values).toEqual([{ field: 'units', agg: 'sum' }])
    })

    it('adds a field to either axis', () => {
        const grid = build()

        grid.api.addPivotRowField!('product')
        grid.api.addPivotColumnField!('units')

        expect(getPivot(grid)!.rows).toEqual(['region', 'product'])
        expect(getPivot(grid)!.columns).toEqual(['quarter', 'units'])
    })

    it('takes a field off whichever axis holds it', () => {
        const grid = build({ rows: ['region', 'product'] })

        grid.api.removePivotField!('product')
        expect(getPivot(grid)!.rows).toEqual(['region'])

        grid.api.removePivotField!('quarter')
        expect(getPivot(grid)!.columns).toEqual([])
        expect(grid.api.isPivoting!()).toBe(false)
    })

    it('turns the total column on and off', () => {
        const grid = build()
        expect(leafIds(grid).some((id) => id.startsWith('__pv:t:'))).toBe(false)

        grid.api.setPivotTotalColumn!('Sum')
        expect(leafIds(grid).some((id) => id.startsWith('__pv:t:'))).toBe(true)
        expect(headers(grid)).toContain('Sum')

        grid.api.setPivotTotalColumn!(undefined)
        expect(leafIds(grid).some((id) => id.startsWith('__pv:t:'))).toBe(false)
    })

    it('turns the total row on and off', () => {
        const grid = build()
        const totals = () => grid.preWindowNodes.filter((node) => node.id.startsWith('total:'))
        expect(totals()).toEqual([])

        grid.api.setPivotTotalRow!('All')
        expect(totals().length).toBe(1)

        grid.api.setPivotTotalRow!(undefined)
        expect(totals()).toEqual([])
    })

    it('turns the column subtotal on and off', () => {
        const grid = build({ columns: ['quarter', 'product'] })
        const subs = () => leafIds(grid).filter((id) => id.includes('::s'))
        expect(subs()).toEqual([])

        grid.api.setPivotColumnSubtotal!((header: string) => `${header} sum`)
        expect(subs().length).toBeGreaterThan(0)
        expect(headers(grid)).toContain('Q1 sum')

        grid.api.setPivotColumnSubtotal!(undefined)
        expect(subs()).toEqual([])
    })

    it('opens the generated columns to sorting and shuts them again', () => {
        const grid = build()
        const sortable = () =>
            grid.columns.visible
                .filter((column) => isPivotColumn(column.id))
                .every((column) => column.def.sortable === true)

        expect(sortable()).toBe(false)

        grid.api.setPivotSortableColumns!(true)
        expect(sortable()).toBe(true)

        grid.api.setPivotSortableColumns!(false)
        expect(sortable()).toBe(false)
    })

    it('switches the header groups between fixed and foldable', () => {
        const grid = build({ columns: ['quarter', 'product'] })
        expect(getPivot(grid)!.columnGroups).toBe('fixed')

        grid.api.setPivotColumnGroups!('open')
        expect(getPivot(grid)!.columnGroups).toBe('open')

        grid.api.setPivotColumnGroups!('closed')
        expect(getPivot(grid)!.columnGroups).toBe('closed')
    })

    it('moves the measures between the axes and reads back where they are', () => {
        const grid = build()
        expect(grid.api.pivotValuesOn!()).toBe('columns')

        grid.api.setPivotValuesOn!('rows')
        expect(grid.api.pivotValuesOn!()).toBe('rows')
        expect(leafIds(grid)).toContain('__pv:m')
    })

    it('keeps only some rows and reads the setting back', () => {
        const grid = build()
        grid.api.setPivotKeepRows!({ top: 1 })

        expect(grid.api.pivotKeepRows!()).toEqual({ top: 1 })
        expect(grid.preWindowNodes.length).toBe(1)

        grid.api.setPivotKeepRows!(undefined)
        expect(grid.api.pivotKeepRows!()).toBeUndefined()
        expect(grid.preWindowNodes.length).toBe(2)
    })

    it('orders the columns by a measure, both ways, and reads the setting back', () => {
        const lumpy: Sale[] = [
            { id: 1, region: 'North', quarter: 'Q1', product: 'W', amount: 50, units: 1 },
            { id: 2, region: 'North', quarter: 'Q2', product: 'W', amount: 10, units: 1 },
            { id: 3, region: 'North', quarter: 'Q3', product: 'W', amount: 30, units: 1 }
        ]
        const grid = createDataGrid<Sale>({
            data: lumpy,
            columns,
            getRowId: (row) => String(row.id),
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'amount', agg: 'sum' }]
                })
            ]
        })

        expect(leafIds(grid)).toEqual(['__pv:c:Q1::0', '__pv:c:Q2::0', '__pv:c:Q3::0'])

        grid.api.setPivotOrderColumns!({ direction: 'desc' })
        expect(grid.api.pivotOrderColumns!()).toEqual({ direction: 'desc' })
        expect(leafIds(grid)).toEqual(['__pv:c:Q1::0', '__pv:c:Q3::0', '__pv:c:Q2::0'])

        grid.api.setPivotOrderColumns!({ direction: 'asc' })
        expect(leafIds(grid)).toEqual(['__pv:c:Q2::0', '__pv:c:Q3::0', '__pv:c:Q1::0'])

        grid.api.setPivotOrderColumns!(undefined)
        expect(leafIds(grid)).toEqual(['__pv:c:Q1::0', '__pv:c:Q2::0', '__pv:c:Q3::0'])
    })

    it('raises and lowers the ceiling on generated columns', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = build({ columns: ['quarter', 'product'], maxColumns: 1 })
        expect(leafIds(grid)).toEqual([])

        grid.api.setPivotMaxColumns!(50)
        expect(grid.api.pivotMaxColumns!()).toBe(50)
        expect(leafIds(grid).length).toBeGreaterThan(1)
        warn.mockRestore()
    })

    it('hands back the rows behind a cell', () => {
        const grid = build()
        const node = grid.preWindowNodes[0]!
        const crossing = leafIds(grid)[0]!

        const behind = grid.api.pivotRowsBehind!(node, crossing) as Sale[]

        expect(behind.length).toBeGreaterThan(0)
        expect(behind.every((row) => row.region === 'North')).toBe(true)
    })

    it('clears the crossing and says so', () => {
        const grid = build()
        expect(grid.api.isPivoting!()).toBe(true)

        grid.api.clearPivot!()

        expect(grid.api.isPivoting!()).toBe(false)
        expect(grid.api.pivotRows!()).toEqual([])
        expect(leafIds(grid)).toEqual([])
    })
})

describe('the extension point a crossing needed, and what it promises', () => {
    const reshaper = (seen: ColumnDef<Sale>[][]): import('$lib/index.js').GridFeature<Sale> => ({
        id: 'reshaper',
        columns: (defs) => {
            seen.push(defs)
            return defs.map((def) =>
                isPivotColumn(def.id) ? { ...def, header: `[${String(def.header)}]` } : def
            )
        }
    })

    it('hands a later feature the columns the crossing just made', () => {
        const seen: ColumnDef<Sale>[][] = []
        const grid = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (row) => String(row.id),
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'amount', agg: 'sum' }]
                }),
                reshaper(seen)
            ]
        })

        expect(headers(grid)).toContain('[Q1]')
        expect(seen.at(-1)!.some((def) => isPivotColumn(def.id))).toBe(true)
    })

    it('hands an earlier feature only the declared columns, the crossing not yet made', () => {
        const seen: ColumnDef<Sale>[][] = []
        const grid = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (row) => String(row.id),
            features: [
                reshaper(seen),
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'amount', agg: 'sum' }]
                })
            ]
        })

        expect(headers(grid)).not.toContain('[Q1]')
        expect(seen.at(-1)!.some((def) => isPivotColumn(def.id))).toBe(false)
    })

    it('lets a later feature put the total column first, which nothing else can', () => {
        const front: import('$lib/index.js').GridFeature<Sale> = {
            id: 'total-first',
            columns: (defs) => [
                ...defs.filter((def) => def.id.startsWith('__pv:t:')),
                ...defs.filter((def) => !def.id.startsWith('__pv:t:'))
            ]
        }
        const grid = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (row) => String(row.id),
            features: [
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'amount', agg: 'sum' }],
                    totalColumn: 'Sum'
                }),
                front
            ]
        })

        expect(grid.columns.visible[0]!.id).toBe('__pv:t:0')
    })
})
