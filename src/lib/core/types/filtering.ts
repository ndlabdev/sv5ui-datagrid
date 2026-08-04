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

/**
 * One condition. The discriminated `kind` drives both the predicate and the
 * editor UI. Fully JSON-serializable.
 */
export type ColumnFilter =
    | { kind: 'text'; op: TextFilterOp; value: string; caseSensitive?: boolean }
    | { kind: 'number'; op: NumberFilterOp; value?: number; to?: number }
    | { kind: 'date'; op: DateFilterOp; value?: string; to?: string }
    | { kind: 'set'; values: SetFilterValue[] }
    | { kind: 'boolean'; value: boolean }

/** How the two conditions of one column combine. */
export type FilterJoin = 'and' | 'or'

/**
 * Two conditions on the same column. Only produced when a second condition is
 * actually filled in, so a one-condition filter keeps the plain shape it has
 * always had and snapshots written before groups existed still hydrate.
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

/**
 * One column's filter in normalized form: always a list, always joined, even
 * when there is a single condition.
 */
export interface FilterRequestEntry {
    join: FilterJoin
    conditions: ColumnFilter[]
}

/**
 * The filter as it leaves the grid for a server. Deliberately separate from
 * `FilterModel`: this shape crosses the network into code the grid does not
 * own, so it stays normalized and stable while the internal model is free to
 * grow new shorthands. Build one with `toFilterRequest`.
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
    /**
     * Custom predicate overriding the built-in one. Receives the cell
     * value, the raw row and the active condition — once per condition
     * when the column carries two.
     */
    predicate?: (value: unknown, row: TRow, filter: ColumnFilter) => boolean
}
