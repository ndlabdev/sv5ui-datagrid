import { parseDate, parseTime, Time, type DateValue } from '@internationalized/date'
import { isBlank, toDate } from '../../core/utils/index.js'

export function toDateValue(value: unknown): DateValue | undefined {
    if (isBlank(value)) return undefined

    const date = toDate(value)
    if (!date) return undefined
    const pad = (part: number, width = 2) => String(part).padStart(width, '0')
    try {
        return parseDate(
            `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
        )
    } catch {
        return undefined
    }
}

export function fromDateValue(
    value: { year: number; month: number; day: number } | undefined
): string {
    if (!value) return ''
    const pad = (part: number, width = 2) => String(part).padStart(width, '0')
    return `${pad(value.year, 4)}-${pad(value.month)}-${pad(value.day)}`
}

export function toTimeValue(value: unknown): Time | undefined {
    if (isBlank(value)) return undefined
    try {
        return parseTime(String(value))
    } catch {
        return undefined
    }
}

export function fromTimeValue(value: { hour: number; minute: number } | undefined): string {
    if (!value) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(value.hour)}:${pad(value.minute)}`
}
