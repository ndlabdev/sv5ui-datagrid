import type { ColumnDef, ColumnState } from './types.js'

/**
 * Column lookups run per cell, per header and per feature event, so they are
 * indexed instead of scanned. Both maps are rebuilt whole by the deriveds that
 * own them and never mutated in place.
 */
export function columnsById<TRow>(
    columns: ColumnState<TRow>[]
): ReadonlyMap<string, ColumnState<TRow>> {
    return new Map(columns.map((column) => [column.id, column]))
}

export function columnIndexById<TRow>(columns: ColumnState<TRow>[]): ReadonlyMap<string, number> {
    return new Map(columns.map((column, index) => [column.id, index]))
}

export function orderLeafDefs<TRow>(
    leafDefs: ColumnDef<TRow>[],
    orderIds: string[]
): ColumnDef<TRow>[] {
    const byId = new Map(leafDefs.map((def) => [def.id, def]))
    const ordered: ColumnDef<TRow>[] = []
    const seen = new Set<string>()

    for (const id of orderIds) {
        const def = byId.get(id)
        if (def && !seen.has(id)) {
            ordered.push(def)
            seen.add(id)
        }
    }
    for (const def of leafDefs) {
        if (!seen.has(def.id)) ordered.push(def)
    }
    return ordered
}
