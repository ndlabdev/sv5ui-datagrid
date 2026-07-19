import { describe, expect, it } from 'vitest'
import type { ColumnFilter } from '../../core/types.js'
import { buildColumnFilter, draftFromFilter, emptyDraft } from './filter-draft.js'

describe('draftFromFilter', () => {
    it('produces an empty draft with type-appropriate default op', () => {
        expect(emptyDraft('text').op).toBe('contains')
        expect(emptyDraft('number').op).toBe('eq')
        expect(emptyDraft('date').op).toBe('equals')
        expect(draftFromFilter('text', undefined)).toEqual(emptyDraft('text'))
    })

    it('hydrates a draft from each filter kind', () => {
        expect(
            draftFromFilter('number', { kind: 'number', op: 'between', value: 1, to: 9 })
        ).toMatchObject({
            op: 'between',
            value: '1',
            to: '9'
        })
        expect(draftFromFilter('set', { kind: 'set', values: ['a', null] }).setSelected).toEqual([
            'a',
            null
        ])
        expect(draftFromFilter('boolean', { kind: 'boolean', value: false }).boolValue).toBe(
            'false'
        )
        expect(
            draftFromFilter('date', { kind: 'date', op: 'before', value: '2026-01-01' })
        ).toMatchObject({
            op: 'before',
            value: '2026-01-01'
        })
    })
})

describe('buildColumnFilter', () => {
    function build(
        type: Parameters<typeof buildColumnFilter>[0],
        draft: Partial<ReturnType<typeof emptyDraft>>
    ) {
        return buildColumnFilter(type, { ...emptyDraft(type), ...draft })
    }

    it('returns null for incomplete inputs', () => {
        expect(build('text', { op: 'contains', value: '  ' })).toBeNull()
        expect(build('number', { op: 'gt', value: '' })).toBeNull()
        expect(build('number', { op: 'between', value: '5', to: '' })).toBeNull()
        expect(build('date', { op: 'equals', value: '' })).toBeNull()
        expect(build('set', { setSelected: [] })).toBeNull()
    })

    it('builds each filter kind', () => {
        expect(build('text', { op: 'blank', value: '' })).toEqual({
            kind: 'text',
            op: 'blank',
            value: ''
        })
        expect(build('number', { op: 'gte', value: '50' })).toEqual({
            kind: 'number',
            op: 'gte',
            value: 50
        })
        expect(build('number', { op: 'between', value: '1', to: '9' })).toEqual({
            kind: 'number',
            op: 'between',
            value: 1,
            to: 9
        })
        expect(build('date', { op: 'after', value: '2026-01-01' })).toEqual({
            kind: 'date',
            op: 'after',
            value: '2026-01-01'
        })
        expect(build('set', { setSelected: ['a', 'b'] })).toEqual({
            kind: 'set',
            values: ['a', 'b']
        } satisfies ColumnFilter)
        expect(build('boolean', { boolValue: 'false' })).toEqual({ kind: 'boolean', value: false })
    })

    it('accepts numeric draft values from number inputs (sv5ui binds numbers)', () => {
        expect(build('number', { op: 'gte', value: 50 as unknown as string })).toEqual({
            kind: 'number',
            op: 'gte',
            value: 50
        })
        expect(
            build('number', {
                op: 'between',
                value: 1 as unknown as string,
                to: 9 as unknown as string
            })
        ).toEqual({ kind: 'number', op: 'between', value: 1, to: 9 })
    })
})
