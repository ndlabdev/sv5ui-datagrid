import { parseDate, parseTime, Time, type DateValue } from '@internationalized/date'
import { toDate } from '../../core/utils/index.js'

/** Whatever the cell holds, as the DatePicker's `DateValue`. */
export function toDateValue(value: unknown): DateValue | undefined {
    if (value === null || value === undefined || value === '') return undefined

    // Not `String(value).slice(0, 10)`: a Date object reads as "Wed Jan 10"
    // that way, which parses as nothing, and the editor opened empty over a
    // cell that was showing a date.
    const date = toDate(value)
    if (!date) return undefined
    // Four digits of year, as `parseDate` requires: a year still being typed
    // is a real year to the field reporting it, and one it has to get back.
    const pad = (part: number, width = 2) => String(part).padStart(width, '0')
    try {
        return parseDate(
            `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        )
    } catch {
        return undefined
    }
}

/**
 * Back to ISO, built from the parts: `toString()` is locale-formatted.
 *
 * The year is padded to four digits like the rest. A segmented field reports
 * a year on its way to 2026 as 2, then 20, then 202, and unpadded those left
 * as `2-01-05`: a string `toDateValue` cannot read back, a value no server
 * would take, and, from a cell editor, one that could be committed onto the
 * row itself.
 */
export function fromDateValue(
    value: { year: number; month: number; day: number } | undefined
): string {
    if (!value) return ''
    const pad = (part: number, width = 2) => String(part).padStart(width, '0')
    return `${pad(value.year, 4)}-${pad(value.month)}-${pad(value.day)}`
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
