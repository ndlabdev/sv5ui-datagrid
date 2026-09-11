import { describe, expect, it } from 'vitest'
import { parse } from '../formula/index.js'
import { mergePaint, type PaintContext, paintOf } from './paint.js'
import type { RuleStats } from './stats.js'

const context = (over: Partial<PaintContext> = {}): PaintContext => ({
    value: 0,
    rowId: '1',
    read: () => undefined,
    node: null,
    highlight: 'x-highlight',
    ...over
})

const scale: RuleStats = { kind: 'scale', min: 0, max: 100 }

describe('colour scale', () => {
    it('mixes in CSS rather than in JavaScript, so a theme token works as a stop', () => {
        const paint = paintOf(
            { kind: 'colorScale', column: 'a', to: 'var(--color-primary)' },
            scale,
            context({ value: 25 })
        )
        expect(paint?.style).toEqual({
            'background-color': 'color-mix(in oklab, var(--color-primary) 25%, transparent)'
        })
    })

    it('passes through the middle stop when the ramp has three colours', () => {
        const rule = {
            kind: 'colorScale',
            column: 'a',
            from: 'red',
            via: 'white',
            to: 'green'
        } as const
        expect(paintOf(rule, scale, context({ value: 25 }))?.style).toEqual({
            'background-color': 'color-mix(in oklab, white 50%, red)'
        })
        expect(paintOf(rule, scale, context({ value: 75 }))?.style).toEqual({
            'background-color': 'color-mix(in oklab, green 50%, white)'
        })
    })

    it('clamps a value outside the range instead of overshooting the mix', () => {
        expect(
            paintOf({ kind: 'colorScale', column: 'a' }, scale, context({ value: 400 }))?.style
        ).toEqual({
            'background-color': 'color-mix(in oklab, var(--color-primary) 100%, transparent)'
        })
    })

    it('paints nothing where there is no number', () => {
        expect(
            paintOf({ kind: 'colorScale', column: 'a' }, scale, context({ value: null }))
        ).toBeUndefined()
    })

    it('treats a flat column as full rather than dividing by zero', () => {
        const flat: RuleStats = { kind: 'scale', min: 7, max: 7 }
        expect(
            paintOf({ kind: 'colorScale', column: 'a' }, flat, context({ value: 7 }))?.style
        ).toEqual({
            'background-color': 'color-mix(in oklab, var(--color-primary) 100%, transparent)'
        })
    })
})

describe('data bar', () => {
    it('draws the bar as a gradient, which costs no element and catches no click', () => {
        const paint = paintOf(
            { kind: 'dataBar', column: 'a', color: 'teal' },
            scale,
            context({ value: 40 })
        )
        expect(paint?.style).toEqual({
            'background-image': 'linear-gradient(to right, teal 0 40%, transparent 40%)',
            'background-repeat': 'no-repeat'
        })
    })

    it('takes the negative colour only for a negative value', () => {
        const rule = {
            kind: 'dataBar',
            column: 'a',
            color: 'teal',
            negativeColor: 'crimson'
        } as const
        const negative: RuleStats = { kind: 'scale', min: -100, max: 100 }
        expect(
            paintOf(rule, negative, context({ value: -50 }))?.style?.['background-image']
        ).toContain('crimson')
        expect(
            paintOf(rule, negative, context({ value: 50 }))?.style?.['background-image']
        ).toContain('teal')
    })
})

describe('a column whose values are all the same', () => {
    const flat: RuleStats = { kind: 'scale', min: 0, max: 0 }

    it('fills the bar rather than dividing by zero, the way a flat scale fills the colour', () => {
        const paint = paintOf(
            { kind: 'dataBar', column: 'a', color: 'teal' },
            flat,
            context({ value: 0 })
        )
        expect(paint?.style?.['background-image']).toContain('teal 0 100%')
    })
})

describe('duplicates and topN', () => {
    const keys: RuleStats = { kind: 'keys', keys: new Set(['a@x.com']) }

    it('paints a repeated value and leaves the rest alone', () => {
        const rule = { kind: 'duplicates', column: 'email' } as const
        expect(paintOf(rule, keys, context({ value: 'a@x.com' }))).toEqual({ class: 'x-highlight' })
        expect(paintOf(rule, keys, context({ value: 'b@x.com' }))).toBeUndefined()
    })

    it('leaves a blank out of it, blank not being a duplicate of anything', () => {
        expect(
            paintOf({ kind: 'duplicates', column: 'email' }, keys, context({ value: '' }))
        ).toBeUndefined()
    })

    it('uses what the rule asks for instead of the fallback class', () => {
        const rule = { kind: 'duplicates', column: 'email', class: 'text-error' } as const
        expect(paintOf(rule, keys, context({ value: 'a@x.com' }))).toEqual({
            class: 'text-error',
            style: undefined
        })
    })

    it('paints at and above the threshold, ties included', () => {
        const threshold: RuleStats = { kind: 'threshold', value: 25 }
        const rule = { kind: 'topN', column: 'a' } as const
        expect(paintOf(rule, threshold, context({ value: 25 }))).toEqual({ class: 'x-highlight' })
        expect(paintOf(rule, threshold, context({ value: 24 }))).toBeUndefined()
    })

    it('paints at and below it when ranking from the bottom', () => {
        const threshold: RuleStats = { kind: 'threshold', value: 10 }
        const rule = { kind: 'topN', column: 'a', bottom: true } as const
        expect(paintOf(rule, threshold, context({ value: 10 }))).toEqual({ class: 'x-highlight' })
        expect(paintOf(rule, threshold, context({ value: 11 }))).toBeUndefined()
    })
})

describe('expression', () => {
    const stats = (): RuleStats => ({ kind: 'expression', cache: new Map() })
    const rule = { kind: 'expression', when: 'total > 100' } as const

    it('paints the rows where the condition holds', () => {
        const node = parse('total > 100')
        const paint = paintOf(rule, stats(), context({ node, read: () => 400 }))
        expect(paint).toEqual({ class: 'x-highlight' })
    })

    it('evaluates a row once however many of its cells ask', () => {
        const shared = stats()
        let reads = 0
        const read = () => {
            reads++
            return 400
        }
        const node = parse('total > 100')
        paintOf(rule, shared, context({ node, read }))
        paintOf(rule, shared, context({ node, read }))
        expect(reads).toBe(1)
    })

    it('paints nothing when the expression would not parse', () => {
        expect(paintOf(rule, stats(), context({ node: null }))).toBeUndefined()
    })

    it('reads an error as false rather than as a match', () => {
        const node = parse('total / 0 > 1')
        expect(paintOf(rule, stats(), context({ node, read: () => 1 }))).toBeUndefined()
    })
})

describe('mergePaint', () => {
    it('lets the later rule win a property while keeping the rest', () => {
        const merged = mergePaint(
            { style: { color: 'red', 'font-weight': '700' } },
            { style: { color: 'blue' } }
        )
        expect(merged.style).toEqual({ color: 'blue', 'font-weight': '700' })
    })

    it('adds classes rather than replacing them', () => {
        expect(mergePaint({ class: 'a' }, { class: 'b' }).class).toBe('a b')
    })
})
