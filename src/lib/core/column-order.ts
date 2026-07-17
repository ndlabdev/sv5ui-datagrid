import type { ColumnDef, ColumnStateSnapshot, PinnedSide } from './types.js'

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

export function sanitizeColumnState(
    snapshot: ColumnStateSnapshot,
    knownIds: string[]
): ColumnStateSnapshot {
    const known = new Set(knownIds)
    const pick = <T>(record: Record<string, T>): Record<string, T> =>
        Object.fromEntries(Object.entries(record ?? {}).filter(([id]) => known.has(id)))

    const pinned: Record<string, PinnedSide | null> = {}
    for (const [id, side] of Object.entries(pick(snapshot.pinned))) {
        pinned[id] = side === 'left' || side === 'right' ? side : null
    }

    return {
        order: (snapshot.order ?? []).filter((id) => known.has(id)),
        widths: pick(snapshot.widths),
        hidden: pick(snapshot.hidden),
        pinned
    }
}
