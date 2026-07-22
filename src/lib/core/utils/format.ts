import type { ColumnTypeOptions } from '../types.js'

/**
 * The slice of `ColumnTypeOptions` the formatters read. Declared separately so
 * they stay independent of the row type.
 */
export type FormatOptions = Pick<
    ColumnTypeOptions<never>,
    'locale' | 'numberFormat' | 'currency' | 'wholePercent' | 'dateFormat'
>

/**
 * Constructing an Intl formatter costs far more than using one, and a renderer
 * runs on every visible cell — so formatters are built once per distinct
 * configuration and reused.
 */
const numberFormatters = new Map<string, Intl.NumberFormat>()
const dateFormatters = new Map<string, Intl.DateTimeFormat>()

/**
 * Configurations come from column definitions, so the set is normally tiny.
 * A cap keeps an app that builds options per row from growing the cache
 * without bound; dropping the whole map is fine because rebuilding a
 * formatter is exactly the cost this cache already assumes.
 */
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

export function isBlank(value: unknown): boolean {
    return value === null || value === undefined || value === ''
}

/** Numbers arrive as numbers, strings from CSV, or Date/ISO for dates. */
export function toNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
    }
    return null
}

export function toDate(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
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

/**
 * Formats a ratio as a percentage. Intl expects 0-1; set `wholePercent` when
 * the data already counts in whole percents.
 */
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
