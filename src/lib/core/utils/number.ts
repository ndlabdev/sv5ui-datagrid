import { isBlank } from './value.js'

/**
 * Coercion for the passes that do arithmetic over a column: aggregation, the
 * statistics a colour scale reads, a data bar's width, a range's sum.
 *
 * Deliberately not `toNumber` from `format.js`, which answers the narrower
 * question a formatter asks. Two differences earn the second function:
 *
 * - A `Date` is a number here and is not there. Min, max and count over a date
 *   column are ordinary things to ask for, and a formatter has no reason to
 *   read one as a timestamp.
 * - An array or a plain object answers `null` rather than falling through to
 *   `Number(value)`, which reads `[]` as 0 and `[7]` as 7. A cell holding a
 *   list is not a zero, and a sum that quietly counted one would be wrong in a
 *   way nobody would look for.
 */
function isNumericInput(value: unknown): boolean {
    if (isBlank(value)) return false
    if (typeof value === 'string') return value.trim() !== ''
    return typeof value !== 'object' || value instanceof Date
}

export function numericOrNull(value: unknown): number | null {
    if (typeof value === 'number') return Number.isNaN(value) ? null : value
    if (!isNumericInput(value)) return null

    try {
        const parsed = Number(value)
        return Number.isNaN(parsed) ? null : parsed
    } catch {
        return null
    }
}
