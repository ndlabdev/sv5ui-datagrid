import { describe, expect, it } from 'vitest'
import type { ColumnDef } from '../../core/types/index.js'
import { buildColumnFilter, draftFromFilter, emptyDraft } from './filter-draft.js'
import { compileColumnFilters, describeFilter } from './filter-predicates.js'
import { defaultLabels } from '../../core/interaction/labels.js'
import { buildRowNodes } from '../../core/grid/row-node.js'
import { filterUnitScaleOf, toDisplayUnit, toModelUnit } from './filter-units.js'

interface Row {
    id: number
    share: number
}

const ratioColumn: ColumnDef<Row> = { id: 'share', filter: 'number', type: 'percent' }
const wholeColumn: ColumnDef<Row> = {
    id: 'share',
    filter: 'number',
    type: 'percent',
    typeOptions: { wholePercent: true }
}
const plainColumn: ColumnDef<Row> = { id: 'share', filter: 'number', type: 'number' }

function numberDraft(value: string, to = '', op = 'eq') {
    return { ...emptyDraft('number'), conditions: [{ op, value, to }] }
}

describe('filterUnitScaleOf', () => {
    it('scales a percent column holding a ratio', () => {
        expect(filterUnitScaleOf(ratioColumn)).toBe(100)
    })

    it('leaves a percent column that already holds what it draws', () => {
        expect(filterUnitScaleOf(wholeColumn)).toBe(1)
    })

    it('leaves every column that draws what it holds', () => {
        expect(filterUnitScaleOf(plainColumn)).toBe(1)
        expect(filterUnitScaleOf(undefined)).toBe(1)
    })
})

describe('the panel writes the units the rows are in', () => {
    it('turns the 5 the user typed into the 0.05 the row holds', () => {
        expect(buildColumnFilter('number', numberDraft('5'), 100)).toEqual({
            kind: 'number',
            op: 'eq',
            value: 0.05
        })
    })

    it('scales both ends of a range', () => {
        expect(buildColumnFilter('number', numberDraft('5', '10', 'between'), 100)).toEqual({
            kind: 'number',
            op: 'between',
            value: 0.05,
            to: 0.1
        })
    })

    it('leaves an unscaled column exactly as it was', () => {
        expect(buildColumnFilter('number', numberDraft('5'))).toEqual({
            kind: 'number',
            op: 'eq',
            value: 5
        })
    })

    it('says nothing about a presence operator, which carries no value', () => {
        expect(buildColumnFilter('number', numberDraft('', '', 'blank'), 100)).toEqual({
            kind: 'number',
            op: 'blank'
        })
    })
})

describe('the panel reads back what the user typed', () => {
    it('shows 5 for the filter holding 0.05', () => {
        const draft = draftFromFilter('number', { kind: 'number', op: 'eq', value: 0.05 }, 100)
        expect(draft.conditions[0].value).toBe('5')
    })

    it('does not leak the noise binary division leaves behind', () => {
        // 0.07 * 100 is 7.000000000000001 before rounding.
        const draft = draftFromFilter('number', { kind: 'number', op: 'eq', value: 0.07 }, 100)
        expect(draft.conditions[0].value).toBe('7')
    })

    it('round trips a range through the panel unchanged', () => {
        const filter = buildColumnFilter('number', numberDraft('5', '10', 'between'), 100)!
        const draft = draftFromFilter('number', filter, 100)
        expect([draft.conditions[0].value, draft.conditions[0].to]).toEqual(['5', '10'])
    })
})

describe('what the user types now matches what the user sees', () => {
    const nodes = buildRowNodes(
        Array.from({ length: 100 }, (_, i) => ({ id: i, share: (i % 100) / 100 })),
        (row) => String(row.id)
    )

    function rowsFor(typed: string): number {
        const filter = buildColumnFilter('number', numberDraft(typed), 100)!
        const predicate = compileColumnFilters([ratioColumn], { share: filter })!
        return nodes.filter(predicate).length
    }

    it('finds the row drawn as 5% when 5 is typed', () => {
        expect(rowsFor('5')).toBe(1)
    })

    it('still finds nothing that is not there', () => {
        expect(rowsFor('250')).toBe(0)
    })
})

describe('the chip reads back in the units of the column', () => {
    const written = (value: unknown) => `${toDisplayUnit(Number(value), 100)}%`

    it('describes the filter the user set, not the one that was stored', () => {
        expect(
            describeFilter({ kind: 'number', op: 'gte', value: 0.05 }, defaultLabels, written)
        ).toBe('≥ 5%')
    })

    it('leaves a column without units alone', () => {
        expect(describeFilter({ kind: 'number', op: 'gte', value: 50 }, defaultLabels)).toBe('≥ 50')
    })
})

describe('unit conversion', () => {
    it('is symmetric across the values a percent column holds', () => {
        for (let percent = 0; percent <= 100; percent++) {
            expect(toDisplayUnit(toModelUnit(percent, 100), 100)).toBe(percent)
        }
    })
})
