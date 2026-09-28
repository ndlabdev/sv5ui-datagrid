import { describe, expect, it, vi } from 'vitest'
import { createDataGrid, type ColumnDef, type GridState, type RowNode } from '$lib/index.js'
import { isPivotColumn, pivot, type PivotOptions } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    quarter: string
    product: string
    amount: number
}

const sales: Sale[] = [
    { id: 1, region: 'North', quarter: 'Q1', product: 'Widget', amount: 100 },
    { id: 2, region: 'North', quarter: 'Q1', product: 'Widget', amount: 80 },
    { id: 3, region: 'North', quarter: 'Q1', product: 'Gadget', amount: 60 },
    { id: 4, region: 'North', quarter: 'Q2', product: 'Widget', amount: 150 },
    { id: 5, region: 'South', quarter: 'Q1', product: 'Widget', amount: 200 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'quarter' },
    { id: 'product' },
    { id: 'amount', type: 'number' }
]

function build(options: Partial<PivotOptions<Sale>> = {}) {
    return createDataGrid<Sale>({
        columns,
        data: sales,
        getRowId: (row) => String(row.id),
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter', 'product'],
                values: [{ field: 'amount', agg: 'sum' }],
                columnSubtotal: (header) => `${header} total`,
                ...options
            })
        ]
    })
}

const headers = (grid: GridState<Sale>) =>
    grid.columns.visible
        .filter((column) => isPivotColumn(column.id))
        .map((column) => String(column.def.header))

const north = (grid: GridState<Sale>): RowNode<Sale> =>
    grid.preWindowNodes.find((node) => node.meta?.expandable)!

const at = (grid: GridState<Sale>, id: string) => grid.getValue(north(grid), grid.columns.get(id)!)

describe('a column group closes with its own total', () => {
    it('puts the subtotal after the children it closes', () => {
        expect(headers(build())).toEqual(['Gadget', 'Widget', 'Q1 total', 'Widget', 'Q2 total'])
    })

    it('measures the rows the branch gathered', () => {
        const grid = build()

        expect(at(grid, '__pv:c:Q1|Gadget::0')).toBe(60)
        expect(at(grid, '__pv:c:Q1|Widget::0')).toBe(180)
        expect(at(grid, '__pv:c:Q1::s0')).toBe(240)
    })

    it('does not add up the columns beside it, which an average would get wrong', () => {
        const grid = build({ values: [{ field: 'amount', agg: 'avg' }] })

        const gadget = at(grid, '__pv:c:Q1|Gadget::0') as number
        const widget = at(grid, '__pv:c:Q1|Widget::0') as number
        const subtotal = at(grid, '__pv:c:Q1::s0') as number

        expect(gadget).toBe(60)
        expect(widget).toBe(90)
        expect(subtotal).toBe(80)
        expect(subtotal).not.toBe((gadget + widget) / 2)
    })

    it('draws none when there is only one column field, since every column is a leaf', () => {
        expect(headers(build({ columns: ['quarter'] }))).toEqual(['Q1', 'Q2'])
    })

    it('gives each measure its own subtotal leaf', () => {
        const grid = build({
            values: [
                { field: 'amount', agg: 'sum', header: 'Sum' },
                { field: 'amount', agg: 'count', header: 'Count' }
            ]
        })

        expect(at(grid, '__pv:c:Q1::s0')).toBe(240)
        expect(at(grid, '__pv:c:Q1::s1')).toBe(3)
    })

    it('sits inside the group it closes, not beside it', () => {
        const grid = build()
        const groups = grid.columns.shaped.filter((def) => isPivotColumn(def.id))

        expect(groups.map((def) => def.header)).toEqual(['Q1', 'Q2'])
        expect(groups[0]!.children?.map((child) => child.header)).toEqual([
            'Gadget',
            'Widget',
            'Q1 total'
        ])
    })

    it('is left out entirely when the option is', () => {
        expect(headers(build({ columnSubtotal: undefined }))).toEqual([
            'Gadget',
            'Widget',
            'Widget'
        ])
    })

    it('counts against maxColumns, so a ceiling still means what it says', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = build({ maxColumns: 4 })

        expect(headers(grid)).toHaveLength(0)
        expect(headers(build({ maxColumns: 5 }))).toHaveLength(5)
        warn.mockRestore()
    })
})
