import { FormulaSyntaxError, type Node, parse } from '../formula/index.js'
import type { FormatRule } from './conditional-formatting.types.js'

export const MAX_RULES = 64

const KINDS = new Set(['colorScale', 'dataBar', 'expression', 'duplicates', 'topN'])

export interface RuleParseError {
    message: string
    at: number
}

export interface CompiledRule {
    node: Node | null
    error: RuleParseError | null
}

export type CompiledRules = ReadonlyMap<string, CompiledRule>

export const NO_RULES: readonly FormatRule[] = []

export const NO_COMPILED: CompiledRules = new Map<string, CompiledRule>()

export function ruleId(rule: FormatRule, index: number): string {
    return rule.id ?? `${rule.kind}:${index}`
}

export function appliesTo(rule: FormatRule, columnId: string): boolean {
    return rule.column === undefined || rule.column === columnId
}

function freeId(kind: string, taken: Set<string>): string {
    let suffix = taken.size
    let id = `${kind}:${suffix}`
    while (taken.has(id)) id = `${kind}:${++suffix}`
    return id
}

export function normalizeRules(rules: readonly FormatRule[]): FormatRule[] {
    const kept = rules.slice(0, MAX_RULES)
    const taken = new Set<string>()
    const out: FormatRule[] = []

    for (const rule of kept) {
        const id = rule.id && !taken.has(rule.id) ? rule.id : freeId(rule.kind, taken)
        taken.add(id)
        out.push(rule.id === id ? rule : { ...rule, id })
    }
    return out
}

export function copyRules(rules: readonly FormatRule[]): FormatRule[] {
    return rules.map((rule) =>
        'style' in rule && rule.style ? { ...rule, style: { ...rule.style } } : { ...rule }
    )
}

export type ReportParseError = (ruleId: string, message: string, at: number) => void

export function compileRules(
    rules: readonly FormatRule[],
    report: ReportParseError
): CompiledRules {
    const out = new Map<string, CompiledRule>()
    for (const [index, rule] of rules.entries()) {
        if (rule.kind !== 'expression') continue
        const id = ruleId(rule, index)
        try {
            out.set(id, { node: parse(rule.when), error: null })
        } catch (error) {
            const failure = {
                message: error instanceof Error ? error.message : String(error),
                at: error instanceof FormulaSyntaxError ? error.at : 0
            }
            out.set(id, { node: null, error: failure })
            report(id, failure.message, failure.at)
        }
    }
    return out
}

function styleOf(value: unknown): Record<string, string> | undefined {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return undefined
    const out: Record<string, string> = {}
    for (const [property, declaration] of Object.entries(value as Record<string, unknown>)) {
        if (typeof declaration === 'string') out[property] = declaration
    }
    return Object.keys(out).length > 0 ? out : undefined
}

const text = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

const finite = (value: unknown): number | undefined =>
    typeof value === 'number' && Number.isFinite(value) ? value : undefined

const flag = (value: unknown): boolean | undefined =>
    typeof value === 'boolean' ? value : undefined

function paintFields(source: Record<string, unknown>): {
    class?: string
    style?: Record<string, string>
} {
    return { class: text(source.class), style: styleOf(source.style) }
}

function ruleOf(source: Record<string, unknown>): FormatRule | null {
    const kind = source.kind
    if (typeof kind !== 'string' || !KINDS.has(kind)) return null
    const column = text(source.column)
    if (kind !== 'expression' && !column) return null

    const base = { id: text(source.id), column }

    switch (kind) {
        case 'colorScale':
            return {
                ...base,
                column: column!,
                kind,
                from: text(source.from),
                to: text(source.to),
                via: text(source.via),
                min: finite(source.min),
                max: finite(source.max)
            }
        case 'dataBar':
            return {
                ...base,
                column: column!,
                kind,
                color: text(source.color),
                negativeColor: text(source.negativeColor),
                min: finite(source.min),
                max: finite(source.max)
            }
        case 'expression': {
            const when = text(source.when)
            return when ? { ...base, kind, when, ...paintFields(source) } : null
        }
        case 'duplicates':
            return {
                ...base,
                column: column!,
                kind,
                unique: flag(source.unique),
                ...paintFields(source)
            }
        default:
            return {
                ...base,
                column: column!,
                kind: 'topN',
                n: finite(source.n),
                bottom: flag(source.bottom),
                ...paintFields(source)
            }
    }
}

export function sanitizeRules(slice: unknown): FormatRule[] | null {
    if (!Array.isArray(slice)) return null
    const out: FormatRule[] = []
    for (const entry of slice) {
        if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) continue
        const rule = ruleOf(entry as Record<string, unknown>)
        if (rule) out.push(rule)
        if (out.length === MAX_RULES) break
    }
    return normalizeRules(out)
}
