import type { ColumnType } from '../../core/types/index.js'
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
 *
 * The last four read a cell against the ones beside it rather than against a
 * total, so they follow the order the crossing is drawn in.
 *
 * `runningTotal` is the measure over every crossing up to and including this
 * one, which is how a year to date reads. It takes only `sum` and `count`,
 * the reductions where running the rows and adding the cells give the same
 * answer; for any other the cells are left empty and the grid says so once,
 * because a running median is not something to guess at.
 *
 * `differenceFrom` is this cell less the one before it, and
 * `percentDifferenceFrom` is that difference over the one before, which is how
 * growth between two periods reads. `rankInRow` places the cell among the
 * others on its row, one being the largest.
 *
 * All four are left empty on a subtotal and on a total column: those stand
 * outside the run, so a difference from them would be a difference from
 * nothing in particular.
 */
export type PivotShowAs =
    | 'percentOfRow'
    | 'percentOfColumn'
    | 'percentOfTotal'
    | 'runningTotal'
    | 'differenceFrom'
    | 'percentDifferenceFrom'
    | 'rankInRow'

/** One thing being measured: a column to read, and how to reduce it. */
export interface PivotMeasure<TRow = unknown> {
    /** Column id whose values are reduced. */
    field: string

    /** How to reduce them. The same set `grouping()` accepts. */
    agg: Aggregation<TRow>

    /**
     * Divides this measure by the same reduction of another column, which is
     * how a margin, a rate or an average per something is read.
     *
     * `{ field: 'profit', agg: 'sum', per: 'revenue' }` is the profit of a
     * crossing over its revenue. It divides the two reductions, not the rows:
     * the margin of a group is not the average of its rows' margins, and the
     * two differ by more the more the rows differ in size.
     *
     * A reduction written as a function can do this already, but only on the
     * client and only until the view is saved. This crosses the wire and comes
     * back from a snapshot, because it is two column names and a reduction.
     *
     * A crossing with no rows, or one whose divisor comes to nothing, draws
     * empty rather than an infinity. `runningTotal` refuses it: ratios do not
     * add up, so running them would mean nothing.
     */
    per?: string

    /**
     * What the result is, when that is not what the measured column was. A
     * ratio is the usual reason: profit is money, but profit over revenue is
     * a percentage, and nothing but the application knows which.
     *
     * Without it a measure keeps the type of the column it measured, except
     * for a count, which is a count of anything.
     */
    type?: ColumnType

    /**
     * Reads this measure as something other than the number it reduced to:
     * a share of a total, a running total, a change from the crossing before
     * it, or a rank among the crossings beside it. Left out, the measure is
     * drawn as it was measured.
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
     * Which axis the measures stack on.
     *
     * On `'columns'` every crossing splits into one leaf per measure, so the
     * table is as many columns wide as crossings times measures. On `'rows'`
     * each crossing is a single column and every group opens into one row per
     * measure instead, headed by a generated column naming which measure the
     * row holds.
     *
     * Reach for `'rows'` when there are more measures than a reader can scan
     * sideways: the column axis stops multiplying, so `maxColumns` buys as
     * many crossings again, and a group folded shut still shows its measures.
     *
     * Two things follow from a column no longer naming a measure. Sorting by a
     * crossing sorts the groups by the first measure, and the grid says so
     * once. Measures whose results are of different types share one column, so
     * that column carries no type and each value is drawn as it comes; give
     * them the same `type` to get it back.
     *
     * `rowModel: "server"` keeps the measures on the column axis whatever this
     * says, since splitting a row the server sent is not the client's to do.
     *
     * @default 'columns'
     */
    valuesOn?: PivotValuesOn

    /**
     * Keep only some of the gathered rows, ranked by what a measure makes of
     * them.
     *
     * A crossing of forty regions is a page nobody reads. `{ top: 10 }` keeps
     * the ten largest and leaves the rest out, which is how a report of that
     * shape is read everywhere it is read at all.
     *
     * The ranking is measured from the rows of each gathered row, the way
     * `totalColumn` measures, not added up from the cells drawn beside it, and
     * it is measured whether or not a total column is asked for. `measure`
     * picks which of `values` ranks them; the reading a `showAs` puts on that
     * measure is left out of it, since a rank by percentage of its own row
     * would put every row at the same place.
     *
     * What is left out is left out of everything: the total row and every
     * share are measured over the rows that remain, so the page adds up to
     * what it shows. `others` is the way to keep it all: the rows that lost
     * are gathered into one more row under that name, measured from
     * themselves, and the totals then cover everything again.
     *
     * With more than one row field this applies to the outermost, which is the
     * one the question is about. Opening a row that survived still shows every
     * field under it.
     */
    keepRows?: PivotKeepRows

    /**
     * A row at the bottom holding each measure over every row the grid is
     * showing, headed by this text in the first row field's column. Left out,
     * there is no total row.
     */
    totalRow?: string
}

/** Which axis `pivot()` stacks its measures on. */
export type PivotValuesOn = 'columns' | 'rows'

/** Which of the gathered rows a pivot keeps, and what becomes of the rest. */
export interface PivotKeepRows {
    /** Keep this many, the largest first. */
    top?: number

    /** Or keep this many, the smallest first. Ignored when `top` is given. */
    bottom?: number

    /** Which measure ranks them, by its place in `values`. */
    measure?: number

    /** Gather everything left out into one row under this name. */
    others?: string
}
