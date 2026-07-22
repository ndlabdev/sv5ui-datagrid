import { parseDate, parseTime, Time, type DateValue } from '@internationalized/date'

/**
 * Converts a stored ISO date string (`YYYY-MM-DD`, or the date part of
 * a longer ISO value) into a `DateValue` for the DatePicker editor.
 */
export function toDateValue(value: unknown): DateValue | undefined {
    if (value === null || value === undefined || value === '') return undefined
    const text = String(value).slice(0, 10)
    try {
        return parseDate(text)
    } catch {
        return undefined
    }
}

/**
 * Serializes a DatePicker value back to an ISO date string. The calendar
 * hands back a value whose `toString()` is locale-formatted, so build the
 * ISO form from the date parts instead.
 */
export function fromDateValue(
    value: { year: number; month: number; day: number } | undefined
): string {
    if (!value) return ''
    const pad = (part: number) => String(part).padStart(2, '0')
    return `${value.year}-${pad(value.month)}-${pad(value.day)}`
}

/** Converts a stored `HH:mm[:ss]` string into a `Time`. */
export function toTimeValue(value: unknown): Time | undefined {
    if (value === null || value === undefined || value === '') return undefined
    try {
        return parseTime(String(value))
    } catch {
        return undefined
    }
}

/** Serializes a TimeField time value back to an `HH:mm` string. */
export function fromTimeValue(value: { hour: number; minute: number } | undefined): string {
    if (!value) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(value.hour)}:${pad(value.minute)}`
}
