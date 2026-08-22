import { describe, expect, it } from 'vitest'
import { floatingCellOf } from './floating-filter.js'

describe('what one cell of the filter row offers', () => {
    it('offers nothing for a column with no filter declared', () => {
        expect(floatingCellOf(null, undefined)).toEqual({ kind: 'none' })
    })

    it('opens empty in the type default operator', () => {
        expect(floatingCellOf('text', undefined)).toEqual({
            kind: 'input',
            op: 'contains',
            value: '',
            caseSensitive: false
        })
        expect(floatingCellOf('number', undefined)).toMatchObject({ op: 'eq', value: '' })
        expect(floatingCellOf('date', undefined)).toMatchObject({ op: 'equals', value: '' })
    })

    it('shows the operator the column already filters by, not the default', () => {
        expect(floatingCellOf('text', { kind: 'text', op: 'startsWith', value: 'Ad' })).toEqual({
            kind: 'input',
            op: 'startsWith',
            value: 'Ad',
            caseSensitive: false
        })
    })

    it('carries Match case, so typing in the row does not undo it', () => {
        const cell = floatingCellOf('text', {
            kind: 'text',
            op: 'contains',
            value: 'a',
            caseSensitive: true
        })
        expect(cell).toMatchObject({ caseSensitive: true })
    })

    it('writes a percent column in the unit it draws', () => {
        // 0.05 is stored; 5 is what the cell says, as the panel does.
        expect(
            floatingCellOf('number', { kind: 'number', op: 'gt', value: 0.05 }, 100)
        ).toMatchObject({ value: '5' })
    })

    it('hands back to the panel everything one field cannot hold', () => {
        const summary = { kind: 'summary' }
        // A list of discrete values is the panel's own control.
        expect(floatingCellOf('set', undefined)).toEqual(summary)
        expect(floatingCellOf('set', { kind: 'set', values: ['a'] })).toEqual(summary)
        // Two conditions joined.
        expect(
            floatingCellOf('number', {
                kind: 'group',
                join: 'or',
                conditions: [
                    { kind: 'number', op: 'gt', value: 1 },
                    { kind: 'number', op: 'lt', value: 9 }
                ]
            })
        ).toEqual(summary)
        // A range needs two fields.
        expect(
            floatingCellOf('number', { kind: 'number', op: 'between', value: 1, to: 9 })
        ).toEqual(summary)
        // And an operator with no value at all would read as unfiltered.
        expect(floatingCellOf('text', { kind: 'text', op: 'blank', value: '' })).toEqual(summary)
    })

    it('reads a boolean filter as the choice it is', () => {
        expect(floatingCellOf('boolean', undefined)).toEqual({ kind: 'boolean', value: '' })
        expect(floatingCellOf('boolean', { kind: 'boolean', value: true })).toEqual({
            kind: 'boolean',
            value: 'true'
        })
        expect(floatingCellOf('boolean', { kind: 'boolean', value: false })).toEqual({
            kind: 'boolean',
            value: 'false'
        })
    })
})
