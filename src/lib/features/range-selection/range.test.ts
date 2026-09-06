import { describe, expect, it } from 'vitest'
import {
    boundsOf,
    cellsOf,
    clampRange,
    containsCell,
    isInAnyRange,
    parseTsv,
    pasteTargets,
    rangeBetween,
    rangeCols,
    rangeRows,
    rangeSize
} from './range.js'

describe('rangeBetween', () => {
    it('normalises whichever corner came first', () => {
        const forward = rangeBetween({ row: 1, col: 2 }, { row: 3, col: 5 })
        const backward = rangeBetween({ row: 3, col: 5 }, { row: 1, col: 2 })
        expect(forward).toEqual({ top: 1, left: 2, bottom: 3, right: 5 })
        expect(backward).toEqual(forward)
    })

    it('makes a single cell when both corners match', () => {
        expect(rangeBetween({ row: 2, col: 2 }, { row: 2, col: 2 })).toEqual({
            top: 2,
            left: 2,
            bottom: 2,
            right: 2
        })
    })
})

describe('membership', () => {
    const range = { top: 1, left: 1, bottom: 2, right: 3 }

    it('includes the edges and excludes the outside', () => {
        expect(containsCell(range, 1, 1)).toBe(true)
        expect(containsCell(range, 2, 3)).toBe(true)
        expect(containsCell(range, 0, 1)).toBe(false)
        expect(containsCell(range, 2, 4)).toBe(false)
    })

    it('checks several ranges at once', () => {
        const other = { top: 5, left: 0, bottom: 5, right: 0 }
        expect(isInAnyRange([range, other], 5, 0)).toBe(true)
        expect(isInAnyRange([range, other], 4, 0)).toBe(false)
        expect(isInAnyRange([], 1, 1)).toBe(false)
    })
})

describe('measurements', () => {
    it('counts rows, columns and cells', () => {
        const range = { top: 1, left: 1, bottom: 2, right: 3 }
        expect(rangeRows(range)).toBe(2)
        expect(rangeCols(range)).toBe(3)
        expect(rangeSize(range)).toBe(6)
    })

    it('walks cells row-major', () => {
        expect(cellsOf({ top: 0, left: 0, bottom: 1, right: 1 })).toEqual([
            { row: 0, col: 0 },
            { row: 0, col: 1 },
            { row: 1, col: 0 },
            { row: 1, col: 1 }
        ])
    })

    it('bounds several ranges', () => {
        expect(
            boundsOf([
                { top: 3, left: 0, bottom: 4, right: 1 },
                { top: 1, left: 2, bottom: 2, right: 5 }
            ])
        ).toEqual({ top: 1, left: 0, bottom: 4, right: 5 })
        expect(boundsOf([])).toBeNull()
    })
})

describe('clampRange', () => {
    it('trims to the grid', () => {
        expect(clampRange({ top: -2, left: 0, bottom: 99, right: 99 }, 4, 2)).toEqual({
            top: 0,
            left: 0,
            bottom: 4,
            right: 2
        })
    })

    it('returns null when the range starts past the grid', () => {
        expect(clampRange({ top: 9, left: 0, bottom: 12, right: 1 }, 4, 2)).toBeNull()
    })
})

describe('pasteTargets', () => {
    it('drops a block at a single-cell target', () => {
        const targets = pasteTargets({ top: 2, left: 1, bottom: 2, right: 1 }, 2, 2)
        expect(targets).toHaveLength(4)
        expect(targets[0]).toEqual({ row: 2, col: 1, blockRow: 0, blockCol: 0 })
        expect(targets[3]).toEqual({ row: 3, col: 2, blockRow: 1, blockCol: 1 })
    })

    it('repeats the block to fill a larger target, like a spreadsheet', () => {
        const targets = pasteTargets({ top: 0, left: 0, bottom: 3, right: 1 }, 2, 1)
        expect(targets).toHaveLength(8)
        expect(targets.map((t) => t.blockRow)).toEqual([0, 0, 1, 1, 0, 0, 1, 1])
        expect(targets.every((t) => t.blockCol === 0)).toBe(true)
    })

    it('returns nothing for an empty block', () => {
        expect(pasteTargets({ top: 0, left: 0, bottom: 2, right: 2 }, 0, 0)).toEqual([])
    })
})

describe('parseTsv', () => {
    it('splits rows and columns', () => {
        expect(parseTsv('a\tb\nc\td')).toEqual([
            ['a', 'b'],
            ['c', 'd']
        ])
    })

    it('accepts CRLF and ignores a trailing newline', () => {
        expect(parseTsv('a\tb\r\nc\td\r\n')).toEqual([
            ['a', 'b'],
            ['c', 'd']
        ])
    })

    it('keeps empty cells', () => {
        expect(parseTsv('a\t\tc')).toEqual([['a', '', 'c']])
    })

    it('returns nothing for empty text', () => {
        expect(parseTsv('')).toEqual([])
        expect(parseTsv('\n')).toEqual([])
    })
})
