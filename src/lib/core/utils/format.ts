import type { ColumnDef, ColumnType, ColumnTypeOptions } from '../types/index.js'
import { isBlank } from './value.js'

type FormatOptions = Pick<
    ColumnTypeOptions<never>,
    'locale' | 'numberFormat' | 'currency' | 'wholePercent' | 'dateFormat'
>

const numberFormatters = new Map<string, Intl.NumberFormat>()
const dateFormatters = new Map<string, Intl.DateTimeFormat>()

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

export const DEFAULT_EMPTY_TEXT = '-'

export { isBlank } from './value.js'

export function toNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : null
    }
    return null
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

function plainDate(parts: RegExpExecArray): Date | null {
    const [year, month, day] = [Number(parts[1]), Number(parts[2]), Number(parts[3])]
    const date = new Date(year, month - 1, day)
    if (year < 100) date.setFullYear(year, month - 1, day)
    const spelled = date.getMonth() === month - 1 && date.getDate() === day
    return spelled ? date : null
}

export function toDate(value: unknown): Date | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
    if (typeof value === 'string') {
        const parts = DATE_ONLY.exec(value.trim())
        if (parts) return plainDate(parts)
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

export function clampToMax(value: unknown, max: number): number {
    const parsed = toNumber(value) ?? 0
    return Math.min(Math.max(parsed, 0), max)
}

const TEXT_TYPES = new Set<ColumnType>([
    'text',
    'number',
    'currency',
    'percent',
    'date',
    'datetime'
])

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

export const MS_PER_DAY = 86_400_000

export function localDay(date: Date): number {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY
}
