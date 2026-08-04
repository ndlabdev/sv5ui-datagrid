import type { DateFilterOp, NumberFilterOp, TextFilterOp } from './filtering.js'
import type { DataGridAnnouncerStrings } from './grid.js'

/**
 * Every string the grid renders itself. Anything a user reads and did not
 * supply lives here, so translating the grid is one object rather than a hunt
 * through components.
 *
 * Entries are plain strings unless a value has to be interpolated, in which
 * case they are functions — a translation can then put the number wherever its
 * language needs it. Announcer strings are separate, in
 * `DataGridAnnouncerStrings`: those are spoken, these are seen.
 */
export interface DataGridLabels {
    // Toolbar
    search: string
    activeFilters: string
    removeFilter: (column: string) => string
    clearAllFilters: string
    chooseColumns: string
    rowDensity: string
    densityCompact: string
    densityStandard: string
    densityComfortable: string

    // Header and column menu
    columnMenu: (column: string) => string
    resizeColumn: (column: string) => string
    resizeGroup: (group: string) => string
    sortAscending: string
    sortDescending: string
    clearSort: string
    pinLeft: string
    pinRight: string
    unpin: string
    openFilter: string
    autosize: string
    hideColumn: string

    // Filter panel. The ordinal is 1 for the first condition of a column.
    filterColumn: (column: string) => string
    filterOperator: (ordinal: number) => string
    filterValue: (ordinal: number) => string
    filterUpperBound: (ordinal: number) => string
    valuePlaceholder: string
    upperBoundPlaceholder: string
    searchValues: string
    blankValue: string
    combineConditions: string
    addCondition: string
    removeCondition: string
    matchCase: string
    apply: string
    clear: string
    and: string
    or: string
    yes: string
    no: string
    textOps: Record<TextFilterOp, string>
    numberOps: Record<NumberFilterOp, string>
    dateOps: Record<DateFilterOp, string>

    // Rows
    selectRow: (position: number) => string
    selectAllRows: string
    rowActions: string
    dragRow: (position: number) => string
    expandRow: string
    collapseRow: string

    // Footer, status bar and overlays
    rowsPerPage: string
    /** One page-size choice, e.g. "25 / page". */
    pageSizeOption: (size: number) => string
    /** The footer's "1–25 of 300" summary. */
    pageRange: (from: number, to: number, total: number) => string
    totalRows: (total: number) => string
    filteredRows: (filtered: number, total: number) => string
    selectedRows: (count: number) => string
    noData: string
    retry: string

    // Context menu and the toolbar's export menu
    copy: string
    copyWithHeaders: string
    exportCsv: string
    exportAllRows: string
    exportSelectedRows: string
    clearSelection: string
}

/**
 * What an app passes as `labels`: any subset, with the operator maps
 * overridable one entry at a time rather than whole.
 */
export type DataGridLabelsInput = Partial<
    Omit<DataGridLabels, 'textOps' | 'numberOps' | 'dateOps'>
> & {
    textOps?: Partial<Record<TextFilterOp, string>>
    numberOps?: Partial<Record<NumberFilterOp, string>>
    dateOps?: Partial<Record<DateFilterOp, string>>
}

/**
 * One language, ready to use: what the grid shows and what it announces,
 * under the tag they belong to.
 *
 * An app hands the grid the packs it wants available and the grid picks one
 * from the page's language — no per-string configuration, and only the packs
 * actually imported end up in the bundle.
 */
export interface DataGridLocalePack {
    /** BCP-47 tag, e.g. `'vi-VN'`. Matched against the page's language. */
    tag: string
    labels: DataGridLabels
    announcer: DataGridAnnouncerStrings
}
