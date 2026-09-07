import { columnOf, readStore, type RowStore } from './columnar.js'
import type { GroupDescriptor } from './protocol.js'

interface GroupLevel {
    indices: number[]
    groups?: GroupDescriptor[]
    rowCount: number
}

const collator = new Intl.Collator(undefined, { numeric: true })

function keyOf(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (value instanceof Date) return value.toISOString()
    return String(value)
}

function narrow(
    store: RowStore,
    indices: Uint32Array,
    groupBy: string[],
    groupKeys: unknown[]
): number[] {
    const kept: number[] = []

    for (let position = 0; position < indices.length; position++) {
        const index = indices[position]!
        let matches = true
        for (let depth = 0; depth < groupKeys.length; depth++) {
            const column = columnOf(store, groupBy[depth]!)
            if (!column || keyOf(readStore(column, index)) !== keyOf(groupKeys[depth])) {
                matches = false
                break
            }
        }
        if (matches) kept.push(index)
    }

    return kept
}

interface GroupWindow {
    groupBy: string[]
    groupKeys: unknown[]
    startRow: number
    endRow: number
}

export function groupLevel(store: RowStore, indices: Uint32Array, window: GroupWindow): GroupLevel {
    const { groupBy, groupKeys, startRow, endRow } = window
    const inside = narrow(store, indices, groupBy, groupKeys)

    const column =
        groupKeys.length < groupBy.length ? columnOf(store, groupBy[groupKeys.length]!) : undefined

    if (!column) {
        return { indices: inside.slice(startRow, endRow), rowCount: inside.length }
    }

    const counts = new Map<string, { value: unknown; count: number }>()
    for (const index of inside) {
        const value = readStore(column, index)
        const key = keyOf(value)
        const entry = counts.get(key)
        if (entry) entry.count += 1
        else counts.set(key, { value, count: 1 })
    }

    const groups = [...counts.values()]
        .sort((a, b) => collator.compare(keyOf(a.value), keyOf(b.value)))
        .map((entry) => ({ keys: [...groupKeys, entry.value], count: entry.count }))

    return {
        indices: [],
        groups: groups.slice(startRow, endRow),
        rowCount: groups.length
    }
}
