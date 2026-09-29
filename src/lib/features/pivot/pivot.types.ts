import type { Aggregation } from '../grouping/grouping.types.js'

/**
 * A measure read as a share of something larger instead of as itself.
 *
 * `percentOfRow` divides by what the same measure makes of every row the
 * gathered row holds, so a row reads across to 1. `percentOfColumn` divides by
 * what it makes of every row under the same crossing, so a column reads down
 * to 1. `percentOfTotal` divides by every row the grid is showing.
 *
 * Each denominator is measured from the rows, never added up from the cells
 * beside it, for the reason `totalColumn` gives: the average of a group is not
 * the average of its columns' averages.
 *
 * The share is a fraction, and the generated column is typed `percent`, so
 * `0.34` is drawn as `34%` on screen and in every export.
 */
export type PivotShowAs = 'percentOfRow' | 'percentOfColumn' | 'percentOfTotal'

/** One thing being measured: a column to read, and how to reduce it. */
export interface PivotMeasure<TRow = unknown> {
    /** Column id whose values are reduced. */
    field: string

    /** How to reduce them. The same set `grouping()` accepts. */
    agg: Aggregation<TRow>

    /**
     * Reads this measure as a share instead of as itself. Left out, the
     * measure is drawn as the number it reduced to.
     */
    showAs?: PivotShowAs

    /**
     * Header for this measure's leaf, used only when there is more than one
     * measure. With a single measure the crossing key alone heads the column,
     * since repeating one name under every key reads as noise.
     */
    header?: string
}

/**
 * How the grid crosses one field by another.
 *
 * On `rowModel: 'server'` the grid sends the crossing rather than making it:
 * a table measured over the blocks this client happens to hold looks exactly
 * like a correct one, so the server is the only side that can answer it. The
 * crossing goes out as `pivot` on every `getRows` request and the keys come
 * back as `pivotColumns`, which is also where the column axis comes from,
 * since the client cannot learn it from part of the data.
 *
 * Without a `serverRowModel()` to carry it, the grid crosses nothing, draws
 * the rows unchanged, and says so once in the console.
 * `getPivot(grid).serverHandled` is what a UI reads to tell the two apart.
 *
 * `rows`, `columns` and `values` are the crossing the grid starts on. The
 * feature owns them from then, the way `grouping()` owns `by`, and they change
 * through `grid.api`: `setPivotRows`, `setPivotColumns`, `setPivotValues`,
 * `addPivotRowField`, `addPivotColumnField`, `removePivotField`, `clearPivot`.
 * A column menu offers the same moves, and a saved view carries them back.
 *
 * Taking the last field off an axis is not an error, it turns the crossing off:
 * the grid draws its rows unchanged until a field goes back on. Starting with
 * an empty axis is an error, since that is a misconfiguration rather than a
 * choice anyone made.
 *
 * The rest of the fields here are read when the grid needs them and are not
 * part of what a snapshot carries.
 */
export interface PivotOptions<TRow = unknown> {
    /**
     * Column ids gathered down the page, the way `grouping({ by })` gathers.
     * More than one nests: the second gathers inside the first.
     */
    rows: string[]

    /**
     * Column ids gathered across the page. Every distinct value becomes a
     * column, in sorted order. More than one nests: the second field's values
     * become header groups inside the first field's, so the header grows a row
     * per field.
     *
     * The keys come from the data before any filter, so the set of columns is
     * the same whatever the user has filtered to: filtering every row of a key
     * away leaves that column standing and empties its cells rather than
     * removing it. Reading the filtered rows instead would close a loop, since
     * the filter reads the columns.
     */
    columns: string[]

    /**
     * What each cell of the crossing holds. More than one splits every
     * generated column into one leaf per measure, headed by the measure.
     *
     * While a crossing is on, the grid draws the row fields and the columns it
     * generated, and nothing else: a column taking no part in the crossing has
     * no single value on a gathered row, so it would draw empty on every one.
     * They are hidden rather than dropped, so they stay filterable, and
     * narrowing the field that runs across the page is most of how a pivot is
     * read. Turning the crossing off brings them all back.
     */
    values: PivotMeasure<TRow>[]

    /**
     * Refuse rather than draw when the data would generate more columns than
     * this. A table nobody can read is worse than no table, and silently
     * cutting the list would present a wrong one as right.
     *
     * Counted in leaf columns, which is what lands on screen: two measures
     * over the same crossings draw twice the leaves and count twice.
     *
     * @default 100
     */
    maxColumns?: number

    /**
     * Names a generated header, replacing the label the grid would draw.
     *
     * Receives the key as text, where a blank arrives as `(blank)`; which
     * column field it came from, `0` being the first entry of `columns`; and
     * the value as the data holds it, before it became text.
     *
     * Without this, a key is drawn through the formatter of the field it came
     * from, so a date axis reads as dates and a number axis as numbers. Naming
     * a key does not reorder it: the order comes from the values, so renaming
     * `Small` to `S` leaves it where `Small` sat.
     */
    columnHeader?: (key: string, depth: number, value: unknown) => string

    /**
     * A column at the end holding each measure over every row of the group,
     * headed by this text. Left out, there is no total column.
     *
     * It is measured from the rows, not from the cells beside it, so it is not
     * always their sum: the average of a group is not the average of its
     * columns' averages unless every column holds the same number of rows.
     */
    totalColumn?: string

    /**
     * Lets the user sort the rows by a generated column, which orders the
     * groups by what the crossing measured rather than ordering any data.
     *
     * Off by default: the rows a pivot draws are gathered, so a click on a
     * crossing header reorders whole groups, which is a different thing from
     * what the same click does anywhere else in the grid.
     *
     * On `rowModel: 'server'` the order goes out as `pivot.sort` and the
     * server answers it. The client never reorders a server pivot itself: it
     * holds only the blocks it has loaded, so the order would be of those.
     *
     * @default false
     */
    sortableColumns?: boolean

    /**
     * The keys one column field puts on the axis, in the order it wants them,
     * instead of the ones the grid would read from the data.
     *
     * Asked once per field, with the field's column id and its place in
     * `columns`. Answer `undefined` to leave that field alone.
     *
     * Two things it is for. A key with no rows behind it still gets a column,
     * which is how a report shows every month of the year including the ones
     * nothing happened in. And an order the values do not have on their own,
     * such as `Low`, `Medium`, `High`, which sort into the wrong order under
     * every rule except the one only the application knows.
     *
     * A key the data has and this list leaves out is dropped, so answering a
     * short list is also how a field is narrowed.
     */
    columnKeys?: (field: string, depth: number) => unknown[] | undefined

    /**
     * A column closing each group of the column axis, holding each measure over
     * every row that group gathered. Receives the group's own header and
     * answers the subtotal's; left out, there are no subtotals.
     *
     * Only groups get one, so a single column field produces none: with one
     * field every generated column is already a leaf, and the subtotal would
     * repeat it.
     *
     * Measured from the rows the branch gathered, not added up from the columns
     * beside it, for the reason `totalColumn` gives.
     */
    columnSubtotal?: (header: string) => string

    /**
     * `getPivot(grid).rowsBehind(node, columnId)` answers the rows a cell was
     * measured from, which is the first question a reader asks of a number
     * they did not expect. It answers the rows a filter left, and the rows
     * themselves, so a masked column is masked only where the grid draws it.
     *
     * On `rowModel: 'server'` it answers nothing and says so once: the client
     * holds the crossed rows the server sent, not the rows behind them.
     */

    /**
     * Whether a reader can fold a group of the column axis away, and which
     * state it starts in. `'open'` and `'closed'` both make it foldable.
     *
     * Folded, a group shows its `columnSubtotal` and nothing else, which is
     * how a wide crossing is read one branch at a time. Without a subtotal
     * there would be nothing left to show, so the group folds to a narrow
     * labelled rail instead.
     *
     * Only groups fold, so a single column field has none: with one field
     * every generated column is already a leaf.
     *
     * The control a reader folds with lives in `columnOps()`, so register that
     * too or the groups are foldable only through the api.
     *
     * @default 'fixed'
     */
    columnGroups?: 'fixed' | 'open' | 'closed'

    /**
     * A row at the bottom holding each measure over every row the grid is
     * showing, headed by this text in the first row field's column. Left out,
     * there is no total row.
     */
    totalRow?: string
}
