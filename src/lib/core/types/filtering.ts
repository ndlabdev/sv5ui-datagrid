/** Filter model: operators, the serializable filter and its column config. */

export type TextFilterOp =
    | 'contains'
    | 'notContains'
    | 'equals'
    | 'notEqual'
    | 'startsWith'
    | 'endsWith'
    | 'blank'
    | 'notBlank'
export type NumberFilterOp =
    'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'blank' | 'notBlank'
export type DateFilterOp = 'equals' | 'before' | 'after' | 'between' | 'blank' | 'notBlank'

/** Operators that test presence and therefore carry no value. */
export type PresenceFilterOp = 'blank' | 'notBlank'

/** Primitive values a set filter can match against. */
export type SetFilterValue = string | number | boolean | null

/** One condition; `kind` drives both the predicate and the editor UI. */
export type ColumnFilter =
    | { kind: 'text'; op: TextFilterOp; value: string; caseSensitive?: boolean }
    | { kind: 'number'; op: NumberFilterOp; value?: number; to?: number }
    | { kind: 'date'; op: DateFilterOp; value?: string; to?: string }
    | { kind: 'set'; values: SetFilterValue[] }
    | { kind: 'boolean'; value: boolean }

/** How the two conditions of one column combine. */
export type FilterJoin = 'and' | 'or'

/**
 * Two conditions on one column, produced only when the second is filled in —
 * a lone condition keeps its plain shape and older snapshots still hydrate.
 */
export interface ColumnFilterGroup {
    kind: 'group'
    join: FilterJoin
    conditions: ColumnFilter[]
}

/** What one column's entry in the filter model may be. */
export type ColumnFilterEntry = ColumnFilter | ColumnFilterGroup

/** Serializable filter model. Drives state persistence and the filter UI. */
export interface FilterModel {
    /** Quick-filter query matched against all visible columns. */
    quick: string
    /** Per-column filters, keyed by column id. */
    columns: Record<string, ColumnFilterEntry>
}

/** Normalized: always a list and a join, even for one condition. */
export interface FilterRequestEntry {
    join: FilterJoin
    conditions: ColumnFilter[]
}

/**
 * The filter as it leaves for a server. Separate from `FilterModel` so it can
 * stay frozen while the internal model grows. Built by `toFilterRequest`.
 */
export interface FilterRequest {
    quick: string
    columns: Record<string, FilterRequestEntry>
}

export type FilterType = ColumnFilter['kind']

/** Advanced per-column filter configuration. */
export interface ColumnFilterDef<TRow> {
    /** Editor UI and default predicate family. */
    type: FilterType
    /** Overrides the built-in one; called once per condition. */
    predicate?: (value: unknown, row: TRow, filter: ColumnFilter) => boolean
}
