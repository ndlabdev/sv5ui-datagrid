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

/** A lone condition reads as a one-item `and`, so no consumer has to branch. */
export function normalizeFilterEntry(entry: ColumnFilterEntry): FilterRequestEntry {
    if (isFilterGroup(entry)) return { join: entry.join, conditions: entry.conditions }
    return { join: 'and', conditions: [entry] }
}

/** The conditions of an entry, whichever shape it arrived in. */
export function filterConditions(entry: ColumnFilterEntry): ColumnFilter[] {
    return isFilterGroup(entry) ? entry.conditions : [entry]
}

/**
 * The normalized request a server model sends, frozen apart from the model.
 *
 * `quickFields` names the columns the query applies to, which the model does
 * not carry: on the client it is whatever is visible at the time, and a
 * backend has nothing to work that out from.
 */
export function toFilterRequest(model: FilterModel, quickFields: string[] = []): FilterRequest {
    const columns: Record<string, FilterRequestEntry> = {}
    for (const [columnId, entry] of Object.entries(model.columns ?? {})) {
        columns[columnId] = normalizeFilterEntry(entry)
    }
    return { quick: model.quick ?? '', quickFields, columns }
}
