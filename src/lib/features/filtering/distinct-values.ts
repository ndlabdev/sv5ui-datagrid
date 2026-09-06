import type { CellValueReader, ColumnDef, RowNode, SetFilterValue } from '../../core/types/index.js'
import { readCell, readerToken } from '../../core/grid/index.js'
import { isBlank } from '../../core/utils/index.js'

export const DISTINCT_VALUES_CAP = 200

export function setKeyOf(value: unknown): SetFilterValue {
    if (isBlank(value)) return null
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (value instanceof Date) return value.toISOString()
    return String(value)
}

const cache = new WeakMap<object, Map<string, SetFilterValue[]>>()

export function distinctValuesCached<TRow>(
    nodes: RowNode<TRow>[],
    def: ColumnDef<TRow>,
    reader?: CellValueReader<TRow>
): SetFilterValue[] {
    let byColumn = cache.get(nodes)
    if (!byColumn) {
        byColumn = new Map()
        cache.set(nodes, byColumn)
    }
    const key = `${def.id}#${readerToken(reader)}`
    let values = byColumn.get(key)
    if (!values) {
        values = distinctValues(nodes, def, DISTINCT_VALUES_CAP, reader)
        byColumn.set(key, values)
    }
    return values
}

export function distinctValues<TRow>(
    nodes: RowNode<TRow>[],
    def: ColumnDef<TRow>,
    cap: number = DISTINCT_VALUES_CAP,
    reader?: CellValueReader<TRow>
): SetFilterValue[] {
    const seen = new Set<SetFilterValue>()

    for (const node of nodes) {
        const value = setKeyOf(readCell(node, def, reader))
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
