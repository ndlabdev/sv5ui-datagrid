/**
 * What a cell shows instead of the number underneath it.
 *
 * `percentOfGrandTotal` divides by the column's total over every row that
 * survived the filter. `percentOfParent` divides by the same column on the row
 * above it in the hierarchy - the group a row sits in, the parent row on a
 * tree - and falls back to the grand total at the top level.
 * `{ kind: 'percentOfRow', of }` divides by the sum of the named columns in
 * the same row, which is how a month-per-column table reads across.
 *
 * On a grouped grid, `percentOfParent` divides by the group row, which holds a
 * number only for a column `grouping()` aggregates. Give the column an
 * aggregation of its own as well; without one there is no denominator, the
 * column reads blank, and the grid says so once in the console.
 *
 * Under `rowModel: 'server'` the two whole-column shares are skipped, because
 * the client holds only the blocks it has loaded and a share measured against
 * those would change as the user scrolls. `percentOfRow` still runs, since it
 * reads one row at a time. The grid says so once in the console, and
 * `getShowValuesAs(grid).skippedColumns` lists what was left alone.
 *
 * The share is a fraction: `0.34`, not `34`. Declare the column
 * `type: 'percent'` and the grid formats it as `34%` on screen, in the
 * clipboard and in every export.
 */
export type ShowAs =
    'percentOfGrandTotal' | 'percentOfParent' | { kind: 'percentOfRow'; of: string[] }

export interface ShowValuesAsOptions {
    /**
     * How each column is shown, keyed by column id. A column not named here
     * keeps its own value.
     *
     * @default {}
     */
    columns?: Record<string, ShowAs>
}
