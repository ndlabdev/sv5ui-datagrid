import { describe, expect, it, vi } from 'vitest'
import { buildRowNodes } from '../../core/grid/row-node.js'
import type { ColumnDef, ColumnFilter } from '../../core/types.js'
import { DISTINCT_VALUES_CAP, distinctValues } from './distinct-values.js'
import {
    compileColumnFilters,
    describeFilter,
    filterTypeOf,
    valuePredicateFor
} from './filter-predicates.js'

function passes(filter: ColumnFilter, value: unknown): boolean {
    return valuePredicateFor(filter)(value)
}

describe('text predicates', () => {
    it('covers every op case-insensitively', () => {
        expect(passes({ kind: 'text', op: 'contains', value: 'ali' }, 'Alice')).toBe(true)
        expect(passes({ kind: 'text', op: 'contains', value: 'xyz' }, 'Alice')).toBe(false)
        expect(passes({ kind: 'text', op: 'equals', value: 'ALICE' }, 'Alice')).toBe(true)
        expect(passes({ kind: 'text', op: 'startsWith', value: 'al' }, 'Alice')).toBe(true)
        expect(passes({ kind: 'text', op: 'endsWith', value: 'ce' }, 'Alice')).toBe(true)
        expect(passes({ kind: 'text', op: 'blank', value: '' }, '')).toBe(true)
        expect(passes({ kind: 'text', op: 'blank', value: '' }, null)).toBe(true)
        expect(passes({ kind: 'text', op: 'blank', value: '' }, 'x')).toBe(false)
        expect(passes({ kind: 'text', op: 'contains', value: 'a' }, null)).toBe(false)
    })
})

describe('number predicates', () => {
    it('covers comparison ops and between boundaries', () => {
        expect(passes({ kind: 'number', op: 'eq', value: 5 }, 5)).toBe(true)
        expect(passes({ kind: 'number', op: 'neq', value: 5 }, 6)).toBe(true)
        expect(passes({ kind: 'number', op: 'neq', value: 5 }, null)).toBe(false)
        expect(passes({ kind: 'number', op: 'gt', value: 5 }, 6)).toBe(true)
        expect(passes({ kind: 'number', op: 'gte', value: 5 }, 5)).toBe(true)
        expect(passes({ kind: 'number', op: 'lt', value: 5 }, 4)).toBe(true)
        expect(passes({ kind: 'number', op: 'lte', value: 5 }, 5)).toBe(true)
        expect(passes({ kind: 'number', op: 'between', value: 10, to: 20 }, 10)).toBe(true)
        expect(passes({ kind: 'number', op: 'between', value: 10, to: 20 }, 20)).toBe(true)
        expect(passes({ kind: 'number', op: 'between', value: 10, to: 20 }, 21)).toBe(false)
        expect(passes({ kind: 'number', op: 'blank', value: undefined }, null)).toBe(true)
        expect(passes({ kind: 'number', op: 'gt', value: 5 }, null)).toBe(false)
    })

    it('rejects blanks in a between range spanning zero', () => {
        const range: ColumnFilter = { kind: 'number', op: 'between', value: -10, to: 10 }
        expect(passes(range, null)).toBe(false)
        expect(passes(range, undefined)).toBe(false)
        expect(passes(range, '')).toBe(false)
        expect(passes(range, 0)).toBe(true)
    })
})

describe('date predicates', () => {
    it('compares by day, accepting ISO strings and Date objects', () => {
        const filter: ColumnFilter = { kind: 'date', op: 'equals', value: '2026-01-15' }
        expect(passes(filter, '2026-01-15')).toBe(true)
        expect(passes(filter, new Date('2026-01-15T23:59:00Z'))).toBe(true)
        expect(passes(filter, '2026-01-16')).toBe(false)

        expect(passes({ kind: 'date', op: 'before', value: '2026-01-15' }, '2026-01-14')).toBe(true)
        expect(passes({ kind: 'date', op: 'after', value: '2026-01-15' }, '2026-01-16')).toBe(true)
        expect(
            passes(
                { kind: 'date', op: 'between', value: '2026-01-01', to: '2026-01-31' },
                '2026-01-31'
            )
        ).toBe(true)
        expect(passes({ kind: 'date', op: 'equals', value: '2026-01-15' }, null)).toBe(false)
    })
})

describe('set + boolean predicates', () => {
    it('matches set membership including null and booleans', () => {
        const filter: ColumnFilter = { kind: 'set', values: ['Core', 7, null] }
        expect(passes(filter, 'Core')).toBe(true)
        expect(passes(filter, 7)).toBe(true)
        expect(passes(filter, null)).toBe(true)
        expect(passes(filter, undefined)).toBe(true)
        expect(passes(filter, 'Data')).toBe(false)

        expect(passes({ kind: 'boolean', value: true }, true)).toBe(true)
        expect(passes({ kind: 'boolean', value: false }, false)).toBe(true)
        expect(passes({ kind: 'boolean', value: true }, false)).toBe(false)
    })
})

describe('compileColumnFilters', () => {
    interface Row {
        name: string
        age: number | null
        dept: string
    }
    const columns: ColumnDef<Row>[] = [
        { id: 'name', filter: 'text' },
        { id: 'age', filter: 'number' },
        { id: 'dept', filter: 'set' },
        { id: 'nofilter' }
    ]
    const nodes = buildRowNodes<Row>(
        [
            { name: 'Alice', age: 30, dept: 'Core' },
            { name: 'Bob', age: null, dept: 'Data' },
            { name: 'Carol', age: 45, dept: 'Core' }
        ],
        (row) => row.name
    )

    it('ANDs multiple column filters', () => {
        const predicate = compileColumnFilters(columns, {
            name: { kind: 'text', op: 'contains', value: 'a' },
            dept: { kind: 'set', values: ['Core'] }
        })!
        expect(nodes.filter(predicate).map((node) => node.row.name)).toEqual(['Alice', 'Carol'])
    })

    it('ignores filters on unknown or non-filterable columns', () => {
        const predicate = compileColumnFilters(columns, {
            ghost: { kind: 'text', op: 'contains', value: 'x' },
            nofilter: { kind: 'text', op: 'contains', value: 'x' }
        })
        expect(predicate).toBeNull()
    })

    it('uses a custom predicate when the def provides one', () => {
        const custom = vi.fn(
            (_value: unknown, row: Row, filter: ColumnFilter) =>
                filter.kind === 'text' && row.name.length > filter.value.length
        )
        const withCustom: ColumnDef<Row>[] = [
            { id: 'name', filter: { type: 'text', predicate: custom } }
        ]
        const predicate = compileColumnFilters(withCustom, {
            name: { kind: 'text', op: 'contains', value: 'xxx' }
        })!
        expect(nodes.filter(predicate).map((node) => node.row.name)).toEqual(['Alice', 'Carol'])
        expect(custom).toHaveBeenCalledTimes(3)
    })

    it('reads filter type from plain and advanced defs', () => {
        expect(filterTypeOf(columns[0])).toBe('text')
        expect(filterTypeOf({ id: 'x', filter: { type: 'set' } })).toBe('set')
        expect(filterTypeOf({ id: 'x', filter: false })).toBeNull()
        expect(filterTypeOf({ id: 'x' })).toBeNull()
    })
})

describe('describeFilter', () => {
    it('formats every kind compactly', () => {
        expect(describeFilter({ kind: 'text', op: 'contains', value: 'ali' })).toBe(
            'contains "ali"'
        )
        expect(describeFilter({ kind: 'text', op: 'blank', value: '' })).toBe('is blank')
        expect(describeFilter({ kind: 'number', op: 'gte', value: 50 })).toBe('≥ 50')
        expect(describeFilter({ kind: 'number', op: 'between', value: 1, to: 9 })).toBe('1 – 9')
        expect(describeFilter({ kind: 'date', op: 'before', value: '2026-01-01' })).toBe(
            'before 2026-01-01'
        )
        expect(describeFilter({ kind: 'set', values: ['a', 'b', 'c'] })).toBe('a, b +1')
        expect(describeFilter({ kind: 'boolean', value: true })).toBe('true')
    })
})

describe('distinctValues', () => {
    it('collects unique primitives, sorts, and puts null last', () => {
        interface Row {
            dept: string | null
        }
        const nodes = buildRowNodes<Row>(
            [{ dept: 'Data' }, { dept: 'Core' }, { dept: null }, { dept: 'Core' }],
            () => Math.random().toString()
        )
        expect(distinctValues(nodes, { id: 'dept' })).toEqual(['Core', 'Data', null])
    })

    it('caps the number of collected values', () => {
        interface Row {
            n: number
        }
        const nodes = buildRowNodes<Row>(
            Array.from({ length: 500 }, (_, i) => ({ n: i })),
            (row) => String(row.n)
        )
        expect(distinctValues(nodes, { id: 'n' })).toHaveLength(DISTINCT_VALUES_CAP)
    })
})
