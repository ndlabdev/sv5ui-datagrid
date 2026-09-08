import { describe, expect, it } from 'vitest'
import { type ColumnDef } from '../../core/types/index.js'
import {
    inferKind,
    isFilterable,
    kindOf,
    needsList,
    needsRange,
    needsValue,
    opForKind,
    opsFor
} from './operators.js'

interface Row {
    id: number
}

const def = (partial: Partial<ColumnDef<Row>>): ColumnDef<Row> => ({
    id: 'x',
    header: 'X',
    ...partial
})

describe('what kind of filter a column wants', () => {
    it('believes what the column declared', () => {
        expect(kindOf(def({ filter: 'number' }))).toBe('number')
        expect(kindOf(def({ filter: 'date' }))).toBe('date')
        expect(kindOf(def({ filter: 'set' }))).toBe('set')
        expect(kindOf(def({ filter: 'boolean' }))).toBe('boolean')
    })

    it('reads an advanced filter definition too', () => {
        expect(kindOf(def({ filter: { type: 'number' } }))).toBe('number')
    })

    it('reads the renderer when no filter was declared', () => {
        expect(kindOf(def({ type: 'currency' }))).toBe('number')
        expect(kindOf(def({ type: 'percent' }))).toBe('number')
        expect(kindOf(def({ type: 'datetime' }))).toBe('date')
        expect(kindOf(def({ type: 'boolean' }))).toBe('boolean')
        expect(kindOf(def({ type: 'badge' }))).toBe('text')
    })

    it('falls back to text, including for no column at all', () => {
        expect(kindOf(def({}))).toBe('text')
        expect(kindOf(undefined)).toBe('text')
    })
})

describe('which operators a kind offers', () => {
    it('never offers startsWith on a number, or gt on text', () => {
        expect(opsFor('number')).not.toContain('startsWith')
        expect(opsFor('text')).not.toContain('gt')
        expect(opsFor('date')).toContain('before')
        expect(opsFor('boolean')).toEqual(['equals', 'notEqual', 'blank', 'notBlank'])
    })

    it('keeps an operator that survives a column change, and replaces one that does not', () => {
        expect(opForKind('gt', 'number')).toBe('gt')
        expect(opForKind('gt', 'text')).toBe('contains')
        expect(opForKind('contains', 'date')).toBe('equals')
    })
})

describe('what a condition needs typed into it', () => {
    it('knows which operators carry a value, a range or a list', () => {
        expect(needsValue('blank')).toBe(false)
        expect(needsValue('equals')).toBe(true)
        expect(needsRange('between')).toBe(true)
        expect(needsRange('gt')).toBe(false)
        expect(needsList('in')).toBe(true)
    })
})

describe('a column the panel should not offer', () => {
    const def = (extra: Partial<ColumnDef<Record<string, unknown>>>) =>
        ({ id: 'c', ...extra }) as ColumnDef<Record<string, unknown>>

    it('takes filter: false as the refusal it is', () => {
        expect(isFilterable(def({ filter: false }))).toBe(false)
    })

    it('leaves out an actions column, which holds no value to compare', () => {
        expect(isFilterable(def({ type: 'actions' }))).toBe(false)
    })

    it('offers every other type, declared or not', () => {
        for (const type of [
            'text',
            'number',
            'currency',
            'percent',
            'date',
            'datetime',
            'boolean',
            'badge',
            'user',
            'progress',
            'rating',
            'link'
        ] as const) {
            expect(isFilterable(def({ type })), type).toBe(true)
        }
    })
})

describe('inferKind on a column that declares nothing', () => {
    it('reads real Date objects as dates, not as their epoch milliseconds', () => {
        expect(inferKind([new Date(2026, 0, 15)])).toBe('date')
        expect(inferKind([new Date(2026, 0, 15), new Date(2026, 1, 20)])).toBe('date')
        expect(opsFor(inferKind([new Date(2026, 0, 15)]))).toContain('before')
    })

    it('still reads a column of plain numbers as numbers', () => {
        expect(inferKind([2020, 2021, 2022])).toBe('number')
        expect(inferKind(['12', '34'])).toBe('number')
        expect(inferKind([null, null, null, 5, 6])).toBe('number')
    })

    it('reads a date written as a string, and mixed shapes, as dates', () => {
        expect(inferKind(['2026-01-15'])).toBe('date')
        expect(inferKind([new Date(2026, 0, 15), '2026-02-20'])).toBe('date')
    })
})
