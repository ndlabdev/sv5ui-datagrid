import { describe, expect, it } from 'vitest'
import type { ColumnFilter, FilterType } from '../../core/types/index.js'
import {
    buildColumnFilter,
    draftFromFilter,
    emptyCondition,
    emptyDraft,
    isPresenceOp,
    type ConditionDraft,
    type FilterDraft
} from './filter-draft.js'

function build(
    type: FilterType,
    conditions: Partial<ConditionDraft>[],
    extra: Partial<FilterDraft> = {}
) {
    return buildColumnFilter(type, {
        ...emptyDraft(type),
        ...extra,
        conditions: conditions.map((condition) => ({ ...emptyCondition(type), ...condition }))
    })
}

describe('draftFromFilter', () => {
    it('produces an empty draft with a type-appropriate default op', () => {
        expect(emptyDraft('text').conditions[0].op).toBe('contains')
        expect(emptyDraft('number').conditions[0].op).toBe('eq')
        expect(emptyDraft('date').conditions[0].op).toBe('equals')
        expect(draftFromFilter('text', undefined)).toEqual(emptyDraft('text'))
    })

    it('hydrates a draft from each filter kind', () => {
        expect(
            draftFromFilter('number', { kind: 'number', op: 'between', value: 1, to: 9 })
                .conditions[0]
        ).toMatchObject({ op: 'between', value: '1', to: '9' })
        expect(draftFromFilter('set', { kind: 'set', values: ['a', null] }).setSelected).toEqual([
            'a',
            null
        ])
        expect(draftFromFilter('boolean', { kind: 'boolean', value: false }).boolValue).toBe(
            'false'
        )
        expect(
            draftFromFilter('date', { kind: 'date', op: 'before', value: '2026-01-01' })
                .conditions[0]
        ).toMatchObject({ op: 'before', value: '2026-01-01' })
    })

    it('hydrates both rows and the join of a grouped filter', () => {
        const draft = draftFromFilter('text', {
            kind: 'group',
            join: 'or',
            conditions: [
                { kind: 'text', op: 'contains', value: 'a' },
                { kind: 'text', op: 'notContains', value: 'b' }
            ]
        })

        expect(draft.join).toBe('or')
        expect(draft.conditions).toEqual([
            { op: 'contains', value: 'a', to: '' },
            { op: 'notContains', value: 'b', to: '' }
        ])
    })

    it('carries case sensitivity back into the draft', () => {
        const on = draftFromFilter('text', {
            kind: 'text',
            op: 'equals',
            value: 'a',
            caseSensitive: true
        })
        expect(on.caseSensitive).toBe(true)
        expect(
            draftFromFilter('text', { kind: 'text', op: 'equals', value: 'a' }).caseSensitive
        ).toBe(false)
    })
})

describe('buildColumnFilter', () => {
    it('returns null for incomplete inputs', () => {
        expect(build('text', [{ op: 'contains', value: '  ' }])).toBeNull()
        expect(build('number', [{ op: 'gt', value: '' }])).toBeNull()
        expect(build('number', [{ op: 'between', value: '5', to: '' }])).toBeNull()
        expect(build('date', [{ op: 'equals', value: '' }])).toBeNull()
        expect(build('set', [], { setSelected: [] })).toBeNull()
    })

    it('builds each filter kind', () => {
        expect(build('text', [{ op: 'blank' }])).toEqual({ kind: 'text', op: 'blank', value: '' })
        expect(build('number', [{ op: 'gte', value: '50' }])).toEqual({
            kind: 'number',
            op: 'gte',
            value: 50
        })
        expect(build('number', [{ op: 'between', value: '1', to: '9' }])).toEqual({
            kind: 'number',
            op: 'between',
            value: 1,
            to: 9
        })
        expect(build('date', [{ op: 'after', value: '2026-01-01' }])).toEqual({
            kind: 'date',
            op: 'after',
            value: '2026-01-01'
        })
        expect(build('set', [], { setSelected: ['a', 'b'] })).toEqual({
            kind: 'set',
            values: ['a', 'b']
        } satisfies ColumnFilter)
        expect(build('boolean', [], { boolValue: 'false' })).toEqual({
            kind: 'boolean',
            value: false
        })
    })

    it('builds the presence operators without a value', () => {
        expect(build('number', [{ op: 'notBlank' }])).toEqual({ kind: 'number', op: 'notBlank' })
        expect(build('date', [{ op: 'blank' }])).toEqual({ kind: 'date', op: 'blank' })
        expect(isPresenceOp('blank')).toBe(true)
        expect(isPresenceOp('notBlank')).toBe(true)
        expect(isPresenceOp('contains')).toBe(false)
    })

    it('only groups once a second condition is usable', () => {
        // One filled row plus an untouched one stays the plain shape, so a
        // stray click on "add condition" cannot change what gets persisted.
        expect(build('text', [{ op: 'contains', value: 'a' }, {}])).toEqual({
            kind: 'text',
            op: 'contains',
            value: 'a'
        })

        expect(
            build(
                'text',
                [
                    { op: 'contains', value: 'a' },
                    { op: 'notContains', value: 'b' }
                ],
                { join: 'or' }
            )
        ).toEqual({
            kind: 'group',
            join: 'or',
            conditions: [
                { kind: 'text', op: 'contains', value: 'a' },
                { kind: 'text', op: 'notContains', value: 'b' }
            ]
        })
    })

    it('marks case sensitivity only when it is on', () => {
        expect(build('text', [{ op: 'equals', value: 'a' }], { caseSensitive: true })).toEqual({
            kind: 'text',
            op: 'equals',
            value: 'a',
            caseSensitive: true
        })
        // Off is the default, so it is left out and the JSON stays small.
        expect(build('text', [{ op: 'equals', value: 'a' }])).toEqual({
            kind: 'text',
            op: 'equals',
            value: 'a'
        })
    })

    it('accepts numeric draft values from number inputs (sv5ui binds numbers)', () => {
        expect(build('number', [{ op: 'gte', value: 50 as unknown as string }])).toEqual({
            kind: 'number',
            op: 'gte',
            value: 50
        })
        expect(
            build('number', [
                { op: 'between', value: 1 as unknown as string, to: 9 as unknown as string }
            ])
        ).toEqual({ kind: 'number', op: 'between', value: 1, to: 9 })
    })
})
