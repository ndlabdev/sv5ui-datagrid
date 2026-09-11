import { createDataGrid, type ColumnDef } from '$lib/index.js'
import { describe, expect, it } from 'vitest'
import { findReplace, getFindReplace } from '$lib/index.js'
import { formula } from '$lib/index.js'
import { grouping } from '$lib/index.js'
import { getRangeSelection, rangeSelection } from '$lib/index.js'
import { buildGridXlsx } from '$lib/xlsx.js'

interface Row {
    id: number
    a: unknown
    b: unknown
}

const columns: ColumnDef<Row>[] = [
    { id: 'a', header: 'A' },
    { id: 'b', header: 'B' }
]

const LONE_SURROGATE = String.fromCharCode(0xd800)

const hostile: Row[] = [
    { id: 1, a: undefined, b: null },
    { id: 2, a: NaN, b: Infinity },
    { id: 3, a: '', b: '   ' },
    { id: 4, a: new Date('nope'), b: new Date(0) },
    { id: 5, a: { nested: 1 }, b: [1, 2] },
    { id: 6, a: LONE_SURROGATE, b: 'x'.repeat(50_000) },
    { id: 7, a: -0, b: 1e308 * 10 },
    { id: 8, a: Symbol('s'), b: () => 1 },
    { id: 9, a: 9007199254740993n, b: new Map() }
]

function build(features: unknown[] = [], data: Row[] = hostile) {
    return createDataGrid<Row>({
        columns,
        data,
        getRowId: (row) => String(row.id),
        features: features as never
    })
}

describe('values an app can put in a row, and the grid must survive', () => {
    it('exports them', () => {
        expect(() => buildGridXlsx(build())).not.toThrow()
    })

    it('groups on a column of them', () => {
        const grid = build([grouping<Row>({ by: ['a'], aggregations: { b: 'sum' } })])
        expect(() => grid.nodes.length).not.toThrow()
        expect(() => buildGridXlsx(grid)).not.toThrow()
    })

    it('computes a formula over them', () => {
        const grid = build([formula<Row>({ columns: { b: 'a * 2 & "-" & UPPER(a) & LEN(a)' } })])
        expect(() => grid.preWindowNodes.map((node) => node.row.b)).not.toThrow()
    })

    it('runs a range selection over them', () => {
        const grid = build([rangeSelection()])
        void grid.preWindowNodes

        const range = getRangeSelection(grid)!
        range.startRange(0, 0)
        range.extendTo(hostile.length - 1, 1)

        expect(() => range.selectedValues).not.toThrow()
    })

    it('exports an empty grid, and one with no columns', () => {
        expect(() => buildGridXlsx(build([], []))).not.toThrow()

        const none = createDataGrid<Row>({
            columns: [],
            data: hostile,
            getRowId: (row) => String(row.id)
        })
        expect(() => buildGridXlsx(none)).not.toThrow()
    })
})

describe('a Date the app never checked', () => {
    const withBadDate: Row[] = [{ id: 1, a: new Date('nope'), b: 'keep' }]

    it('does not take the find box down when the user types', () => {
        const grid = build([findReplace()], withBadDate)
        void grid.preWindowNodes

        const find = getFindReplace(grid)!
        find.show()
        find.query = 'keep'

        expect(() => find.total).not.toThrow()
        expect(find.total).toBe(1)
    })

    it('is findable by the text it prints as', () => {
        const grid = build([findReplace()], withBadDate)
        void grid.preWindowNodes

        const find = getFindReplace(grid)!
        find.show()
        find.query = 'Invalid Date'

        expect(find.total).toBe(1)
    })

    it('becomes an error value in a formula rather than an exception', () => {
        const grid = build([formula<Row>({ columns: { b: '"on " & a' } })], withBadDate)

        expect(() => grid.preWindowNodes).not.toThrow()
        expect(grid.preWindowNodes[0]?.row.b).toBe('#VALUE')
    })

    it('compares as an error rather than silently answering false', () => {
        const grid = build(
            [formula<Row>({ columns: { b: 'IF(a > a, "yes", "no")' } })],
            withBadDate
        )

        expect(grid.preWindowNodes[0]?.row.b).toBe('#VALUE')
    })

    it('still exports, because the writer already wrote such a date as text', () => {
        expect(() => buildGridXlsx(build([], withBadDate))).not.toThrow()
    })
})
