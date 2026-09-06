import { type ColumnState } from '../../core/types/index.js'
import { describe, expect, it } from 'vitest'
import { markSyntheticRow } from '../../core/grid/index.js'
import {
    columnMap,
    computeStats,
    dataRowsOf,
    hasNumbers,
    sampleDataRows,
    type KeyStats,
    type ScaleStats,
    type ThresholdStats
} from './stats.js'

interface Row {
    id: number
    value: number
    email: string
}

const rows: Row[] = [
    { id: 1, value: 10, email: 'a@x.com' },
    { id: 2, value: 40, email: 'b@x.com' },
    { id: 3, value: 25, email: 'a@x.com' },
    { id: 4, value: 5, email: '' }
]

/** The statistics walk nodes now, so that a masked column reads as masked. */
const nodesOf = <T>(list: readonly T[]) =>
    list.map((row, index) => ({ id: String(index), row, index }))

const nodes = nodesOf(rows)

const columns = columnMap([
    { id: 'value', def: { id: 'value' } },
    { id: 'email', def: { id: 'email' } }
] as unknown as ColumnState<Row>[])

describe('computeStats', () => {
    it('spans a colour scale over the values the grid holds', () => {
        const [stats] = computeStats([{ kind: 'colorScale', column: 'value' }], nodes, columns)
        expect(stats as ScaleStats).toMatchObject({ min: 5, max: 40 })
    })

    it('lets the rule override either end', () => {
        const [stats] = computeStats(
            [{ kind: 'colorScale', column: 'value', min: 0, max: 100 }],
            nodes,
            columns
        )
        expect(stats as ScaleStats).toMatchObject({ min: 0, max: 100 })
    })

    it('bases a data bar at zero when every value is positive', () => {
        const [stats] = computeStats([{ kind: 'dataBar', column: 'value' }], nodes, columns)
        expect(stats as ScaleStats).toMatchObject({ min: 0, max: 40 })
    })

    it('keeps a negative floor for a data bar that has one', () => {
        const [stats] = computeStats(
            [{ kind: 'dataBar', column: 'value' }],
            nodesOf([...rows, { id: 5, value: -20, email: 'c@x.com' }]),
            columns
        )
        expect(stats as ScaleStats).toMatchObject({ min: -20, max: 40 })
    })

    it('collects the repeated values, ignoring blanks', () => {
        const [stats] = computeStats([{ kind: 'duplicates', column: 'email' }], nodes, columns)
        expect([...(stats as KeyStats).keys]).toEqual(['a@x.com'])
    })

    it('collects the values seen once when asked for the unique ones', () => {
        const [stats] = computeStats(
            [{ kind: 'duplicates', column: 'email', unique: true }],
            nodes,
            columns
        )
        expect([...(stats as KeyStats).keys]).toEqual(['b@x.com'])
    })

    it('reads the threshold off the nth value from the top', () => {
        const [stats] = computeStats([{ kind: 'topN', column: 'value', n: 2 }], nodes, columns)
        expect((stats as ThresholdStats).value).toBe(25)
    })

    it('reads it from the bottom when asked', () => {
        const [stats] = computeStats(
            [{ kind: 'topN', column: 'value', n: 2, bottom: true }],
            nodes,
            columns
        )
        expect((stats as ThresholdStats).value).toBe(10)
    })

    it('asks for more rows than exist without inventing a threshold', () => {
        const [stats] = computeStats([{ kind: 'topN', column: 'value', n: 99 }], nodes, columns)
        expect((stats as ThresholdStats).value).toBe(5)
    })

    it('survives a column the rule names but the grid does not have', () => {
        const [stats] = computeStats([{ kind: 'colorScale', column: 'ghost' }], nodes, columns)
        expect(stats as ScaleStats).toMatchObject({ min: 0, max: 0 })
    })

    it('gives an expression rule a cache rather than a pass over the rows', () => {
        const [stats] = computeStats([{ kind: 'expression', when: 'value > 1' }], nodes, columns)
        expect(stats).toEqual({ kind: 'expression', cache: new Map() })
    })
})

describe('hasNumbers', () => {
    it('says yes for a column holding numbers', () => {
        expect(hasNumbers(nodes, columns.get('value'))).toBe(true)
    })

    it('says no for a column of text, which a scale or a bar cannot read', () => {
        expect(hasNumbers(nodes, columns.get('email'))).toBe(false)
    })

    it('says no for a column the grid does not have', () => {
        expect(hasNumbers(nodes, undefined)).toBe(false)
    })

    it('looks past a leading blank rather than giving up on the first row', () => {
        const withGap = [{ id: 0, value: null as unknown as number, email: '' }, ...rows]
        expect(hasNumbers(nodesOf(withGap), columns.get('value'))).toBe(true)
    })

    it('reads only the sample it was given', () => {
        expect(hasNumbers(nodes, columns.get('value'), undefined, 0)).toBe(false)
    })
})

describe('sampleDataRows', () => {
    const manyNodes = (count: number) =>
        Array.from({ length: count }, (_, i) => ({
            id: String(i),
            row: rows[i % rows.length]!,
            index: i
        }))

    it('stops as soon as it has the sample, whatever the grid holds', () => {
        let read = 0
        const many = new Proxy(manyNodes(100_000), {
            get(target, key) {
                if (typeof key === 'string' && /^\d+$/.test(key)) read++
                return Reflect.get(target, key)
            }
        })

        expect(sampleDataRows(many, 3)).toHaveLength(3)
        expect(read).toBeLessThan(10)
    })

    it('skips the rows a feature synthesized, so a group total is not the sample', () => {
        const nodes = [
            { id: 'group:a', row: markSyntheticRow(rows[0]!), index: 0 },
            { id: '2', row: rows[1]!, index: 1 }
        ]
        expect(sampleDataRows(nodes, 5).map((node) => node.row)).toEqual([rows[1]])
    })
})

describe('dataRowsOf', () => {
    it('keeps the rows the predicate calls data', () => {
        const listed = rows.map((row) => ({ id: String(row.id), row, index: row.id }))
        const kept = dataRowsOf(listed, (node) => node.id !== '2')
        expect(kept.map((node) => node.row.id)).toEqual([1, 3, 4])
    })
})
