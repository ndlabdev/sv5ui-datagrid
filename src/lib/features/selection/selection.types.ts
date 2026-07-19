import type { SelectionMode } from '../../core/types.js'

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

export interface ExportCsvOptions {
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
}
