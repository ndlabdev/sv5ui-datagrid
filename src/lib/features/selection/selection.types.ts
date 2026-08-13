import type { SelectionMode } from '../../core/types/index.js'
import type { ExportFormatter } from './clipboard.js'

export interface SelectionOptions<TRow> {
    /**
     * Selection mode. `'single'` keeps at most one selected row.
     * @default 'multiple'
     */
    mode?: SelectionMode

    /**
     * Renders the synthetic checkbox column pinned to the left edge.
     * @default true
     */
    checkbox?: boolean

    /** Skipped by select-all and range selection, with a disabled checkbox. */
    isRowSelectable?: (row: TRow) => boolean
}

export type SelectAllState = 'none' | 'some' | 'all'

export interface ToggleModifiers {
    /** Extends the selection from the anchor row (range select). */
    shift?: boolean
    /** Toggles the row while keeping the rest of the selection. */
    ctrl?: boolean
}

export interface CopyOptions {
    /** Prepends a header row with the visible column labels. */
    headers?: boolean

    /**
     * Copies what the grid is showing — the column's `type` applied — rather
     * than the value behind it. Off by default, so a paste into a spreadsheet
     * keeps a number a number. A column whose `type` draws a widget has no text
     * of its own and falls back to the raw value.
     * @default false
     */
    formatted?: boolean
}

export interface ExportCsvOptions<TRow = unknown> {
    /**
     * Download file name.
     * @default 'export.csv'
     */
    filename?: string

    /**
     * Prepends a header row with the visible column labels.
     * @default true
     */
    headers?: boolean

    /**
     * Every filtered row rather than the selection; also the fallback when
     * nothing is selected.
     * @default false
     */
    allRows?: boolean

    /**
     * Excel follows the machine's list separator, so much of Europe needs `';'`.
     * @default ','
     */
    delimiter?: string

    /**
     * Ids to export, in this order. Hidden columns are fair game.
     * @default every visible column
     */
    columns?: string[]

    /** Without it a value is written raw, so a spreadsheet keeps its type. */
    formatValue?: ExportFormatter<TRow>

    /**
     * Writes what the grid is showing — the column's `type` applied — rather
     * than the value behind it. Off by default, because a spreadsheet wants a
     * number it can sum and a date it can sort. A column whose `type` draws a
     * widget has no text of its own and falls back to the raw value.
     *
     * `formatValue` wins over this, being the caller saying something specific.
     * @default false
     */
    formatted?: boolean
}
