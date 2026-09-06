import { createDataGrid } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { filtering } from '../../features/filtering/index.js'
import { sorting } from '../../features/sorting/index.js'
import { describe, expect, it } from 'vitest'
import { grouping } from '../grouping/index.js'
import { buildGridXlsx } from '../xlsx/index.js'
import { formula, getFormula } from './formula.svelte.js'
import type { FormulaOptions } from './formula.types.js'

interface Line {
    id: number
    item: string
    price: number
    qty: number
    total?: number
    withTax?: number
    tag?: string
}

const lines: Line[] = [
    { id: 1, item: 'bolt', price: 3, qty: 4 },
    { id: 2, item: 'nut', price: 10, qty: 2 },
    { id: 3, item: 'washer', price: 1, qty: 100 }
]

const columns: ColumnDef<Line>[] = [
    { id: 'item', header: 'Item', sortable: true, filter: 'text' },
    { id: 'price', header: 'Price', sortable: true },
    { id: 'qty', header: 'Qty', sortable: true },
    { id: 'total', header: 'Total', sortable: true, filter: 'number' },
    { id: 'withTax', header: 'With tax', sortable: true },
    { id: 'tag', header: 'Tag', sortable: true, filter: 'text' }
]

function grid(options: FormulaOptions, data: Line[] = lines) {
    return createDataGrid<Line>({
        columns,
        data,
        getRowId: (row) => String(row.id),
        features: [sorting(), filtering(), formula<Line>(options)]
    })
}

const valuesOf = (built: ReturnType<typeof grid>, id: keyof Line) =>
    built.preWindowNodes.map((node) => node.row[id])

describe('a formula column is an ordinary column to everything downstream', () => {
    it('writes the computed value onto the row', () => {
        const built = grid({ columns: { total: 'price * qty' } })
        expect(valuesOf(built, 'total')).toEqual([12, 20, 100])
    })

    it('leaves the source rows untouched', () => {
        const built = grid({ columns: { total: 'price * qty' } })
        void built.preWindowNodes
        expect(lines.every((row) => row.total === undefined)).toBe(true)
    })

    it('sorts by what the formula computed, not by the raw fields', () => {
        const built = grid({ columns: { total: 'price * qty' } })
        built.api.setSort?.([{ columnId: 'total', direction: 'desc' }])
        expect(valuesOf(built, 'total')).toEqual([100, 20, 12])
    })

    it('filters on the computed value', () => {
        const built = grid({ columns: { total: 'price * qty' } })
        built.api.setColumnFilter?.('total', { kind: 'number', op: 'gt', value: 15 })
        expect(valuesOf(built, 'id')).toEqual([2, 3])
    })

    it('lets the quick filter reach a computed text column', () => {
        const built = grid({ columns: { tag: 'IF(price * qty > 50, "big", "small")' } })
        built.api.setQuickFilter?.('big')
        expect(valuesOf(built, 'id')).toEqual([3])
    })
})

describe('formulas that build on other formulas', () => {
    it('evaluates in dependency order however the options are written', () => {
        const built = grid({
            columns: { withTax: 'total * 1.1', total: 'price * qty' }
        })
        expect(valuesOf(built, 'withTax')).toEqual([12 * 1.1, 20 * 1.1, 100 * 1.1])
    })

    it('reports a cycle rather than hanging', () => {
        const built = grid({
            columns: { total: 'withTax + 1', withTax: 'total + 1' }
        })
        expect(valuesOf(built, 'total')).toEqual(['#CYCLE', '#CYCLE', '#CYCLE'])
        expect(valuesOf(built, 'withTax')).toEqual(['#CYCLE', '#CYCLE', '#CYCLE'])
    })

    it('keeps the columns outside a cycle working', () => {
        const built = grid({
            columns: { total: 'price * qty', withTax: 'tag', tag: 'withTax' }
        })
        expect(valuesOf(built, 'total')).toEqual([12, 20, 100])
        expect(valuesOf(built, 'tag')).toEqual(['#CYCLE', '#CYCLE', '#CYCLE'])
    })
})

describe('a formula that goes wrong', () => {
    it('shows the error code in the cell, the way a spreadsheet does', () => {
        const built = grid({ columns: { total: 'price / (qty - qty)' } })
        expect(valuesOf(built, 'total')).toEqual(['#DIV/0', '#DIV/0', '#DIV/0'])
    })

    it('writes blank instead when the column asked for that', () => {
        const built = grid({
            columns: { total: { expression: 'price / 0', onError: 'blank' } }
        })
        expect(valuesOf(built, 'total')).toEqual([null, null, null])
    })

    it('reports a parse failure once, at construction, rather than throwing', () => {
        const seen: string[] = []
        const built = grid({
            columns: { total: 'price * * qty' },
            onParseError: (columnId, message) => seen.push(`${columnId}: ${message}`)
        })

        expect(seen).toHaveLength(1)
        expect(seen[0]).toContain('total:')
        expect(getFormula(built)!.errorOf('total')).not.toBeNull()
        expect(valuesOf(built, 'total')).toEqual(['#NAME', '#NAME', '#NAME'])
    })

    it('leaves the rest of the grid working when one formula will not parse', () => {
        const built = grid({ columns: { total: '((', withTax: 'price + 1' } })
        expect(valuesOf(built, 'withTax')).toEqual([4, 11, 2])
    })
})

describe('editing a formula at runtime', () => {
    it('recomputes when the expression is replaced', () => {
        const built = grid({ columns: { total: 'price * qty' } })
        expect(valuesOf(built, 'total')).toEqual([12, 20, 100])

        built.api.setFormula?.('total', 'price + qty')
        expect(valuesOf(built, 'total')).toEqual([7, 12, 101])
    })

    it('stops computing once the formula is removed', () => {
        const built = grid({ columns: { total: 'price * qty' } })
        void built.preWindowNodes

        built.api.removeFormula?.('total')
        expect(valuesOf(built, 'total')).toEqual([undefined, undefined, undefined])
    })

    it('hands the expression back for an editor to show', () => {
        const built = grid({ columns: { total: 'price * qty' } })
        expect(built.api.formulaFor?.('total')).toBe('price * qty')
        expect(built.api.formulaFor?.('nope')).toBeUndefined()
    })
})

describe('formulas round-trip through grid state, which a callback could not', () => {
    it('survives getState and setState', () => {
        const source = grid({ columns: { total: 'price * qty' } })
        const snapshot = source.getState()

        const target = grid({})
        expect(valuesOf(target, 'total')).toEqual([undefined, undefined, undefined])

        target.setState(snapshot)
        expect(valuesOf(target, 'total')).toEqual([12, 20, 100])
        expect(getFormula(target)!.expressionOf('total')).toBe('price * qty')
    })

    it('ignores a saved shape that is not expressions', () => {
        const built = grid({ columns: { total: 'price * qty' } })
        getFormula(built)!.hydrate({ total: 42, withTax: ['nope'] })
        expect(getFormula(built)!.columnIds).toEqual([])
    })

    it('leaves nothing in the snapshot when there are no formulas', () => {
        expect(getFormula(grid({}))!.serialize()).toBeUndefined()
    })
})

describe('the computed value reaches the file, and stays inert there', () => {
    it('exports what the formula produced', () => {
        const built = grid({ columns: { total: 'price * qty' } })
        const text = new TextDecoder().decode(buildGridXlsx(built))

        expect(text).toContain('<v>12</v>')
        expect(text).toContain('<v>100</v>')
    })

    it('never turns a computed string into a spreadsheet formula', () => {
        const built = grid({ columns: { tag: '"=1+1" & item' } })
        const text = new TextDecoder().decode(buildGridXlsx(built))

        expect(text).not.toContain('<f>')
        expect(text).toContain('=1+1bolt')
        expect(text).toContain('t="inlineStr"')
    })
})

describe('the formula runs before grouping, so a group can aggregate it', () => {
    interface Sale {
        id: number
        region: string
        price: number
        qty: number
        total?: number
    }

    const sales: Sale[] = [
        { id: 1, region: 'north', price: 10, qty: 2 },
        { id: 2, region: 'north', price: 5, qty: 4 },
        { id: 3, region: 'south', price: 7, qty: 3 }
    ]

    function groupedGrid(by: string[]) {
        return createDataGrid<Sale>({
            columns: [
                { id: 'region', header: 'Region' },
                { id: 'price', header: 'Price' },
                { id: 'qty', header: 'Qty' },
                { id: 'total', header: 'Total' }
            ],
            data: sales,
            getRowId: (row) => String(row.id),
            features: [
                formula<Sale>({ columns: { total: 'price * qty' } }),
                grouping<Sale>({ by, aggregations: { total: 'sum' } })
            ]
        })
    }

    it('sums a computed column on the group row', () => {
        const built = groupedGrid(['region'])
        const groups = built.nodes.filter((node) => node.id.startsWith('group:'))

        expect(groups).toHaveLength(2)
        expect(groups.map((node) => node.row.total)).toEqual([40, 21])
    })

    it('groups by a computed column itself', () => {
        const built = createDataGrid<Sale>({
            columns: [
                { id: 'region', header: 'Region' },
                { id: 'price', header: 'Price' },
                { id: 'qty', header: 'Qty' },
                { id: 'total', header: 'Total' }
            ],
            data: sales,
            getRowId: (row) => String(row.id),
            features: [
                formula<Sale>({ columns: { total: 'IF(price * qty > 20, "big", "small")' } }),
                grouping<Sale>({ by: ['total'] })
            ]
        })

        const keys = built.nodes
            .filter((node) => node.id.startsWith('group:'))
            .map((node) => node.id)

        expect(keys.sort()).toEqual(['group:total=big', 'group:total=small'])
    })
})
