import { describe, expect, it, vi } from 'vitest'
import { defaultLabels } from '../../core/interaction/index.js'
import { buildRowNodes } from '../../core/grid/index.js'
import type { ColumnDef, ColumnFilter } from '../../core/types/index.js'
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

    it('reads the negated ops as the inverse, blanks included', () => {
        expect(passes({ kind: 'text', op: 'notContains', value: 'xyz' }, 'Alice')).toBe(true)
        expect(passes({ kind: 'text', op: 'notContains', value: 'ali' }, 'Alice')).toBe(false)
        expect(passes({ kind: 'text', op: 'notEqual', value: 'bob' }, 'Alice')).toBe(true)
        expect(passes({ kind: 'text', op: 'notEqual', value: 'ALICE' }, 'Alice')).toBe(false)
        expect(passes({ kind: 'text', op: 'notBlank', value: '' }, 'Alice')).toBe(true)
        expect(passes({ kind: 'text', op: 'notBlank', value: '' }, '')).toBe(false)
        expect(passes({ kind: 'text', op: 'notBlank', value: '' }, null)).toBe(false)
        // A blank cell holds neither the query nor its equal, so it passes both.
        expect(passes({ kind: 'text', op: 'notContains', value: 'a' }, null)).toBe(true)
        expect(passes({ kind: 'text', op: 'notEqual', value: 'a' }, '')).toBe(true)
    })

    it('honours case sensitivity when asked', () => {
        const filter = { kind: 'text', op: 'equals', value: 'ALICE', caseSensitive: true } as const
        expect(passes(filter, 'Alice')).toBe(false)
        expect(passes(filter, 'ALICE')).toBe(true)
        expect(
            passes({ kind: 'text', op: 'contains', value: 'Ali', caseSensitive: true }, 'Alice')
        ).toBe(true)
        expect(
            passes({ kind: 'text', op: 'contains', value: 'ali', caseSensitive: true }, 'Alice')
        ).toBe(false)
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
        // Was 2026-01-15T23:59:00Z, the 15th in UTC and the 16th from Bangkok
        // eastwards, so it passed or failed on where it ran.
        expect(passes(filter, new Date(2026, 0, 15, 23, 59))).toBe(true)
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

describe('a date is filtered by the day it is drawn on', () => {
    // Read back the way the renderer reads it, so these hold in any zone. A
    // run under UTC cannot fail: there the two were always the same day.
    const dayOf = (date: Date): string =>
        `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

    const onDay = (value: unknown, day: string): boolean =>
        passes({ kind: 'date', op: 'equals', value: day }, value)

    it('matches a Date object just after local midnight', () => {
        const midnight = new Date(2024, 0, 10, 0, 30)
        expect(onDay(midnight, dayOf(midnight))).toBe(true)
    })

    it('matches a Date object late in the local evening', () => {
        const evening = new Date(2024, 0, 10, 23, 30)
        expect(onDay(evening, dayOf(evening))).toBe(true)
    })

    it('matches a timestamp on the day it is drawn on', () => {
        const stamp = '2024-01-10T21:00:00Z'
        expect(onDay(stamp, dayOf(new Date(stamp)))).toBe(true)
    })

    it('keeps a date-only string on the day it spells', () => {
        expect(onDay('2024-01-10', '2024-01-10')).toBe(true)
        expect(onDay('2024-01-10', '2024-01-09')).toBe(false)
        expect(onDay('2024-01-10', '2024-01-11')).toBe(false)
    })

    it('orders a Date object against a day the same way', () => {
        const evening = new Date(2024, 0, 10, 23, 30)
        expect(passes({ kind: 'date', op: 'after', value: '2024-01-09' }, evening)).toBe(true)
        expect(passes({ kind: 'date', op: 'before', value: '2024-01-11' }, evening)).toBe(true)
        expect(passes({ kind: 'date', op: 'after', value: '2024-01-10' }, evening)).toBe(false)
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
        // The value list offers one null entry for every kind of hole.
        expect(passes(filter, '')).toBe(true)

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

    it('combines two conditions on one column with and / or', () => {
        const and = compileColumnFilters(columns, {
            name: {
                kind: 'group',
                join: 'and',
                conditions: [
                    { kind: 'text', op: 'contains', value: 'a' },
                    { kind: 'text', op: 'notContains', value: 'lice' }
                ]
            }
        })!
        expect(nodes.filter(and).map((node) => node.row.name)).toEqual(['Carol'])

        const or = compileColumnFilters(columns, {
            name: {
                kind: 'group',
                join: 'or',
                conditions: [
                    { kind: 'text', op: 'equals', value: 'alice' },
                    { kind: 'text', op: 'equals', value: 'bob' }
                ]
            }
        })!
        expect(nodes.filter(or).map((node) => node.row.name)).toEqual(['Alice', 'Bob'])
    })

    it('runs a custom predicate once per condition of a group', () => {
        const custom = vi.fn(() => true)
        const withCustom: ColumnDef<Row>[] = [
            { id: 'name', filter: { type: 'text', predicate: custom } }
        ]
        const predicate = compileColumnFilters(withCustom, {
            name: {
                kind: 'group',
                join: 'and',
                conditions: [
                    { kind: 'text', op: 'contains', value: 'a' },
                    { kind: 'text', op: 'contains', value: 'b' }
                ]
            }
        })!
        nodes.filter(predicate)
        expect(custom).toHaveBeenCalledTimes(6)
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
        expect(describeFilter({ kind: 'text', op: 'contains', value: 'ali' }, defaultLabels)).toBe(
            'Contains "ali"'
        )
        expect(describeFilter({ kind: 'text', op: 'blank', value: '' }, defaultLabels)).toBe(
            'Is blank'
        )
        expect(describeFilter({ kind: 'number', op: 'gte', value: 50 }, defaultLabels)).toBe('≥ 50')
        expect(
            describeFilter({ kind: 'number', op: 'between', value: 1, to: 9 }, defaultLabels)
        ).toBe('1 – 9')
        expect(
            describeFilter({ kind: 'date', op: 'before', value: '2026-01-01' }, defaultLabels)
        ).toBe('Before 2026-01-01')
        expect(describeFilter({ kind: 'set', values: ['a', 'b', 'c'] }, defaultLabels)).toBe(
            'a, b +1'
        )
        expect(describeFilter({ kind: 'boolean', value: true }, defaultLabels)).toBe('True')
    })

    it('formats the negated and presence ops', () => {
        expect(describeFilter({ kind: 'text', op: 'notContains', value: 'x' }, defaultLabels)).toBe(
            'Does not contain "x"'
        )
        expect(describeFilter({ kind: 'text', op: 'notEqual', value: 'x' }, defaultLabels)).toBe(
            'Not equal "x"'
        )
        expect(describeFilter({ kind: 'text', op: 'notBlank', value: '' }, defaultLabels)).toBe(
            'Is not blank'
        )
        expect(describeFilter({ kind: 'number', op: 'notBlank' }, defaultLabels)).toBe(
            'Is not blank'
        )
        expect(describeFilter({ kind: 'date', op: 'blank' }, defaultLabels)).toBe('Is blank')
    })

    it('spells out a group with its join', () => {
        expect(
            describeFilter(
                {
                    kind: 'group',
                    join: 'or',
                    conditions: [
                        { kind: 'text', op: 'contains', value: 'a' },
                        { kind: 'text', op: 'contains', value: 'b' }
                    ]
                },
                defaultLabels
            )
        ).toBe('Contains "a" Or Contains "b"')
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

    it('folds the empty string into the one null entry', () => {
        interface Row {
            dept: string | null
        }
        const nodes = buildRowNodes<Row>([{ dept: 'Core' }, { dept: '' }, { dept: null }], () =>
            Math.random().toString()
        )
        expect(distinctValues(nodes, { id: 'dept' })).toEqual(['Core', null])
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
