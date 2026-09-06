export interface RangeSelectionOptions {
    /**
     * Allow several ranges at once (Ctrl/Cmd while starting a new one).
     * @default true
     */
    multiple?: boolean

    /**
     * Let Ctrl/Cmd+V write the clipboard into the range. Requires the
     * `editing` feature; only editable cells are written.
     * @default true
     */
    paste?: boolean

    /**
     * Let `Ctrl/Cmd+Enter` from an open editor write the value into every
     * editable cell of the selection instead of only the cell being edited,
     * the way a spreadsheet does. Requires the `editing` feature, and takes
     * effect only while the edited cell is inside a selection of more than
     * one cell - a lone cell keeps Community's plain commit.
     * @default true
     */
    rangeEdit?: boolean

    /**
     * Let `Ctrl/Cmd+X` mark the range and the next `Ctrl/Cmd+V` **move** it -
     * the values land at the new place and the cells they came from are
     * cleared, in one undo step. Dragging the range's border moves it the
     * same way. Requires the `editing` feature, since a move is a write.
     *
     * A cleared cell is written as `null`, which still goes through the
     * column's `parse`: a `parse` that cannot represent empty decides what
     * empty becomes there.
     * @default true
     */
    cut?: boolean

    /**
     * Show the fill handle on the range's bottom-right cell, and enable
     * `Ctrl/Cmd+D` / `Ctrl/Cmd+R`. Like `paste`, this writes through the
     * `editing` feature, so without it the handle does nothing.
     * @default true
     */
    fill?: boolean
}

export interface CopyRangeOptions {
    /** Prepend a row of column headers. */
    headers?: boolean

    /**
     * Copy what the grid is showing - the column's `type` applied - rather
     * than the value behind it. Off by default, matching the Community
     * `copySelection` default, so a paste into a spreadsheet keeps a number a
     * number. A column whose `type` draws a widget has no text of its own and
     * falls back to the raw value.
     * @default false
     */
    formatted?: boolean

    /**
     * Also write a `text/html` table, so a paste into Word, Google Docs or
     * Excel keeps the grid shape instead of arriving as one line of text.
     * The plain-text flavour is written either way, and is the one that
     * pastes back into this grid.
     * @default true
     */
    html?: boolean
}
