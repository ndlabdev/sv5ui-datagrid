import type {
    ColumnFilter,
    ColumnFilterEntry,
    FilterModel,
    FilterRequest,
    FilterRequestEntry
} from '../../core/types/index.js'

/** True for the grouped shape, so the single-condition shape narrows cleanly. */
export function isFilterGroup(
    entry: ColumnFilterEntry
): entry is Extract<ColumnFilterEntry, { kind: 'group' }> {
    return entry.kind === 'group'
}

/**
 * One entry in the shape everything downstream wants: a list of conditions and
 * the join between them. A lone condition reads as a one-item `and`, so a
 * consumer never has to branch on which shape it was given.
 */
export function normalizeFilterEntry(entry: ColumnFilterEntry): FilterRequestEntry {
    if (isFilterGroup(entry)) return { join: entry.join, conditions: entry.conditions }
    return { join: 'and', conditions: [entry] }
}

/** The conditions of an entry, whichever shape it arrived in. */
export function filterConditions(entry: ColumnFilterEntry): ColumnFilter[] {
    return isFilterGroup(entry) ? entry.conditions : [entry]
}

/**
 * Collapses a filter model into the normalized request a server row model
 * sends. Kept separate from the model itself so the wire format can stay
 * frozen while the model gains shorthands.
 */
export function toFilterRequest(model: FilterModel): FilterRequest {
    const columns: Record<string, FilterRequestEntry> = {}
    for (const [columnId, entry] of Object.entries(model.columns ?? {})) {
        columns[columnId] = normalizeFilterEntry(entry)
    }
    return { quick: model.quick ?? '', columns }
}
