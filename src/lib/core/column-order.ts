import type { ColumnDef } from './types.js'

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
