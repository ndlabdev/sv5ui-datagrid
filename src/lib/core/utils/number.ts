import { isBlank } from './value.js'

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
