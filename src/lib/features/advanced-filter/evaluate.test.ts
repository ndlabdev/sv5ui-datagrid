import { describe, expect, it } from 'vitest'
import { countConditions, isBlankValue, matchesCondition, matchesNode } from './evaluate.js'
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
        expect(matchesCondition(10, condition({ op: 'gt', value: 5 }))).toBe(true)
        expect(matchesCondition(10, condition({ op: 'lte', value: 10 }))).toBe(true)
        expect(matchesCondition('10', condition({ op: 'gte', value: '10' }))).toBe(true)
        expect(matchesCondition(4, condition({ op: 'between', value: 1, to: 4 }))).toBe(true)
        expect(matchesCondition(5, condition({ op: 'between', value: 1, to: 4 }))).toBe(false)
    })

    it('compares dates by day, the way the free grid does', () => {
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
                condition({ op: 'equals', value: '2026-03-02' })
            )
        ).toBe(true)
        expect(
            matchesCondition(
                new Date(2026, 2, 2, 10, 30),
                condition({ op: 'after', value: '2026-03-02' })
            )
        ).toBe(false)
    })

    it('keeps the last day of a between range whole', () => {
        expect(
            matchesCondition(
                new Date(2026, 2, 31, 9, 0),
                condition({ op: 'between', value: '2026-01-01', to: '2026-03-31' })
            )
        ).toBe(true)
    })

    it('tests presence without a value', () => {
        expect(matchesCondition(null, condition({ op: 'blank' }))).toBe(true)
        expect(matchesCondition('', condition({ op: 'blank' }))).toBe(true)
        expect(matchesCondition(0, condition({ op: 'blank' }))).toBe(false)
        expect(matchesCondition('x', condition({ op: 'notBlank' }))).toBe(true)
    })

    it('matches a list, by value or by its text', () => {
        expect(matchesCondition('a', condition({ op: 'in', values: ['a', 'b'] }))).toBe(true)
        expect(matchesCondition(2, condition({ op: 'in', values: ['2'] }))).toBe(true)
        expect(matchesCondition('c', condition({ op: 'in', values: ['a', 'b'] }))).toBe(false)
    })

    it('waits rather than excluding, while a condition is still being filled in', () => {
        expect(matchesCondition('a', condition({ op: 'in' }))).toBe(true)
        expect(matchesCondition('a', condition({ op: 'in', values: [] }))).toBe(true)
        expect(matchesCondition('a', condition({ op: 'equals', value: '' }))).toBe(true)
        expect(matchesCondition(5, condition({ op: 'between', value: 1 }))).toBe(true)
        expect(matchesCondition(5, condition({ op: 'between', value: 1, to: 4 }))).toBe(false)
    })

    it('treats booleans as booleans rather than as text', () => {
        expect(matchesCondition(true, condition({ op: 'equals', value: true }))).toBe(true)
        expect(matchesCondition(false, condition({ op: 'equals', value: true }))).toBe(false)
        expect(matchesCondition(false, condition({ op: 'notEqual', value: true }))).toBe(true)
    })

    it('falls back to text when the two sides are not comparable as numbers', () => {
        expect(matchesCondition('abc', condition({ op: 'gt', value: 5 }))).toBe(false)
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

describe('isBlankValue', () => {
    it('counts null, undefined and empty text, and nothing else', () => {
        expect([null, undefined, ''].map(isBlankValue)).toEqual([true, true, true])
        expect([0, false, ' ', []].map(isBlankValue)).toEqual([false, false, false, false])
    })
})
