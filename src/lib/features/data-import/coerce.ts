import { type ColumnDef } from '../../core/types/index.js'
import { toBoolean } from '../../core/utils/index.js'
import type { SourceValue } from './mapping.js'

type CoerceKind = 'text' | 'number' | 'date' | 'boolean'

interface Coerced {
    value: unknown
    problem: 'number' | 'date' | 'boolean' | null
}

const BY_COLUMN_TYPE: Record<string, CoerceKind> = {
    number: 'number',
    currency: 'number',
    percent: 'number',
    progress: 'number',
    rating: 'number',
    date: 'date',
    datetime: 'date',
    boolean: 'boolean'
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?)?/
const ISO_ZONE = /(?:Z|[+-]\d{2}:?\d{2})$/i
const DMY = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/

export function kindOfColumn<TRow>(column: ColumnDef<TRow>): CoerceKind {
    return BY_COLUMN_TYPE[column.type ?? 'text'] ?? 'text'
}

export type DecimalMark = '.' | ','

function withMark(body: string, mark: DecimalMark): string {
    const other = mark === '.' ? ',' : '.'
    const stripped = body.split(other).join('')
    return mark === ',' ? stripped.replace(',', '.') : stripped
}

function separatorsOf(body: string): { normalized: string } {
    const lastComma = body.lastIndexOf(',')
    const lastDot = body.lastIndexOf('.')

    if (lastComma >= 0 && lastDot >= 0) {
        return {
            normalized:
                lastComma > lastDot
                    ? body.replace(/\./g, '').replace(',', '.')
                    : body.replace(/,/g, '')
        }
    }

    if (lastComma >= 0) {
        const decimals = body.length - lastComma - 1
        const grouped = (body.match(/,/g) ?? []).length > 1
        return {
            normalized: grouped || decimals === 3 ? body.replace(/,/g, '') : body.replace(',', '.')
        }
    }

    if ((body.match(/\./g) ?? []).length > 1) return { normalized: body.replace(/\./g, '') }
    return { normalized: body }
}

export function parseNumber(text: string, mark?: DecimalMark): number | null {
    const trimmed = text.trim().replace(/[\s\u00a0\u202f]/g, '')
    if (trimmed === '') return null

    const bracketed = /^\((.*)\)$/.exec(trimmed)
    const unwrapped = bracketed ? (bracketed[1] ?? '') : trimmed

    const percent = unwrapped.endsWith('%')
    const body = (percent ? unwrapped.slice(0, -1) : unwrapped).replace(/[^0-9,.\-+eE]/g, '')
    if (body === '') return null

    const parsed = Number(mark ? withMark(body, mark) : separatorsOf(body).normalized)
    if (!Number.isFinite(parsed)) return null

    const scaled = percent ? parsed / 100 : parsed
    return bracketed ? -Math.abs(scaled) : scaled
}

function exists(made: Date, year: number, month: number, day: number): boolean {
    return (
        !Number.isNaN(made.getTime()) &&
        made.getFullYear() === year &&
        made.getMonth() === month - 1 &&
        made.getDate() === day
    )
}

function fromIso(trimmed: string): Date | null {
    const iso = ISO_DATE.exec(trimmed)
    if (!iso) return null

    if (ISO_ZONE.test(trimmed)) {
        const zoned = new Date(trimmed)
        return Number.isNaN(zoned.getTime()) ? null : zoned
    }

    const [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])]
    const made = new Date(
        year,
        month - 1,
        day,
        Number(iso[4] ?? 0),
        Number(iso[5] ?? 0),
        Number(iso[6] ?? 0)
    )
    return exists(made, year, month, day) ? made : null
}

const CENTURY_BREAK = 70

function centuryOf(twoDigits: number): number {
    return twoDigits < CENTURY_BREAK ? 2000 + twoDigits : 1900 + twoDigits
}

function fromDayMonthYear(trimmed: string): Date | null {
    const dmy = DMY.exec(trimmed)
    if (!dmy) return null

    const first = Number(dmy[1])
    const second = Number(dmy[2])
    const day = first > 12 ? first : second > 12 ? second : first
    const month = first > 12 ? second : second > 12 ? first : second

    const written = dmy[3] ?? ''
    const year = written.length === 2 ? centuryOf(Number(written)) : Number(written)

    const made = new Date(year, month - 1, day)
    return exists(made, year, month, day) ? made : null
}

export function parseDate(text: string): Date | null {
    const trimmed = text.trim()
    if (trimmed === '') return null

    if (ISO_DATE.test(trimmed)) return fromIso(trimmed)
    if (DMY.test(trimmed)) return fromDayMonthYear(trimmed)
    if (/^[+-]?\d+$/.test(trimmed)) return null

    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed
}

export function parseBoolean(text: string): boolean | null {
    return toBoolean(text)
}

function coerceNumber(raw: SourceValue, mark?: DecimalMark): Coerced {
    if (typeof raw === 'number') return { value: raw, problem: null }
    if (typeof raw === 'boolean') return { value: raw ? 1 : 0, problem: null }
    if (raw instanceof Date) return { value: raw.getTime(), problem: null }

    const parsed = parseNumber(String(raw), mark)
    return parsed === null ? { value: null, problem: 'number' } : { value: parsed, problem: null }
}

function coerceDate(raw: SourceValue): Coerced {
    if (raw instanceof Date) return { value: raw, problem: null }
    if (typeof raw === 'number') return { value: new Date(raw), problem: null }
    if (typeof raw === 'boolean') return { value: null, problem: 'date' }

    const parsed = parseDate(String(raw))
    return parsed === null ? { value: null, problem: 'date' } : { value: parsed, problem: null }
}

function coerceBoolean(raw: SourceValue): Coerced {
    if (typeof raw === 'boolean') return { value: raw, problem: null }
    if (typeof raw === 'number') return { value: raw !== 0, problem: null }
    if (raw instanceof Date) return { value: null, problem: 'boolean' }

    const parsed = parseBoolean(String(raw))
    return parsed === null ? { value: null, problem: 'boolean' } : { value: parsed, problem: null }
}

function coerceText(raw: SourceValue): Coerced {
    if (raw instanceof Date) return { value: raw.toISOString().slice(0, 10), problem: null }
    return { value: String(raw), problem: null }
}

export function coerce(raw: SourceValue, kind: CoerceKind, mark?: DecimalMark): Coerced {
    if (raw === null || raw === undefined || raw === '') return { value: null, problem: null }

    switch (kind) {
        case 'number':
            return coerceNumber(raw, mark)
        case 'date':
            return coerceDate(raw)
        case 'boolean':
            return coerceBoolean(raw)
        default:
            return coerceText(raw)
    }
}
