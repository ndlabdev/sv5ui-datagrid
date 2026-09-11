import { createDataGrid, editing, sorting, type ColumnDef, type GridState } from '$lib/index.js'
import { describe, expect, it } from 'vitest'
import { formula } from '../lib/features/formula/index.js'
import { grouping } from '../lib/features/grouping/index.js'
import { getRangeSelection, rangeSelection } from '../lib/features/range-selection/index.js'
import { conditionalFormatting } from '../lib/features/conditional-formatting/index.js'

interface Line {
    id: number
    region: string
    unit: number
    qty: number
    total?: number
}

const makeData = (): Line[] => [
    { id: 1, region: 'North', unit: 50, qty: 2 },
    { id: 2, region: 'North', unit: 100, qty: 3 },
    { id: 3, region: 'South', unit: 200, qty: 4 }
]

const columns: ColumnDef<Line>[] = [
    { id: 'region', header: 'Region' },
    {
        id: 'unit',
        header: 'Unit',
        editable: true,
        parse: (input) => (input === null ? null : Number(input))
    },
    {
        id: 'qty',
        header: 'Qty',
        editable: true,
        parse: (input) => (input === null ? null : Number(input))
    },
    { id: 'total', header: 'Total' }
]

function makeGrid(): GridState<Line> {
    return createDataGrid<Line>({
        columns,
        data: makeData(),
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            editing(),
            formula<Line>({ columns: { total: 'unit * qty' } }),
            grouping<Line>({
                by: ['region'],
                expandedByDefault: true,
                aggregations: { total: 'sum', unit: 'median' }
            }),
            conditionalFormatting<Line>({
                rules: [{ kind: 'colorScale', id: 'scale', column: 'total' }]
            }),
            rangeSelection()
        ]
    })
}

const dataRowIndex = (grid: GridState<Line>, rowId: string) =>
    grid.preWindowNodes.findIndex((node) => node.id === rowId)

describe('range writes meet formula columns', () => {
    it('leaves a formula column out of a range edit and recomputes it instead', () => {
        const grid = makeGrid()
        const state = getRangeSelection(grid)!
        const first = dataRowIndex(grid, '1')

        state.startRange(first, 1)
        state.extendTo(first, 3)
        state.endRange()
        state.applyToRange(7)

        expect(grid.data[0]).toMatchObject({ unit: 7, qty: 7 })
        expect(grid.data[0]!.total).toBeUndefined()
        expect(grid.nodes[first]!.row.total).toBe(49)
    })

    it('refuses to move onto a formula column, and keeps the source', () => {
        const grid = makeGrid()
        const state = getRangeSelection(grid)!
        const first = dataRowIndex(grid, '1')

        state.cutSource = { top: first, left: 1, bottom: first, right: 1 }
        expect(state.moveRange(first, 3)).toBe(false)
        expect(grid.data[0]!.unit).toBe(50)
    })

    it('moves an editable cell and carries the formula and the group total with it', () => {
        const grid = makeGrid()
        const state = getRangeSelection(grid)!
        const from = dataRowIndex(grid, '1')
        const to = dataRowIndex(grid, '2')
        const groupRow = grid.nodes.findIndex((node) => node.meta?.expandable)

        const totalBefore = grid.nodes[groupRow]!.row.total
        expect(totalBefore).toBe(50 * 2 + 100 * 3)

        state.cutSource = { top: from, left: 1, bottom: from, right: 1 }
        expect(state.moveRange(to, 1)).toBe(true)

        expect(grid.data[0]!.unit).toBeNull()
        expect(grid.data[1]!.unit).toBe(50)
        expect(grid.nodes[groupRow]!.row.total).toBe(0 * 2 + 50 * 3)
    })
})

describe('a move under a group', () => {
    it('writes nothing to a group row and clears nothing on its account', () => {
        const grid = makeGrid()
        const state = getRangeSelection(grid)!
        const groupRow = grid.nodes.findIndex((node) => node.meta?.expandable)
        const first = dataRowIndex(grid, '1')

        state.cutSource = { top: first, left: 1, bottom: first, right: 1 }
        expect(state.moveRange(groupRow, 1)).toBe(false)
        expect(grid.data[0]!.unit).toBe(50)
    })
})
