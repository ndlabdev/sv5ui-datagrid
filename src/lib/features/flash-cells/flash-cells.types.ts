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
export interface FlashCellsOptions {
    /**
     * Column ids to watch. Left off, every visible column is watched, which
     * is what a reader expects: anything on screen that changes says so.
     *
     * Narrow it when only a few columns carry live numbers, since a column
     * nobody is watching costs a comparison per rendered row.
     */
    columns?: string[]

    /**
     * How long a cell stays marked, in milliseconds.
     *
     * One timer covers every mark rather than one per cell or one per batch,
     * so a thousand cells changing at once costs one timer and a stream of
     * changes cannot pile them up. The clock restarts on each batch, so a mark
     * lasts at least this long and at most this long after the last change
     * anywhere on screen. Under a steady stream that reads as a cell staying
     * lit while the stream runs, which is the honest picture of it.
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
}

/** What happened to a cell, as the decoration reads it. */
export type FlashWay = 'up' | 'down' | 'changed'
