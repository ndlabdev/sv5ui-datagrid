import type { ColumnDef, ColumnType, ColumnTypeOptions } from '../types/index.js'
import { isBlank } from './value.js'

/** The slice formatters read, declared apart from the row type. */
export type FormatOptions = Pick<
    ColumnTypeOptions<never>,
    'locale' | 'numberFormat' | 'currency' | 'wholePercent' | 'dateFormat'
>

/** Building an Intl formatter costs far more than using one, and a renderer
 * runs per visible cell — so they are built once per configuration. */
const numberFormatters = new Map<string, Intl.NumberFormat>()
const dateFormatters = new Map<string, Intl.DateTimeFormat>()

/** Configurations come from column definitions, so the set is normally tiny.
 * The cap only guards an app that builds options per row. */
const FORMATTER_CACHE_LIMIT = 64

function cached<T>(cache: Map<string, T>, key: string, create: () => T): T {
    const existing = cache.get(key)
    if (existing) return existing

    if (cache.size >= FORMATTER_CACHE_LIMIT) cache.clear()
    const formatter = create()
    cache.set(key, formatter)
    return formatter
}

function numberFormatter(locale: string | undefined, options: Intl.NumberFormatOptions) {
    const key = `${locale ?? ''}|${JSON.stringify(options)}`
    return cached(numberFormatters, key, () => new Intl.NumberFormat(locale, options))
}

function dateFormatter(locale: string | undefined, options: Intl.DateTimeFormatOptions) {
    const key = `${locale ?? ''}|${JSON.stringify(options)}`
    return cached(dateFormatters, key, () => new Intl.DateTimeFormat(locale, options))
}

export const DEFAULT_EMPTY_TEXT = '—'

// Blank lives with the other value predicates so sorting, filtering and the
// renderers cannot drift apart on what counts as a hole.
export { isBlank } from './value.js'

/** Numbers arrive as numbers, strings from CSV, or Date/ISO for dates. */
export function toNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
    }
    return null
}

/** `2026-03-14`, with nothing in it to say which clock it belongs to. */
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

export function toDate(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
    if (typeof value === 'string') {
        const parts = DATE_ONLY.exec(value.trim())
        // A plain date names a calendar day, not an instant: `new Date` reads
        // one as UTC midnight, which draws as the day before west of Greenwich.
        if (parts) {
            const [year, month, day] = [Number(parts[1]), Number(parts[2]), Number(parts[3])]
            const date = new Date(year, month - 1, day)
            // `new Date` would roll 2026-02-30 forward into March.
            const spelled = date.getMonth() === month - 1 && date.getDate() === day
            return spelled ? date : null
        }
    }
    if (typeof value === 'number' || typeof value === 'string') {
        const parsed = new Date(value)
        return Number.isNaN(parsed.getTime()) ? null : parsed
    }
    return null
}

export function formatNumber(value: unknown, options: FormatOptions = {}): string {
    const parsed = toNumber(value)
    if (parsed === null) return ''
    return numberFormatter(options.locale, options.numberFormat ?? {}).format(parsed)
}

export function formatCurrency(value: unknown, options: FormatOptions = {}): string {
    const parsed = toNumber(value)
    if (parsed === null) return ''
    return numberFormatter(options.locale, {
        style: 'currency',
        currency: options.currency ?? 'USD',
        ...options.numberFormat
    }).format(parsed)
}

/** Intl expects 0-1; `wholePercent` says the data already counts to 100. */
export function formatPercent(value: unknown, options: FormatOptions = {}): string {
    const parsed = toNumber(value)
    if (parsed === null) return ''
    return numberFormatter(options.locale, {
        style: 'percent',
        maximumFractionDigits: 1,
        ...options.numberFormat
    }).format(options.wholePercent ? parsed / 100 : parsed)
}

export function formatDate(value: unknown, options: FormatOptions = {}, withTime = false): string {
    const parsed = toDate(value)
    if (parsed === null) return ''
    return dateFormatter(options.locale, {
        dateStyle: 'medium',
        ...(withTime ? { timeStyle: 'short' } : {}),
        ...options.dateFormat
    }).format(parsed)
}

/** Progress and rating need a ratio the component can draw. */
export function clampToMax(value: unknown, max: number): number {
    const parsed = toNumber(value) ?? 0
    return Math.min(Math.max(parsed, 0), max)
}

/** The types whose built-in rendering is text. The rest draw a widget, and a
 * widget has no formatted string to hand anyone — `formatCellText` says so by
 * returning undefined, the way a grid with no formatter on the column does. */
const TEXT_TYPES = new Set<ColumnType>([
    'text',
    'number',
    'currency',
    'percent',
    'date',
    'datetime'
])

/**
 * The text the built-in renderer prints for a value, so a `cell` snippet can
 * show exactly what its own column would and decorate around it. One
 * definition: the renderer, the snippet and a formatted export all read it.
 *
 * `undefined` where the built-in rendering is a widget — boolean, badge, user,
 * progress, rating, link, actions — since there is no string to stand for it.
 */
export function formatCellText<TRow>(
    value: unknown,
    def: ColumnDef<TRow>,
    locale?: string
): string | undefined {
    const type = def.type
    if (type && !TEXT_TYPES.has(type)) return undefined

    const options = { locale, ...def.typeOptions }
    if (isBlank(value)) return options.emptyText ?? DEFAULT_EMPTY_TEXT

    switch (type) {
        case 'number':
            return formatNumber(value, options)
        case 'currency':
            return formatCurrency(value, options)
        case 'percent':
            return formatPercent(value, options)
        case 'date':
            return formatDate(value, options)
        case 'datetime':
            return formatDate(value, options, true)
        default:
            return String(value)
    }
}
