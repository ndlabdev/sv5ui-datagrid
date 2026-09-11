import { describe, expect, it } from 'vitest'
import { buildMoveEdits, movePairs, toHtmlTable } from './range-clipboard.js'
import type { CellRange } from './range.js'

const rowIds = ['r0', 'r1', 'r2', 'r3']
const columnIds = ['a', 'b', 'c']

function resolve(row: number, col: number) {
    const rowId = rowIds[row]
    const columnId = columnIds[col]
    return rowId && columnId ? { rowId, columnId } : null
}

describe('toHtmlTable', () => {
    it('writes a table a word processor can read', () => {
        expect(
            toHtmlTable([
                ['a', 'b'],
                ['c', 'd']
            ])
        ).toBe('<table><tr><td>a</td><td>b</td></tr><tr><td>c</td><td>d</td></tr></table>')
    })

    it('escapes what would otherwise become markup', () => {
        expect(toHtmlTable([['<b>&"']])).toBe(
            '<table><tr><td>&lt;b&gt;&amp;&quot;</td></tr></table>'
        )
    })

    it('forces text on a cell a spreadsheet would read as a formula', () => {
        for (const risky of ['=SUM(A1)', '+1', '@name', '-SUM(A1)']) {
            expect(toHtmlTable([[risky]])).toContain('mso-number-format')
        }
    })

    it('leaves a negative number alone, because it is a number', () => {
        expect(toHtmlTable([['-42.5']])).toBe('<table><tr><td>-42.5</td></tr></table>')
    })

    it('writes nothing for an empty matrix', () => {
        expect(toHtmlTable([])).toBe('')
    })
})

describe('movePairs', () => {
    it('keeps the block shape while shifting its origin', () => {
        const source: CellRange = { top: 1, left: 0, bottom: 2, right: 1 }
        expect(movePairs(source, 5, 3)).toEqual([
            { from: { row: 1, col: 0 }, to: { row: 5, col: 3 } },
            { from: { row: 1, col: 1 }, to: { row: 5, col: 4 } },
            { from: { row: 2, col: 0 }, to: { row: 6, col: 3 } },
            { from: { row: 2, col: 1 }, to: { row: 6, col: 4 } }
        ])
    })
})

describe('buildMoveEdits', () => {
    const read = (row: number, col: number) => `${row}${col}`
    const canRead = (row: number, col: number) => resolve(row, col) !== null

    it('writes the values across and clears where they came from', () => {
        const source: CellRange = { top: 0, left: 0, bottom: 0, right: 1 }
        expect(buildMoveEdits(source, 1, 0, { canRead, read, resolve })).toEqual([
            { rowId: 'r1', changes: { a: '00', b: '01' } },
            { rowId: 'r0', changes: { a: null, b: null } }
        ])
    })

    it('clears only the part of the source the block moved off', () => {
        const source: CellRange = { top: 0, left: 0, bottom: 1, right: 0 }
        const edits = buildMoveEdits(source, 1, 0, { canRead, read, resolve })
        expect(edits).toEqual([
            { rowId: 'r1', changes: { a: '00' } },
            { rowId: 'r2', changes: { a: '10' } },
            { rowId: 'r0', changes: { a: null } }
        ])
    })

    it('does not clear a cell whose value had nowhere to land', () => {
        const source: CellRange = { top: 0, left: 0, bottom: 0, right: 2 }
        const edits = buildMoveEdits(source, 0, 1, { canRead, read, resolve })
        expect(edits).toEqual([{ rowId: 'r0', changes: { b: '00', c: '01', a: null } }])
    })

    it('writes nothing when the whole block lands off the grid', () => {
        const source: CellRange = { top: 0, left: 0, bottom: 0, right: 0 }
        expect(buildMoveEdits(source, 99, 0, { canRead, read, resolve })).toEqual([])
    })
})
