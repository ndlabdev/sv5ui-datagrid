import type { FlashWay } from './flash-cells.types.js'

const SEPARATOR = '\u0000'

export function cellKey(rowId: string, columnId: string): string {
    return `${rowId}${SEPARATOR}${columnId}`
}

export interface SeenCell {
    key: string
    value: unknown
}

export interface FlashFound {
    key: string
    way: FlashWay
    before: unknown
    after: unknown
}

export function wayBetween(before: unknown, after: unknown, directional: boolean): FlashWay {
    if (!directional) return 'changed'
    if (typeof before !== 'number' || typeof after !== 'number') return 'changed'
    if (Number.isNaN(before) || Number.isNaN(after)) return 'changed'
    return after > before ? 'up' : 'down'
}

export function flashesBetween(
    remembered: Map<string, unknown>,
    seen: SeenCell[],
    directional: boolean
): FlashFound[] {
    const found: FlashFound[] = []

    for (const cell of seen) {
        if (!remembered.has(cell.key)) continue

        const before = remembered.get(cell.key)
        if (Object.is(before, cell.value)) continue

        found.push({
            key: cell.key,
            way: wayBetween(before, cell.value, directional),
            before,
            after: cell.value
        })
    }

    return found
}

export function emptyMemo(): Map<string, unknown> {
    return new Map<string, unknown>()
}

export function remember(seen: SeenCell[]): Map<string, unknown> {
    const next = new Map<string, unknown>()
    for (const cell of seen) next.set(cell.key, cell.value)
    return next
}
