import { describe, expect, it } from 'vitest'
import { continueSeries, fillCells, fillTargetOf } from './fill.js'
import type { CellRange } from './range.js'

describe('continueSeries', () => {
    it('returns nothing to fill for an empty source or count', () => {
        expect(continueSeries([], 3)).toEqual([])
        expect(continueSeries([1, 2], 0)).toEqual([])
        expect(continueSeries([1, 2], -1)).toEqual([])
    })

    describe('numbers', () => {
        it('continues a run', () => {
            expect(continueSeries([1, 2, 3], 3)).toEqual([4, 5, 6])
            expect(continueSeries([5, 10], 3)).toEqual([15, 20, 25])
        })

        it('runs backwards and through zero', () => {
            expect(continueSeries([10, 8], 3)).toEqual([6, 4, 2])
            expect(continueSeries([2, 1], 3)).toEqual([0, -1, -2])
        })

        it('repeats a single number instead of inventing a run', () => {
            expect(continueSeries([7], 3)).toEqual([7, 7, 7])
        })

        it('repeats when the steps are uneven', () => {
            expect(continueSeries([1, 2, 4], 3)).toEqual([1, 2, 4])
        })

        it('keeps a fractional step', () => {
            expect(continueSeries([1, 1.5], 2)).toEqual([2, 2.5])
        })
    })

    describe('dates', () => {
        const iso = (value: string) => value

        it('continues a daily run', () => {
            expect(continueSeries([iso('2026-01-01'), iso('2026-01-02')], 2)).toEqual([
                '2026-01-03',
                '2026-01-04'
            ])
        })

        it('continues a weekly run', () => {
            expect(continueSeries([iso('2026-01-01'), iso('2026-01-08')], 2)).toEqual([
                '2026-01-15',
                '2026-01-22'
            ])
        })

        it('steps by month rather than by the days between months', () => {
            expect(
                continueSeries([iso('2026-01-01'), iso('2026-02-01'), iso('2026-03-01')], 2)
            ).toEqual(['2026-04-01', '2026-05-01'])
        })

        it('crosses a year boundary on a monthly run', () => {
            expect(continueSeries([iso('2026-11-01'), iso('2026-12-01')], 2)).toEqual([
                '2027-01-01',
                '2027-02-01'
            ])
        })

        it('hands back Date objects when it was given Date objects', () => {
            const result = continueSeries([new Date(2026, 0, 1), new Date(2026, 0, 2)], 1)
            expect(result[0]).toBeInstanceOf(Date)
            expect((result[0] as Date).getDate()).toBe(3)
        })

        it('repeats a single date', () => {
            expect(continueSeries([iso('2026-01-01')], 2)).toEqual(['2026-01-01', '2026-01-01'])
        })
    })

    describe('text with a trailing number', () => {
        it('continues the number and keeps the prefix', () => {
            expect(continueSeries(['Item 1', 'Item 2'], 2)).toEqual(['Item 3', 'Item 4'])
            expect(continueSeries(['Q1', 'Q2'], 2)).toEqual(['Q3', 'Q4'])
        })

        it('keeps zero padding, because that is what the column looks like', () => {
            expect(continueSeries(['row-07', 'row-08'], 2)).toEqual(['row-09', 'row-10'])
        })

        it('repeats when the prefixes differ', () => {
            expect(continueSeries(['Item 1', 'Thing 2'], 2)).toEqual(['Item 1', 'Thing 2'])
        })

        it('repeats plain text with no number to continue', () => {
            expect(continueSeries(['Core', 'Data'], 4)).toEqual(['Core', 'Data', 'Core', 'Data'])
        })

        it('does not run a number negative', () => {
            expect(continueSeries(['x3', 'x2'], 4)).toEqual(['x1', 'x0', 'x0', 'x0'])
        })
    })

    describe('anything else', () => {
        it('repeats a mixed block cyclically', () => {
            expect(continueSeries([1, 'a'], 4)).toEqual([1, 'a', 1, 'a'])
        })

        it('repeats booleans and nulls rather than guessing', () => {
            expect(continueSeries([true, false], 3)).toEqual([true, false, true])
            expect(continueSeries([null], 2)).toEqual([null, null])
        })
    })
})

const source: CellRange = { top: 1, left: 1, bottom: 2, right: 2 }

describe('fillTargetOf', () => {
    it('reads nothing while the pointer is still inside the source', () => {
        expect(fillTargetOf(source, 2, 2)).toBeNull()
        expect(fillTargetOf(source, 1, 1)).toBeNull()
    })

    it('extends on whichever side the drag has been pulled furthest', () => {
        expect(fillTargetOf(source, 5, 2)).toEqual({
            axis: 'down',
            range: { top: 3, left: 1, bottom: 5, right: 2 }
        })
        expect(fillTargetOf(source, 2, 6)).toEqual({
            axis: 'right',
            range: { top: 1, left: 3, bottom: 2, right: 6 }
        })
        expect(fillTargetOf(source, 0, 2)?.axis).toBe('up')
        expect(fillTargetOf(source, 2, 0)?.axis).toBe('left')
    })

    it('picks one axis for a diagonal drag rather than an L', () => {
        expect(fillTargetOf(source, 6, 3)).toEqual({
            axis: 'down',
            range: { top: 3, left: 1, bottom: 6, right: 2 }
        })
    })
})

describe('fillCells', () => {
    const read = (row: number, col: number): unknown => (col === 1 ? row * 10 : `Item ${row}`)

    it('carries each column its own series when filling down', () => {
        const target = fillTargetOf(source, 4, 2)!
        expect(fillCells(source, target, { read })).toEqual([
            { row: 3, col: 1, value: 30 },
            { row: 4, col: 1, value: 40 },
            { row: 3, col: 2, value: 'Item 3' },
            { row: 4, col: 2, value: 'Item 4' }
        ])
    })

    it('runs the series upward when the drag goes up', () => {
        const target = fillTargetOf(source, 0, 2)!

        expect(fillCells(source, target, { read })).toEqual([
            { row: 0, col: 1, value: 0 },
            { row: 0, col: 2, value: 'Item 0' }
        ])
    })

    it('carries each row its own series when filling right', () => {
        const byColumn = (row: number, col: number): unknown => row * 100 + col
        const target = fillTargetOf(source, 2, 4)!
        expect(fillCells(source, target, { read: byColumn })).toEqual([
            { row: 1, col: 3, value: 103 },
            { row: 1, col: 4, value: 104 },
            { row: 2, col: 3, value: 203 },
            { row: 2, col: 4, value: 204 }
        ])
    })

    it('repeats a block that carries no run', () => {
        const words = (row: number): unknown => (row === 1 ? 'Core' : 'Data')
        const target = fillTargetOf(source, 6, 2)!
        expect(fillCells(source, target, { read: words }).map((cell) => cell.value)).toEqual([
            'Core',
            'Data',
            'Core',
            'Data',
            'Core',
            'Data',
            'Core',
            'Data'
        ])
    })
})

describe('rows that are not data', () => {
    const isDataRow = (row: number) => row !== 2
    const numbers = (row: number): unknown => (row === 2 ? null : row)

    it('keeps the run continuous across one, instead of letting it eat a step', () => {
        const from: CellRange = { top: 0, left: 0, bottom: 1, right: 0 }
        const target = fillTargetOf(from, 4, 0)!

        expect(fillCells(from, target, { read: numbers, isDataRow })).toEqual([
            { row: 3, col: 0, value: 2 },
            { row: 4, col: 0, value: 3 }
        ])
    })

    it('keeps one out of the source, so its blank does not break the run', () => {
        const from: CellRange = { top: 1, left: 0, bottom: 2, right: 0 }
        const target = fillTargetOf(from, 4, 0)!

        expect(fillCells(from, target, { read: numbers, isDataRow })).toEqual([
            { row: 3, col: 0, value: 1 },
            { row: 4, col: 0, value: 1 }
        ])
    })

    it('drops one whole when the fill runs sideways', () => {
        const from: CellRange = { top: 1, left: 0, bottom: 2, right: 0 }
        const target = fillTargetOf(from, 2, 2)!

        expect(fillCells(from, target, { read: numbers, isDataRow })).toEqual([
            { row: 1, col: 1, value: 1 },
            { row: 1, col: 2, value: 1 }
        ])
    })
})
