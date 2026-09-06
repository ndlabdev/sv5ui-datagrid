import { describe, expect, it } from 'vitest'
import { aggregate } from './aggregate.js'

interface Row {
    n: number
}

const rows: Row[] = [{ n: 1 }, { n: 2 }, { n: 3 }]

describe('aggregate', () => {
    it('sums, mins, maxes and averages numeric values', () => {
        const values = [10, 20, 30]
        expect(aggregate('sum', values, rows)).toBe(60)
        expect(aggregate('min', values, rows)).toBe(10)
        expect(aggregate('max', values, rows)).toBe(30)
        expect(aggregate('avg', values, rows)).toBe(20)
    })

    it('counts rows rather than values', () => {
        expect(aggregate('count', [1], rows)).toBe(3)
        expect(aggregate('count', [], [])).toBe(0)
    })

    it('skips nullish, empty and non-numeric entries', () => {
        const values = [10, null, undefined, '', 'abc', '20']
        expect(aggregate('sum', values, rows)).toBe(30)
        expect(aggregate('avg', values, rows)).toBe(15)
    })

    it('returns null when nothing numeric is left', () => {
        expect(aggregate('sum', [null, 'abc'], rows)).toBeNull()
        expect(aggregate('max', [], rows)).toBeNull()
    })

    it('takes the median, interpolating between the middle two', () => {
        expect(aggregate('median', [3, 1, 2], rows)).toBe(2)
        expect(aggregate('median', [1, 2, 3, 4], rows)).toBe(2.5)
        expect(aggregate('median', ['10', null, '30'], rows)).toBe(20)
        expect(aggregate('median', ['abc'], rows)).toBeNull()
    })

    it('interpolates a percentile the way a spreadsheet does', () => {
        const values = [1, 2, 3, 4]
        expect(aggregate({ kind: 'percentile', p: 0 }, values, rows)).toBe(1)
        expect(aggregate({ kind: 'percentile', p: 1 }, values, rows)).toBe(4)
        expect(aggregate({ kind: 'percentile', p: 0.5 }, values, rows)).toBe(2.5)
        expect(aggregate({ kind: 'percentile', p: 0.9 }, values, rows)).toBeCloseTo(3.7)
    })

    it('clamps a percentile asked for outside 0 to 1, rather than returning undefined', () => {
        expect(aggregate({ kind: 'percentile', p: 90 }, [1, 2, 3], rows)).toBe(3)
        expect(aggregate({ kind: 'percentile', p: -1 }, [1, 2, 3], rows)).toBe(1)
        expect(aggregate({ kind: 'percentile', p: 0.5 }, [], rows)).toBeNull()
    })

    it('counts distinct non-blank values, matching dates by their instant', () => {
        expect(aggregate('distinctCount', ['a', 'b', 'a'], rows)).toBe(2)
        expect(aggregate('distinctCount', [null, undefined, ''], rows)).toBe(0)
        const day = '2026-08-26T00:00:00.000Z'
        expect(aggregate('distinctCount', [new Date(day), new Date(day)], rows)).toBe(1)
    })

    it('returns the first and last value that is actually there', () => {
        const values = [null, 'b', '', 'c', undefined]
        expect(aggregate('first', values, rows)).toBe('b')
        expect(aggregate('last', values, rows)).toBe('c')
        expect(aggregate('first', [null, ''], rows)).toBeNull()
        expect(aggregate('last', [], rows)).toBeNull()
    })

    it('weights an average by a value read off each row', () => {
        interface Score {
            score: number
            credits: number
        }
        const scores: Score[] = [
            { score: 8, credits: 3 },
            { score: 6, credits: 1 }
        ]
        const weight = { kind: 'weightedAvg' as const, weight: (row: Score) => row.credits }
        expect(aggregate(weight, [8, 6], scores)).toBe(7.5)
        expect(aggregate(weight, [8, 'abc'], scores)).toBe(8)
        expect(aggregate({ ...weight, weight: () => 0 }, [8, 6], scores)).toBeNull()
        expect(aggregate(weight, [], [])).toBeNull()
    })

    it('supports a custom reducer receiving values and rows', () => {
        const joined = aggregate<Row>(
            (values, groupRows) => `${values.length}/${groupRows.length}`,
            [1, 2],
            rows
        )
        expect(joined).toBe('2/3')
    })
})

describe('a column the size this grid is built for', () => {
    it('takes a minimum and a maximum without spreading the column', () => {
        const many = Array.from({ length: 200_000 }, (_, index) => index)

        expect(aggregate('min', many, [])).toBe(0)
        expect(aggregate('max', many, [])).toBe(199_999)
    })
})
