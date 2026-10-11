import type { CellDecoration, ColumnState } from '../../core/types/index.js'

/**
 * Marks a cell for a moment when its value changes, so a grid fed by a socket
 * or a poll says what moved instead of leaving the reader to spot it.
 *
 * It reports only what it witnessed. A cell whose previous value this feature
 * never held is never marked, which is one rule covering every awkward case:
 * the first paint, a row scrolled into view for the first time, a row that
 * scrolled away and came back, and a row that is simply new. In each the
 * feature has no evidence of a change, and marking on no evidence would point
 * at cells nobody touched.
 *
 * That also bounds what it costs. Only the cells on screen are remembered,
 * because a cell nobody can see has nothing to say, so the memory is the size
 * of the window rather than of the data.
 *
 * Replace `data` with a new array to be seen. Mutating the rows in place
 * leaves the pipeline holding the same nodes, and nothing here can tell.
 */
export interface FlashCellsOptions<TRow = unknown> {
    /**
     * Which columns to watch. Left off, every visible column is watched,
     * which is what a reader expects: anything on screen that changes says so.
     *
     * Narrow it when only a few columns carry live numbers, since a column
     * nobody is watching costs a comparison per rendered row.
     *
     * A list of ids covers columns an application declared. A predicate
     * covers the ones it did not: a crossing generates its column ids from
     * the data, so they cannot be written down ahead of time.
     *
     * ```ts
     * columns: ['price']
     * columns: (column) => isPivotColumn(column.id)
     * columns: (column) => getPivot(grid)?.crossingMeasure(column.id) === 0
     * ```
     */
    columns?: string[] | ((column: ColumnState<TRow>) => boolean)

    /**
     * How long a cell stays marked, in milliseconds, counted from its own
     * change rather than from the last change anywhere.
     *
     * One timer still covers every mark: it is set to the earliest expiry
     * among them, drops the marks that reached it, and sets itself again for
     * the next. A thousand cells changing at once costs one timer, and a cell
     * that changed a second ago lets go while its neighbours keep moving,
     * which is what makes the mark mean "just now" on a grid that never stops.
     *
     * The mark fades over this time rather than blinking out, so a reader can
     * tell a change from half a second ago from one that has just landed. The
     * fade is CSS, driven by `--dg-flash-ms`, so nothing re-renders for it.
     *
     * @default 700
     */
    duration?: number

    /**
     * Mark a rise and a fall differently when both the old and the new value
     * are numbers. Anything else, including the first number arriving where
     * there was none, is marked without a direction.
     *
     * @default true
     */
    direction?: boolean

    /**
     * Decide the whole look yourself, per cell, instead of taking the outline.
     *
     * It is handed what changed and how long ago, so the mark can answer to
     * the size of the move rather than only its direction: a tenth of a
     * percent and a ten percent jump need not look alike. Return `undefined`
     * to take the default for that cell.
     *
     * ```ts
     * appearance: ({ way, before, after }) => {
     *     const jump = Math.abs(Number(after) - Number(before))
     *     if (!Number.isFinite(jump) || jump < 10) return undefined
     *     return { style: { 'background-color': way === 'up' ? '#dcfce7' : '#fee2e2' } }
     * }
     * ```
     *
     * Reaching for a class instead keeps the cell themeable; reaching for
     * `style` is how a value computed per cell gets in, the way a colour scale
     * does.
     */
    appearance?: (mark: FlashMark & { age: number }) => CellDecoration | undefined
}

/** A cell the feature is marking: what happened, and when. */
export interface FlashMark {
    way: FlashWay
    /** `Date.now()` at the sweep that saw it. */
    at: number
    /** The value the feature was holding. */
    before: unknown
    /** The value it found. */
    after: unknown
}

/** What happened to a cell, as the decoration reads it. */
export type FlashWay = 'up' | 'down' | 'changed'
