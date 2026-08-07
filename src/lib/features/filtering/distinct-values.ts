import type { ColumnDef, RowNode, SetFilterValue } from '../../core/types/index.js'
import { getCellValue, isBlank } from '../../core/utils/value.js'

export const DISTINCT_VALUES_CAP = 200

const cache = new WeakMap<object, Map<string, SetFilterValue[]>>()

export function distinctValuesCached<TRow>(
    nodes: RowNode<TRow>[],
    def: ColumnDef<TRow>
): SetFilterValue[] {
    let byColumn = cache.get(nodes)
    if (!byColumn) {
        byColumn = new Map()
        cache.set(nodes, byColumn)
    }
    let values = byColumn.get(def.id)
    if (!values) {
        values = distinctValues(nodes, def)
        byColumn.set(def.id, values)
    }
    return values
}

export function distinctValues<TRow>(
    nodes: RowNode<TRow>[],
    def: ColumnDef<TRow>,
    cap: number = DISTINCT_VALUES_CAP
): SetFilterValue[] {
    const seen = new Set<SetFilterValue>()

    for (const node of nodes) {
        const raw = getCellValue(node.row, def)
        // Blanks share the single null entry rather than offering the user both
        // it and an empty-looking row, which they could not tell apart.
        const value: SetFilterValue = isBlank(raw)
            ? null
            : typeof raw === 'number' || typeof raw === 'boolean'
              ? raw
              : String(raw)
        if (!seen.has(value)) {
            seen.add(value)
            if (seen.size >= cap) break
        }
    }

    return [...seen].sort((a, b) => {
        if (a === null) return 1
        if (b === null) return -1
        if (typeof a === 'number' && typeof b === 'number') return a - b
        return String(a).localeCompare(String(b))
    })
}
