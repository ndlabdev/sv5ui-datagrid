import type { FormatRule } from '../conditional-formatting/index.js'
import type { XlsxColor, XlsxStyle } from './styles.types.js'

export interface XlsxFormatColors {
    scaleFrom?: XlsxColor
    scaleTo?: XlsxColor
    bar?: XlsxColor
    highlightFill?: XlsxColor
    highlightText?: XlsxColor
}

export const DEFAULT_FORMAT_COLORS = {
    scaleFrom: '#FFFFFF',
    scaleTo: '#3B82F6',
    bar: '#638EC6',
    highlightFill: '#FFEB9C',
    highlightText: '#9C6500'
} as const satisfies Required<XlsxFormatColors>

export type XlsxCfRule =
    | { kind: 'colorScale'; sqref: string; stops: string[]; bounds: string }
    | { kind: 'dataBar'; sqref: string; color: string; bounds: string }
    | { kind: 'values'; sqref: string; dxfId: number; unique: boolean }
    | { kind: 'top10'; sqref: string; dxfId: number; rank: number; bottom: boolean }

const HEX = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i
const RGB = /^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i

function expand(hex: string): string {
    if (hex.length === 3) return [...hex].map((part) => part + part).join('')
    return hex
}

export function toArgb(color: string | undefined, fallback: XlsxColor): string {
    const resolved = color === undefined ? null : argbOf(color)
    return resolved ?? argbOf(fallback) ?? 'FF000000'
}

function argbOf(color: string): string | null {
    const hex = HEX.exec(color.trim())
    if (hex) {
        const body = expand(hex[1]!).toUpperCase()
        return body.length === 8 ? body : `FF${body}`
    }

    const rgb = RGB.exec(color.trim())
    if (!rgb) return null

    const channels = [rgb[1], rgb[2], rgb[3]].map((part) =>
        Math.max(0, Math.min(255, Number(part)))
            .toString(16)
            .toUpperCase()
            .padStart(2, '0')
    )
    return `FF${channels.join('')}`
}

const cfvo = (bound: number | undefined, fallback: 'min' | 'max'): string =>
    bound === undefined ? `<cfvo type="${fallback}"/>` : `<cfvo type="num" val="${bound}"/>`

function boundsOf(rule: { min?: number; max?: number }, middle: boolean): string {
    const low = cfvo(rule.min, 'min')
    const high = cfvo(rule.max, 'max')
    return middle ? `${low}<cfvo type="percentile" val="50"/>${high}` : `${low}${high}`
}

export const HIGHLIGHT_STYLE = (colors: Required<XlsxFormatColors>): XlsxStyle => ({
    font: { color: colors.highlightText },
    fill: colors.highlightFill
})

export interface XlsxFormatContext {
    letterOf: (columnId: string) => string | undefined
    rowCount: number
    colors: Required<XlsxFormatColors>
    addDxf: (style: XlsxStyle) => number
}

function ruleXml(rule: XlsxCfRule, priority: number): string {
    const head = `<cfRule type="${cfType(rule)}" priority="${priority}"`
    switch (rule.kind) {
        case 'colorScale':
            return `${head}><colorScale>${rule.bounds}${rule.stops
                .map((stop) => `<color rgb="${stop}"/>`)
                .join('')}</colorScale></cfRule>`
        case 'dataBar':
            return `${head}><dataBar>${rule.bounds}<color rgb="${rule.color}"/></dataBar></cfRule>`
        case 'values':
            return `${head} dxfId="${rule.dxfId}"/>`
        case 'top10':
            return `${head} dxfId="${rule.dxfId}" rank="${rule.rank}"${
                rule.bottom ? ' bottom="1"' : ''
            }/>`
    }
}

function cfType(rule: XlsxCfRule): string {
    switch (rule.kind) {
        case 'colorScale':
            return 'colorScale'
        case 'dataBar':
            return 'dataBar'
        case 'values':
            return rule.unique ? 'uniqueValues' : 'duplicateValues'
        case 'top10':
            return 'top10'
    }
}

export function conditionalFormatXml(rules: readonly XlsxCfRule[]): string {
    return rules
        .map(
            (rule, index) =>
                `<conditionalFormatting sqref="${rule.sqref}">` +
                ruleXml(rule, rules.length - index) +
                '</conditionalFormatting>'
        )
        .join('')
}

export function xlsxFormatRules(
    rules: readonly FormatRule[],
    context: XlsxFormatContext
): XlsxCfRule[] {
    if (context.rowCount === 0) return []

    const out: XlsxCfRule[] = []
    for (const rule of rules) {
        if (rule.kind === 'expression' || rule.column === undefined) continue

        const letter = context.letterOf(rule.column)
        if (!letter) continue

        const sqref = `${letter}2:${letter}${context.rowCount + 1}`
        out.push(...cfRuleOf(rule, sqref, context))
    }
    return out
}

function cfRuleOf(rule: FormatRule, sqref: string, context: XlsxFormatContext): XlsxCfRule[] {
    const { colors } = context
    switch (rule.kind) {
        case 'colorScale': {
            const stops = [toArgb(rule.from, colors.scaleFrom)]
            if (rule.via) stops.push(toArgb(rule.via, colors.scaleFrom))
            stops.push(toArgb(rule.to, colors.scaleTo))
            return [{ kind: 'colorScale', sqref, stops, bounds: boundsOf(rule, Boolean(rule.via)) }]
        }
        case 'dataBar':
            return [
                {
                    kind: 'dataBar',
                    sqref,
                    color: toArgb(rule.color, colors.bar),
                    bounds: boundsOf(rule, false)
                }
            ]
        case 'duplicates':
            return [
                {
                    kind: 'values',
                    sqref,
                    dxfId: context.addDxf(HIGHLIGHT_STYLE(colors)),
                    unique: rule.unique === true
                }
            ]
        case 'topN':
            return [
                {
                    kind: 'top10',
                    sqref,
                    dxfId: context.addDxf(HIGHLIGHT_STYLE(colors)),
                    rank: Math.max(1, Math.round(rule.n ?? 10)),
                    bottom: rule.bottom === true
                }
            ]
        default:
            return []
    }
}
