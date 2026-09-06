import { isBlank } from '../../core/utils/index.js'
import { describe, expect, it } from 'vitest'
import { countConditions, matchesCondition, matchesNode } from './evaluate.js'
import type { FilterCondition, FilterGroup } from './advanced-filter.types.js'

const condition = (partial: Partial<FilterCondition>): FilterCondition => ({
    kind: 'condition',
    columnId: 'x',
    op: 'equals',
    ...partial
})

describe('one condition', () => {
    it('tests text the way a text filter does, ignoring case unless asked', () => {
        expect(matchesCondition('Hello', condition({ op: 'contains', value: 'ell' }))).toBe(true)
        expect(matchesCondition('Hello', condition({ op: 'contains', value: 'ELL' }))).toBe(true)
        expect(
            matchesCondition(
                'Hello',
                condition({ op: 'contains', value: 'ELL', caseSensitive: true })
            )
        ).toBe(false)
        expect(matchesCondition('Hello', condition({ op: 'startsWith', value: 'he' }))).toBe(true)
        expect(matchesCondition('Hello', condition({ op: 'endsWith', value: 'LO' }))).toBe(true)
        expect(matchesCondition('Hello', condition({ op: 'notContains', value: 'z' }))).toBe(true)
    })

    it('compares numbers as numbers, including numeric text', () => {
        const n = 'number' as const
        expect(matchesCondition(10, condition({ op: 'gt', value: 5 }), n)).toBe(true)
        expect(matchesCondition(10, condition({ op: 'lte', value: 10 }), n)).toBe(true)
        expect(matchesCondition('10', condition({ op: 'gte', value: '10' }), n)).toBe(true)
        expect(matchesCondition(4, condition({ op: 'between', value: 1, to: 4 }), n)).toBe(true)
        expect(matchesCondition(5, condition({ op: 'between', value: 1, to: 4 }), n)).toBe(false)
    })

    it('compares dates by day, the way a column filter does', () => {
        const day = '2026-03-02T00:00:00.000Z'
        expect(
            matchesCondition(new Date(day), condition({ op: 'before', value: '2026-04-01' }))
        ).toBe(true)
        expect(
            matchesCondition(day, condition({ op: 'after', value: new Date('2026-01-01') }))
        ).toBe(true)
        expect(
            matchesCondition(
                day,
                condition({ op: 'between', value: '2026-01-01', to: '2026-12-31' })
            )
        ).toBe(true)
    })

    it('counts a timestamp as its own day, not as an instant past midnight', () => {
        expect(
            matchesCondition(
                new Date(2026, 2, 2, 10, 30),
                condition({ op: 'equals', value: '2026-03-02' }),
                'date'
            )
        ).toBe(true)
        expect(
            matchesCondition(
                new Date(2026, 2, 2, 10, 30),
                condition({ op: 'after', value: '2026-03-02' }),
                'date'
            )
        ).toBe(false)
    })

    it('keeps the last day of a between range whole', () => {
        expect(
            matchesCondition(
                new Date(2026, 2, 31, 9, 0),
                condition({ op: 'between', value: '2026-01-01', to: '2026-03-31' }),
                'date'
            )
        ).toBe(true)
    })

    it('tests presence without a value', () => {
        expect(matchesCondition(null, condition({ op: 'blank' }))).toBe(true)
        expect(matchesCondition('', condition({ op: 'blank' }))).toBe(true)
        expect(matchesCondition(0, condition({ op: 'blank' }))).toBe(false)
        expect(matchesCondition('x', condition({ op: 'notBlank' }))).toBe(true)
    })

    it('matches a list by the key the list was built with', () => {
        const s = 'set' as const
        expect(matchesCondition('a', condition({ op: 'in', values: ['a', 'b'] }), s)).toBe(true)
        expect(matchesCondition(2, condition({ op: 'in', values: [2] }), s)).toBe(true)
        expect(matchesCondition(2, condition({ op: 'in', values: ['2'] }), s)).toBe(false)
        expect(matchesCondition('c', condition({ op: 'in', values: ['a', 'b'] }), s)).toBe(false)
    })

    it('waits rather than excluding, while a condition is still being filled in', () => {
        expect(matchesCondition('a', condition({ op: 'in' }), 'set')).toBe(true)
        expect(matchesCondition('a', condition({ op: 'in', values: [] }), 'set')).toBe(true)
        expect(matchesCondition('a', condition({ op: 'equals', value: '' }))).toBe(true)
        expect(matchesCondition(5, condition({ op: 'between', value: 1 }), 'number')).toBe(true)
        expect(matchesCondition(5, condition({ op: 'between', value: 1, to: 4 }), 'number')).toBe(
            false
        )
    })

    it('treats booleans as booleans rather than as text', () => {
        expect(matchesCondition(true, condition({ op: 'equals', value: true }))).toBe(true)
        expect(matchesCondition(false, condition({ op: 'equals', value: true }))).toBe(false)
        expect(matchesCondition(false, condition({ op: 'notEqual', value: true }))).toBe(true)
    })

    it('offers no comparison a text column cannot make, and waits rather than hiding', () => {
        expect(matchesCondition('abc', condition({ op: 'gt', value: 5 }))).toBe(true)
        expect(matchesCondition('abc', condition({ op: 'equals', value: 'abc' }))).toBe(true)
    })
})

describe('a tree of conditions', () => {
    const row: Record<string, unknown> = { region: 'North', total: 120, paid: false }
    const read = (columnId: string) => row[columnId]

    it('ands and ors its children', () => {
        const and: FilterGroup = {
            kind: 'group',
            join: 'and',
            children: [
                condition({ columnId: 'region', op: 'equals', value: 'North' }),
                condition({ columnId: 'total', op: 'gt', value: 100 })
            ]
        }
        expect(matchesNode(and, read)).toBe(true)

        const or: FilterGroup = {
            ...and,
            join: 'or',
            children: [
                condition({ columnId: 'region', op: 'equals', value: 'South' }),
                condition({ columnId: 'total', op: 'gt', value: 100 })
            ]
        }
        expect(matchesNode(or, read)).toBe(true)
    })

    it('nests, which is the whole point of a tree', () => {
        const model: FilterGroup = {
            kind: 'group',
            join: 'or',
            children: [
                {
                    kind: 'group',
                    join: 'and',
                    children: [
                        condition({ columnId: 'region', op: 'equals', value: 'South' }),
                        condition({ columnId: 'total', op: 'gt', value: 100 })
                    ]
                },
                condition({ columnId: 'paid', op: 'equals', value: false })
            ]
        }
        expect(matchesNode(model, read)).toBe(true)
    })

    it('negates a whole group', () => {
        const model: FilterGroup = {
            kind: 'group',
            join: 'and',
            not: true,
            children: [condition({ columnId: 'region', op: 'equals', value: 'North' })]
        }
        expect(matchesNode(model, read)).toBe(false)
    })

    it('keeps every row when it holds nothing', () => {
        expect(matchesNode({ kind: 'group', join: 'and', children: [] }, read)).toBe(true)
    })

    it('counts the conditions it holds, however deep', () => {
        const model: FilterGroup = {
            kind: 'group',
            join: 'and',
            children: [
                condition({}),
                { kind: 'group', join: 'or', children: [condition({}), condition({})] }
            ]
        }
        expect(countConditions(model)).toBe(3)
    })
})

describe('isBlank', () => {
    it('counts null, undefined and empty text, and nothing else', () => {
        expect([null, undefined, ''].map(isBlank)).toEqual([true, true, true])
        expect([0, false, ' ', []].map(isBlank)).toEqual([false, false, false, false])
    })
})

describe('a date condition the user did not type by hand', () => {
    it('reads a Date target as the day it is locally, not the day it is in UTC', () => {
        const day = new Date(2026, 2, 2)
        expect(matchesCondition(day, condition({ op: 'equals', value: day }), 'date')).toBe(true)
    })

    it('reads an epoch number as a date rather than as its digits', () => {
        const at = new Date(2026, 2, 2)
        expect(matchesCondition(at, condition({ op: 'equals', value: at.getTime() }), 'date')).toBe(
            true
        )
    })
})
