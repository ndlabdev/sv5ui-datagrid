/**
 * Built-in aggregators, or a custom reducer over the group's values and rows.
 *
 * `sum`, `min`, `max`, `avg` and `median` read the numeric values and ignore
 * anything that is not a number; they return `null` when none is left.
 * `count` counts the group's rows, `distinctCount` counts distinct non-blank
 * values, and `first` / `last` return the first and last non-blank value in
 * the group's order.
 *
 * `{ kind: 'percentile', p }` takes `p` as a fraction between 0 and 1 -
 * `0.9` is the 90th percentile - and interpolates between the two
 * neighbouring values the way a spreadsheet does. `{ kind: 'weightedAvg',
 * weight }` reads each row's weight and returns `sum(value * weight) /
 * sum(weight)`, skipping any pair where either side is not numeric and
 * returning `null` when the weights total zero.
 */
export type Aggregation<TRow = unknown> =
    | 'sum'
    | 'min'
    | 'max'
    | 'avg'
    | 'count'
    | 'median'
    | 'distinctCount'
    | 'first'
    | 'last'
    | { kind: 'percentile'; p: number }
    | { kind: 'weightedAvg'; weight: (row: TRow) => unknown }
    | ((values: unknown[], rows: TRow[]) => unknown)

export interface GroupingOptions<TRow = unknown> {
    /**
     * Column ids to group by, outermost first.
     * @default []
     */
    by?: string[]

    /**
     * Aggregation per column id, shown on the group row.
     * Keyed by column id because a feature cannot add a field to `ColumnDef`.
     */
    aggregations?: Record<string, Aggregation<TRow>>

    /**
     * Expand every group the first time it appears.
     * @default true
     */
    expandedByDefault?: boolean

    /**
     * Label shown on a group row, before the aggregates.
     * @default (key, count) => `${key} (${count})`
     */
    groupLabel?: (key: string, count: number, columnId: string) => string

    /**
     * Close every expanded group with a footer row carrying the group's
     * aggregates, Excel-style.
     * @default false
     */
    groupFooters?: boolean

    /**
     * Label in the grouped column's cell of a footer row.
     * @default (key) => `Total - ${key}`
     */
    footerLabel?: (key: string, count: number, columnId: string) => string

    /**
     * Append a grand-total row aggregating every leaf row after the last
     * row. Works with or without active grouping, and reflects the current
     * filter. The row is in-flow - it scrolls with the data.
     * @default false
     */
    grandTotal?: boolean

    /**
     * Label on the grand-total row. Rendered in the first grouped column,
     * or in the first visible non-aggregated column when not grouped.
     * @default (count) => `Total (${count})`
     */
    grandTotalLabel?: (count: number) => string
}

/** Row object synthesised for a group row. */
export interface GroupRowValues {
    [columnId: string]: unknown
}
