import { describe, expect, it } from 'vitest'
import type { ColumnFilterGroup, FilterModel } from '../../core/types/index.js'
import {
    filterConditions,
    isFilterGroup,
    normalizeFilterEntry,
    toFilterRequest
} from './filter-model.js'

const single = { kind: 'text', op: 'contains', value: 'a' } as const
const group: ColumnFilterGroup = {
    kind: 'group',
    join: 'or',
    conditions: [single, { kind: 'text', op: 'notContains', value: 'b' }]
}

describe('normalizeFilterEntry', () => {
    it('reads a lone condition as a one-item and', () => {
        expect(normalizeFilterEntry(single)).toEqual({ join: 'and', conditions: [single] })
    })

    it('passes a group through unchanged', () => {
        expect(normalizeFilterEntry(group)).toEqual({
            join: 'or',
            conditions: group.conditions
        })
    })

    it('narrows both shapes', () => {
        expect(isFilterGroup(single)).toBe(false)
        expect(isFilterGroup(group)).toBe(true)
        expect(filterConditions(single)).toEqual([single])
        expect(filterConditions(group)).toEqual(group.conditions)
    })
})

describe('toFilterRequest', () => {
    it('normalizes every column so a server sees one shape', () => {
        const model: FilterModel = { quick: 'x', columns: { name: single, dept: group } }

        expect(toFilterRequest(model)).toEqual({
            quick: 'x',
            columns: {
                name: { join: 'and', conditions: [single] },
                dept: { join: 'or', conditions: group.conditions }
            }
        })
    })

    it('survives a model missing its optional halves', () => {
        expect(toFilterRequest({} as FilterModel)).toEqual({ quick: '', columns: {} })
    })
})
