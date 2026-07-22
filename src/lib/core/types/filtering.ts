/** Filter model: operators, the serializable filter and its column config. */

export type TextFilterOp = 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'blank'
export type NumberFilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'between' | 'blank'
export type DateFilterOp = 'equals' | 'before' | 'after' | 'between'

/** Primitive values a set filter can match against. */
export type SetFilterValue = string | number | boolean | null

/**
 * One column's filter. The discriminated `kind` drives both the
 * predicate and the editor UI. Fully JSON-serializable.
 */
export type ColumnFilter =
    | { kind: 'text'; op: TextFilterOp; value: string }
    | { kind: 'number'; op: NumberFilterOp; value?: number; to?: number }
    | { kind: 'date'; op: DateFilterOp; value?: string; to?: string }
    | { kind: 'set'; values: SetFilterValue[] }
    | { kind: 'boolean'; value: boolean }

/**
 * Serializable filter model.
 * Drives state persistence and server-side row model requests.
 */
export interface FilterModel {
    /** Quick-filter query matched against all visible columns. */
    quick: string
    /** Per-column filters, keyed by column id. */
    columns: Record<string, ColumnFilter>
}

export type FilterType = ColumnFilter['kind']

/**
 * Advanced per-column filter configuration.
 */
export interface ColumnFilterDef<TRow> {
    /** Editor UI and default predicate family. */
    type: FilterType
    /**
     * Custom predicate overriding the built-in one. Receives the cell
     * value, the raw row and the active filter.
     */
    predicate?: (value: unknown, row: TRow, filter: ColumnFilter) => boolean
}
