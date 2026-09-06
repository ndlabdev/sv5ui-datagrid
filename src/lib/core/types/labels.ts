import type { DateFilterOp, NumberFilterOp, TextFilterOp } from './filtering.js'
import type { DataGridAnnouncerStrings } from './grid.js'

/**
 * Every string the grid renders. Functions where a value is interpolated, so
 * a language can put the number where it needs it. What the grid *speaks*
 * lives in `DataGridAnnouncerStrings`.
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
    /** Folds a header group down to the columns it shows when closed. */
    collapseGroup: (group: string) => string
    /** Unfolds it again. */
    expandGroup: (group: string) => string

    // Filter panel. The ordinal is 1 for the first condition of a column.
    filterColumn: (column: string) => string
    filterOperator: (ordinal: number) => string
    filterValue: (ordinal: number) => string
    /** The field in the filter row: named apart from the panel's own trigger. */
    filterRowValue: (column: string) => string
    filterUpperBound: (ordinal: number) => string
    valuePlaceholder: string
    upperBoundPlaceholder: string
    searchValues: string
    blankValue: string
    /** The choice that filters nothing, on a column whose filter is a choice. */
    anyValue: string
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
    /**
     * What `exportAllRows` becomes under `rowModel: 'server'`, where the grid
     * holds one page and cannot honestly offer the rest.
     */
    exportLoadedRows: string
    exportSelectedRows: string
    clearSelection: string

    groupBy: string
    groupPanelEmpty: string
    addGroup: string
    clearGroups: string
    moveGroupEarlier: (column: string) => string
    moveGroupLater: (column: string) => string
    removeGroup: (column: string) => string

    groupByColumn: string
    ungroupColumn: string

    groupFooter: (key: string, count: number) => string
    grandTotal: (count: number) => string

    groupLoaded: (key: string, count: number) => string
    groupFooterLoaded: (key: string, count: number) => string
    grandTotalLoaded: (count: number) => string

    rangeCells: (count: string) => string
    rangeShape: (rows: number, columns: number) => string
    rangeSum: string
    rangeAvg: string
    rangeMin: string
    rangeMax: string

    commandPaletteTitle: string
    commandPalettePlaceholder: string
    commandPaletteEmpty: string
    commandGroupDefault: string

    commandShowColumn: (column: string) => string
    commandHideColumn: (column: string) => string
    commandUnpinColumn: (column: string) => string
    commandPinColumnLeft: (column: string) => string
    commandPinColumnRight: (column: string) => string
    commandGroupByColumn: (column: string) => string
    commandUngroupColumn: (column: string) => string
    commandExpandAllGroups: string
    commandCollapseAllGroups: string
    commandClearGrouping: string
    commandCopyRange: string
    commandFillDown: string
    commandFillRight: string
    commandGroupColumns: string
    commandGroupGrouping: string
    commandGroupClipboard: string

    findTitle: string
    findPlaceholder: string
    replacePlaceholder: string
    findCaseSensitive: string
    findWholeCell: string
    findPrevious: string
    findNext: string
    findClose: string
    findReplaceOne: string
    findReplaceAll: string
    commandFind: string

    findCount: (current: number, total: number) => string
    findNoMatch: string

    findNoWritable: (total: number) => string

    findReplaced: (cells: number) => string

    findCountLoaded: (current: number, total: number) => string
    findNoMatchLoaded: string

    findServerReadOnly: string

    viewsLabel: string
    viewsEmpty: string
    viewsPick: string
    viewNamePlaceholder: string
    viewSave: string
    viewUpdate: string
    viewRevert: string
    viewRemove: string
    viewShare: string
    viewShareCopied: string
    viewModified: string
    commandSaveView: string
    viewShareTooLong: (length: number) => string

    formatLabel: string
    formatEmpty: string
    formatAdd: string
    formatClear: string
    formatColumn: string
    formatKind: string
    formatKindColorScale: string
    formatKindDataBar: string
    formatKindDuplicates: string
    formatKindTopN: string
    formatKindExpression: string
    formatTopCount: string
    formatExpressionPlaceholder: string
    formatWholeRow: string
    formatRuleName: (kind: string, column: string) => string
    formatRemoveRule: (rule: string) => string
    formatBadExpression: (message: string) => string

    toolPanelTitle: string
    toolPanelColumns: string
    toolPanelGroup: string
    toolPanelValues: string
    toolPanelSearch: string
    toolPanelShowAll: string
    toolPanelHideAll: string
    toolPanelEmpty: string
    toolPanelMoveUp: (column: string) => string
    toolPanelMoveDown: (column: string) => string
    toolPanelNoAggregation: string
    toolPanelActions: (column: string) => string
    toolPanelCollapse: string
    toolPanelExpand: string

    filterTitle: string
    filterEmpty: string
    filterAddCondition: string
    filterAddGroup: string
    filterRemove: string
    filterJoin: (join: 'and' | 'or') => string
    filterNot: string
    filterBuilderColumn: string
    filterBuilderOperator: string
    filterBuilderValue: string
    filterValueTo: string
    filterTrue: string
    filterFalse: string
    filterOp: (op: string) => string
    filterServerHandled: string

    importTitle: string
    importDropHere: string
    importChooseFile: string
    importPaste: string
    importEmpty: string
    importUnknownFormat: (name: string) => string
    importHeaderRow: string
    importSheet: string
    importColumnFrom: string
    importSkipColumn: string
    importMatchTitle: string
    importReviewTitle: string
    importBack: string
    importNext: string
    importCancel: string
    importAddRows: (count: number) => string
    importAddValid: (count: number) => string
    importIssues: (count: number) => string
    importReady: string
    importNotNumber: (header: string) => string
    importNotDate: (header: string) => string
    importNotBoolean: (header: string) => string
    importInvalid: (header: string) => string
    importDuplicate: (key: string) => string
    importExisting: (key: string) => string
    importServerRefusal: string
    importRowCount: (count: number) => string
    importTooBig: (name: string, megabytes: number) => string
    importMatched: (matched: number, total: number) => string
    importNothingMatched: string
}

/** Any subset; operator maps override one entry at a time. */
export type DataGridLabelsInput = Partial<
    Omit<DataGridLabels, 'textOps' | 'numberOps' | 'dateOps'>
> & {
    textOps?: Partial<Record<TextFilterOp, string>>
    numberOps?: Partial<Record<NumberFilterOp, string>>
    dateOps?: Partial<Record<DateFilterOp, string>>
}

/**
 * One language: what the grid shows and announces, under its tag.
 *
 * A pack says what it has. English answers for the rest, so a pack written
 * against one version of the grid keeps working when the next one names a
 * string it has never heard of: that string arrives in English rather than
 * arriving as a blank or as a build that will not run.
 *
 * The packs shipped here are complete, and `locales.test.ts` is what holds
 * them to it.
 */
export interface DataGridLocalePack {
    /** BCP-47 tag, e.g. `'vi-VN'`. Matched against the page's language. */
    tag: string
    labels: DataGridLabelsInput
    announcer: Partial<DataGridAnnouncerStrings>
}
