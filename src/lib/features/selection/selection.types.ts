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

    /**
     * Excludes rows from selection. Unselectable rows are skipped by
     * select-all and range selection and render a disabled checkbox.
     */
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
     * Exports every filtered row instead of only the selected ones.
     * Also the fallback when nothing is selected.
     * @default false
     */
    allRows?: boolean

    /**
     * Column separator. Excel follows the list separator of the machine's
     * locale, so `';'` is what much of Europe expects to open cleanly.
     * @default ','
     */
    delimiter?: string

    /**
     * Column ids to export, in this order. Hidden columns are fair game — an
     * id column left out of the grid can still belong in the file.
     * @default every visible column
     */
    columns?: string[]

    /**
     * Turns a cell into the exported text. Without it a value is written raw,
     * so a spreadsheet keeps it as a number or a date; with it the file can be
     * made to read the way the grid does.
     */
    formatValue?: ExportFormatter<TRow>
}
