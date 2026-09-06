import { evaluate, type FormulaValue, isFormulaError, type Node } from '../formula/index.js'
import { numericOrNull } from '../../core/utils/index.js'
import type {
    ColorScaleRule,
    DataBarRule,
    DuplicatesRule,
    FormatPaint,
    FormatRule,
    TopNRule
} from './conditional-formatting.types.js'
import type { RuleStats } from './stats.js'

export interface Paint {
    class?: string
    style?: Record<string, string>
}

export interface PaintContext {
    value: unknown
    rowId: string
    read: (columnId: string) => unknown
    node: Node | null
    highlight: string
}

const DEFAULT_FROM = 'transparent'
const DEFAULT_TO = 'var(--color-primary)'
const DEFAULT_BAR = 'color-mix(in oklab, var(--color-primary) 35%, transparent)'

function ratio(value: number, min: number, max: number): number {
    if (max <= min) return 1
    if (value <= min) return 0
    if (value >= max) return 1
    return (value - min) / (max - min)
}

const percent = (fraction: number): string => `${Math.round(fraction * 1000) / 10}%`

const mix = (over: string, under: string, fraction: number): string =>
    `color-mix(in oklab, ${over} ${percent(fraction)}, ${under})`

function scaleColor(rule: { from?: string; to?: string; via?: string }, at: number): string {
    const from = rule.from ?? DEFAULT_FROM
    const to = rule.to ?? DEFAULT_TO
    if (!rule.via) return mix(to, from, at)
    return at < 0.5 ? mix(rule.via, from, at * 2) : mix(to, rule.via, (at - 0.5) * 2)
}

function highlightPaint(rule: FormatPaint, fallback: string): Paint {
    if (!rule.class && !rule.style) return { class: fallback }
    return { class: rule.class, style: rule.style }
}

function truthy(value: FormulaValue): boolean {
    if (isFormulaError(value) || value === null) return false
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return value !== 0
    if (typeof value === 'string') return value !== '' && value.toLowerCase() !== 'false'
    return true
}

function matchesExpression(context: PaintContext, stats: RuleStats): boolean {
    if (!context.node || stats?.kind !== 'expression') return false
    const cached = stats.cache.get(context.rowId)
    if (cached !== undefined) return cached

    const result = truthy(evaluate(context.node, { column: context.read }))
    stats.cache.set(context.rowId, result)
    return result
}

function scalePaint(
    rule: ColorScaleRule,
    stats: RuleStats,
    context: PaintContext
): Paint | undefined {
    if (stats?.kind !== 'scale') return undefined
    const value = numericOrNull(context.value)
    if (value === null) return undefined
    return { style: { 'background-color': scaleColor(rule, ratio(value, stats.min, stats.max)) } }
}

function barPaint(rule: DataBarRule, stats: RuleStats, context: PaintContext): Paint | undefined {
    if (stats?.kind !== 'scale') return undefined
    const value = numericOrNull(context.value)
    if (value === null) return undefined

    const width = percent(ratio(value, stats.min, stats.max))
    const color = (value < 0 ? rule.negativeColor : undefined) ?? rule.color ?? DEFAULT_BAR
    return {
        style: {
            'background-image': `linear-gradient(to right, ${color} 0 ${width}, transparent ${width})`,
            'background-repeat': 'no-repeat'
        }
    }
}

function duplicatesPaint(
    rule: DuplicatesRule,
    stats: RuleStats,
    context: PaintContext
): Paint | undefined {
    if (stats?.kind !== 'keys') return undefined
    const { value } = context
    if (value === null || value === undefined || value === '') return undefined
    return stats.keys.has(String(value)) ? highlightPaint(rule, context.highlight) : undefined
}

function topNPaint(rule: TopNRule, stats: RuleStats, context: PaintContext): Paint | undefined {
    if (stats?.kind !== 'threshold' || stats.value === null) return undefined
    const value = numericOrNull(context.value)
    if (value === null) return undefined

    const inside = rule.bottom === true ? value <= stats.value : value >= stats.value
    return inside ? highlightPaint(rule, context.highlight) : undefined
}

export function paintOf(
    rule: FormatRule,
    stats: RuleStats,
    context: PaintContext
): Paint | undefined {
    switch (rule.kind) {
        case 'colorScale':
            return scalePaint(rule, stats, context)
        case 'dataBar':
            return barPaint(rule, stats, context)
        case 'duplicates':
            return duplicatesPaint(rule, stats, context)
        case 'topN':
            return topNPaint(rule, stats, context)
        case 'expression':
            return matchesExpression(context, stats)
                ? highlightPaint(rule, context.highlight)
                : undefined
    }
}

export const isPainted = (paint: Paint | undefined): boolean =>
    Boolean(paint?.class || paint?.style)

export function mergePaint(base: Paint | undefined, next: Paint): Paint {
    const style = base?.style || next.style ? { ...base?.style, ...next.style } : undefined
    return {
        class: [base?.class, next.class].filter(Boolean).join(' ') || undefined,
        style
    }
}
