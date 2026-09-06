import { describe, expect, it, vi } from 'vitest'
import type { FormatRule } from './conditional-formatting.types.js'
import { compileRules, MAX_RULES, normalizeRules, ruleId, sanitizeRules } from './rules.js'

describe('normalizeRules', () => {
    it('names a rule after its kind and position when it has no id', () => {
        const rules = normalizeRules([
            { kind: 'dataBar', column: 'a' },
            { kind: 'topN', column: 'b' }
        ])
        expect(rules.map((rule) => rule.id)).toEqual(['dataBar:0', 'topN:1'])
    })

    it('keeps an id the app chose', () => {
        expect(normalizeRules([{ kind: 'dataBar', column: 'a', id: 'sales' }])[0]!.id).toBe('sales')
    })

    it('never reuses an id a rule already holds', () => {
        const first = normalizeRules([
            { kind: 'dataBar', column: 'a' },
            { kind: 'dataBar', column: 'b' }
        ])
        const afterRemove = first.filter((rule) => rule.id !== 'dataBar:0')
        const afterAdd = normalizeRules([...afterRemove, { kind: 'dataBar', column: 'c' }])

        expect(afterAdd.map((rule) => rule.id)).toEqual(['dataBar:1', 'dataBar:2'])
    })

    it('renames the second of two rules that arrive with the same id', () => {
        const rules = normalizeRules([
            { kind: 'topN', column: 'a', id: 'same' },
            { kind: 'topN', column: 'b', id: 'same' }
        ])
        expect(new Set(rules.map((rule) => rule.id)).size).toBe(2)
    })

    it('caps the list, because the hook runs per rendered cell', () => {
        const many: FormatRule[] = Array.from({ length: MAX_RULES + 10 }, () => ({
            kind: 'dataBar',
            column: 'a'
        }))
        expect(normalizeRules(many)).toHaveLength(MAX_RULES)
    })
})

describe('compileRules', () => {
    it('parses only the expression rules', () => {
        const compiled = compileRules(
            normalizeRules([
                { kind: 'expression', when: 'a > 1' },
                { kind: 'dataBar', column: 'a' }
            ]),
            () => {}
        )
        expect([...compiled.keys()]).toEqual(['expression:0'])
        expect(compiled.get('expression:0')?.node).not.toBeNull()
    })

    it('reports a broken expression instead of throwing, and paints nothing', () => {
        const report = vi.fn()
        const compiled = compileRules(normalizeRules([{ kind: 'expression', when: 'a >' }]), report)
        expect(compiled.get('expression:0')?.node).toBeNull()
        expect(compiled.get('expression:0')?.error?.message).toBeTruthy()
        expect(report).toHaveBeenCalledOnce()
        expect(report.mock.calls[0]![0]).toBe('expression:0')
    })
})

describe('sanitizeRules', () => {
    it('rejects what is not a list', () => {
        expect(sanitizeRules({ kind: 'dataBar' })).toBeNull()
        expect(sanitizeRules('dataBar')).toBeNull()
    })

    it('drops an unknown kind and a rule with no column', () => {
        expect(
            sanitizeRules([
                { kind: 'javascript', column: 'a' },
                { kind: 'dataBar' },
                { kind: 'dataBar', column: 'a' }
            ])
        ).toHaveLength(1)
    })

    it('keeps only the fields it knows, at the types it knows', () => {
        const rules = sanitizeRules([
            {
                kind: 'topN',
                column: 'a',
                n: '10',
                bottom: 'yes',
                class: 'text-error',
                style: { 'background-color': 'red', width: 4 },
                onclick: 'alert(1)'
            }
        ])!
        expect(rules[0]).toEqual({
            kind: 'topN',
            column: 'a',
            id: 'topN:0',
            n: undefined,
            bottom: undefined,
            class: 'text-error',
            style: { 'background-color': 'red' }
        })
    })

    it('drops an expression rule with no expression', () => {
        expect(sanitizeRules([{ kind: 'expression', column: 'a' }])).toHaveLength(0)
    })

    it('caps a hydrated list the way the option list is capped', () => {
        const many = Array.from({ length: MAX_RULES + 5 }, () => ({ kind: 'dataBar', column: 'a' }))
        expect(sanitizeRules(many)).toHaveLength(MAX_RULES)
    })
})

describe('ruleId', () => {
    it('falls back to the position for a rule that never got one', () => {
        expect(ruleId({ kind: 'duplicates', column: 'email' }, 3)).toBe('duplicates:3')
    })
})
