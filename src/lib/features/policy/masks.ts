import { isBlank } from '../../core/utils/index.js'
export type MaskKind = 'hide' | 'redact' | 'last4' | 'email' | 'initials'

export const REDACTED = '••••'

export function idSet(values: string[]): string[] {
    return [...new Set(values)]
}

const KEEP = 4

function textOf(value: unknown): string {
    return value instanceof Date ? value.toISOString() : String(value)
}

export function maskLast4(value: unknown): string {
    const text = textOf(value)
    if (text.length <= KEEP) return REDACTED
    return REDACTED + text.slice(-KEEP)
}

export function maskEmail(value: unknown): string {
    const text = textOf(value)
    const at = text.lastIndexOf('@')
    if (at <= 0) return REDACTED

    const local = text.slice(0, at)
    return `${local[0]}${REDACTED}${text.slice(at)}`
}

export function maskInitials(value: unknown): string {
    const words = textOf(value)
        .split(/\s+/)
        .filter((word) => word !== '')
    if (words.length === 0) return REDACTED
    return words.map((word) => `${[...word][0]}.`).join(' ')
}

export function applyMask(kind: MaskKind, value: unknown): unknown {
    if (kind === 'hide') return null
    if (isBlank(value)) return value

    switch (kind) {
        case 'redact':
            return REDACTED
        case 'last4':
            return maskLast4(value)
        case 'email':
            return maskEmail(value)
        default:
            return maskInitials(value)
    }
}
