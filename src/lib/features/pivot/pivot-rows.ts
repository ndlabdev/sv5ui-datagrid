import { isBlank } from '../../core/utils/index.js'
import type { CellRead } from '../../core/grid/index.js'
import type { ColumnDef, RowNode } from '../../core/types/index.js'
import { crossingId, escapeKey, keyOf, pathOf, subtotalId, totalId } from './pivot-ids.js'

export interface KeyedRows<TRow> {
    key: string
    nodes: RowNode<TRow>[]
}

export function groupsByKey<TRow>(
    nodes: readonly RowNode<TRow>[],
    field: ColumnDef<TRow>,
    read: CellRead<TRow>
): KeyedRows<TRow>[] {
    const buckets = new Map<string, KeyedRows<TRow>>()

    for (const node of nodes) {
        const value = read(node, field)
        const key = isBlank(value) ? '(blank)' : String(value)
        const found = buckets.get(key)
        if (found) found.nodes.push(node)
        else buckets.set(key, { key, nodes: [node] })
    }

    return [...buckets.values()]
}

export function partitionByPath<TRow>(
    rows: TRow[],
    columns: ColumnDef<TRow>[],
    read: CellRead<TRow>
): Map<string, TRow[]> {
    const buckets = new Map<string, TRow[]>()

    for (const row of rows) {
        const path = pathOf(row, columns, read)
        let prefix = ''

        for (const key of path) {
            prefix = prefix === '' ? escapeKey(key) : `${prefix}|${escapeKey(key)}`
            const bucket = buckets.get(prefix)
            if (bucket) bucket.push(row)
            else buckets.set(prefix, [row])
        }
    }
    return buckets
}

export interface CrossingRef {
    keys: string[]
    measure: number
}

export interface IndexShape {
    paths: string[][]
    subtotals: string[][]
    measures: number
    withTotal: boolean
}

export function crossingIndex(shape: IndexShape): Map<string, CrossingRef> {
    const out = new Map<string, CrossingRef>()

    for (const path of shape.paths) {
        for (let measure = 0; measure < shape.measures; measure++) {
            out.set(crossingId(path, measure), { keys: path, measure })
        }
    }

    for (const path of shape.subtotals) {
        for (let measure = 0; measure < shape.measures; measure++) {
            out.set(subtotalId(path, measure), { keys: path, measure })
        }
    }

    if (!shape.withTotal) return out

    for (let measure = 0; measure < shape.measures; measure++) {
        out.set(totalId(measure), { keys: [], measure })
    }
    return out
}

export interface GroupLookup<TRow> {
    fields: ColumnDef<TRow>[]
    read: CellRead<TRow>
    idOf: (path: { columnId: string; key: string }[]) => string
    wanted: string
}

export function rowsInGroup<TRow>(nodes: RowNode<TRow>[], lookup: GroupLookup<TRow>): TRow[] {
    const { fields, read, idOf, wanted } = lookup
    const kept: TRow[] = []

    for (const node of nodes) {
        const path: { columnId: string; key: string }[] = []
        for (const field of fields) {
            path.push({ columnId: field.id, key: keyOf(node.row, field, read) })
            if (idOf(path) === wanted) {
                kept.push(node.row)
                break
            }
        }
    }
    return kept
}

export function startsWithKeys<TRow>(
    row: TRow,
    fields: ColumnDef<TRow>[],
    read: CellRead<TRow>,
    keys: string[]
): boolean {
    return keys.every((key, depth) => {
        const field = fields[depth]
        return field !== undefined && keyOf(row, field, read) === key
    })
}

export function cacheByKey(): (key: string, compute: () => unknown) => unknown {
    const seen = new Map<string, unknown>()
    return (key, compute) => {
        if (!seen.has(key)) seen.set(key, compute())
        return seen.get(key)
    }
}

export function cacheByRows<TRow>(): (
    rows: TRow[],
    slot: number,
    compute: () => unknown
) => unknown {
    const seen = new WeakMap<object, Map<number, unknown>>()
    return (rows, slot, compute) => {
        let found = seen.get(rows as object)
        if (!found) {
            found = new Map()
            seen.set(rows as object, found)
        }
        if (!found.has(slot)) found.set(slot, compute())
        return found.get(slot)
    }
}

export function offAxis<TRow>(
    defs: ColumnDef<TRow>[],
    taken: string[]
): { id: string; header: string }[] {
    const used = new Set(taken)
    return defs
        .filter((def) => !used.has(def.id))
        .map((def) => ({ id: def.id, header: String(def.header ?? def.id) }))
}

export function placesOf(ordered: string[]): (id: string) => number | undefined {
    const at = new Map(ordered.map((id, place) => [id, place]))
    return (id) => at.get(id)
}
