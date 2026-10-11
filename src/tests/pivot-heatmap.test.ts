import { describe, expect, it } from 'vitest'
import { createDataGrid, type ColumnDef, type GridState, type RowNode } from '$lib/index.js'
import {
    conditionalFormatting,
    getConditionalFormatting,
    type FormatRule
} from '../lib/features/conditional-formatting/index.js'
import { pivot, type PivotOptions } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    quarter: string
    product: string
    amount: number
    units: number
}

const sales: Sale[] = [
    { id: 1, region: 'North', quarter: 'Q1', product: 'Widget', amount: 100, units: 10 },
    { id: 2, region: 'North', quarter: 'Q1', product: 'Gadget', amount: 80, units: 4 },
    { id: 3, region: 'North', quarter: 'Q2', product: 'Widget', amount: 150, units: 15 },
    { id: 4, region: 'South', quarter: 'Q1', product: 'Gadget', amount: 200, units: 20 },
    { id: 5, region: 'South', quarter: 'Q2', product: 'Widget', amount: 60, units: 3 },
    { id: 6, region: 'South', quarter: 'Q2', product: 'Gadget', amount: 40, units: 4 },
    { id: 7, region: 'South', quarter: 'Q3', product: 'Widget', amount: 120, units: 12 },
    { id: 8, region: 'East', quarter: 'Q1', product: 'Gadget', amount: 80, units: 4 },
    { id: 9, region: 'East', quarter: 'Q2', product: 'Widget', amount: 120, units: 12 },
    { id: 10, region: 'East', quarter: 'Q3', product: 'Gadget', amount: 100, units: 5 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'quarter' },
    { id: 'product' },
    { id: 'amount', type: 'number' },
    { id: 'units', type: 'number' }
]

const heat: FormatRule = {
    kind: 'colorScale',
    column: { measure: 0 },
    from: 'white',
    to: 'red'
}

function build(rules: FormatRule[] = [heat], options: Partial<PivotOptions<Sale>> = {}) {
    return createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: (sale) => String(sale.id),
        features: [
            conditionalFormatting({ rules }),
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }],
                ...options
            })
        ]
    })
}

const paintAt = (grid: GridState<Sale>, region: string, header: string): string | undefined => {
    const label = grid.columns.visible.find((column) => column.id === 'region')!
    const node = grid.preWindowNodes.find(
        (candidate: RowNode<Sale>) => String(grid.getValue(candidate, label)) === region
    )
    const column = grid.columns.visible.find((candidate) => candidate.def.header === header)
    if (!node || !column) return undefined
    return getConditionalFormatting(grid)!.decoration(node, column)?.style?.['background-color']
}

const share = (paint: string | undefined): string | undefined =>
    paint?.match(/red (\d+(?:\.\d+)?)%/)?.[1]

describe('a colour scale aimed at a pivot measure', () => {
    it('paints every crossing of that measure', () => {
        const grid = build()

        for (const [region, header] of [
            ['North', 'Q1'],
            ['South', 'Q2'],
            ['East', 'Q3']
        ]) {
            expect(paintAt(grid, region!, header!), `${region} ${header}`).toContain('color-mix')
        }
    })

    it('ranks each cell against the whole crossing, not against its own column', () => {
        const grid = build()

        expect(share(paintAt(grid, 'South', 'Q1'))).toBe('100')
        expect(share(paintAt(grid, 'East', 'Q1'))).toBe('0')

        expect(share(paintAt(grid, 'South', 'Q2'))).not.toBe('0')
        expect(share(paintAt(grid, 'East', 'Q3'))).not.toBe('0')
    })

    it('gives two cells of equal value the same paint, whatever column they sit in', () => {
        const grid = build()

        expect(paintAt(grid, 'South', 'Q2')).toBe(paintAt(grid, 'East', 'Q3'))
    })

    it('leaves the totals out, of the paint and of the scale alike', () => {
        const grid = build([heat], { totalColumn: 'Cả năm', totalRow: 'Tất cả' })

        expect(paintAt(grid, 'North', 'Cả năm')).toBeUndefined()
        expect(paintAt(grid, 'Tất cả', 'Q1')).toBeUndefined()
        expect(share(paintAt(grid, 'South', 'Q1'))).toBe('100')
    })

    it('leaves a subtotal column out too, though it sits among the crossings', () => {
        const grid = build([heat], {
            columns: ['quarter', 'product'],
            columnSubtotal: (header) => header + ' cộng'
        })
        const headers = grid.columns.visible.map((column) => String(column.def.header))

        expect(headers).toContain('Q1 cộng')
        expect(paintAt(grid, 'North', 'Q1 cộng')).toBeUndefined()
        expect(paintAt(grid, 'North', 'Widget')).toContain('color-mix')
    })

    it('paints nothing when the grid holds no crossing at all', () => {
        const grid = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (sale) => String(sale.id),
            features: [conditionalFormatting({ rules: [heat] })]
        })
        const node = grid.preWindowNodes[0]!
        const column = grid.columns.visible.find((candidate) => candidate.id === 'amount')!

        expect(getConditionalFormatting(grid)!.decoration(node, column)).toBeUndefined()
    })

    it('aims at one measure and leaves the other alone', () => {
        const grid = build([{ ...heat, column: { measure: 1 } }], {
            values: [
                { field: 'amount', agg: 'sum', header: 'Tiền' },
                { field: 'units', agg: 'sum', header: 'Cái' }
            ]
        })

        expect(paintAt(grid, 'North', 'Tiền')).toBeUndefined()
        expect(paintAt(grid, 'North', 'Cái')).toContain('color-mix')
    })

    it('carries the measure it aims at through a snapshot', () => {
        const grid = build()
        const saved = grid.api.getState?.()

        const fresh = build([])
        fresh.api.setState?.(saved as never)

        expect(getConditionalFormatting(fresh)!.rules[0]?.column).toEqual({ measure: 0 })
        expect(share(paintAt(fresh, 'South', 'Q1'))).toBe('100')
    })
})
