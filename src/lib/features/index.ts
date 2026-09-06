/**
 * Every feature module, its options, its state accessor and the type of the
 * state it hands back. Listed one by one for the reason `core/index.ts` gives.
 */

export { columnOps, getColumnOps } from './column-ops/index.js'
export type { ColumnOps, ColumnOpsOptions } from './column-ops/index.js'

export { editing, getEditing } from './editing/index.js'
export type { Editing, EditingOptions, EditMode } from './editing/index.js'

export { filtering, getFiltering, toFilterRequest } from './filtering/index.js'
export type { Filtering, FilteringOptions } from './filtering/index.js'

export { getPagination, pagination } from './pagination/index.js'
export type { Pagination, PaginationOptions } from './pagination/index.js'

export { getRowPinning, rowPinning } from './row-pinning/index.js'
export type { RowPinning, RowPinningOptions } from './row-pinning/index.js'

export { getRowReorder, rowReorder } from './row-reorder/index.js'
export type { RowDragState, RowReorder, RowReorderOptions } from './row-reorder/index.js'

export {
    getSelection,
    pickColumns,
    rowsToMatrix,
    selection,
    toCsv,
    toTsv,
    withHeaderRow
} from './selection/index.js'
export type {
    CellMatrix,
    CopyOptions,
    ExportCsvOptions,
    ExportFormatter,
    SelectAllState,
    Selection,
    SelectionOptions
} from './selection/index.js'

export { getSorting, sorting, toSortRequest } from './sorting/index.js'
export type {
    Sorting,
    SortingOptions,
    SortCycle,
    SortNulls,
    ToggleSortOptions
} from './sorting/index.js'

export { getVirtualization, virtualization } from './virtualization/index.js'
export type {
    ColumnVirtualizationOptions,
    Virtualization,
    VirtualizationOptions
} from './virtualization/index.js'

/**
 * The sixteen modules that used to be a second package. Same rule as above:
 * the factory, the accessor, the state it hands back and the options it takes.
 *
 * Five states are spelled `...State` because a component of the same name
 * draws them, and one name cannot mean both.
 */

export {
    advancedFilter,
    getAdvancedFilter,
    type AdvancedFilter as AdvancedFilterState,
    type AdvancedFilterOp,
    type AdvancedFilterOptions,
    type FilterCondition,
    type FilterGroup,
    type FilterNode
} from './advanced-filter/index.js'

export {
    commandPalette,
    getCommandPalette,
    type CommandPalette as CommandPaletteState,
    type CommandPaletteOptions,
    type GridCommand
} from './command-palette/index.js'

export {
    conditionalFormatting,
    getConditionalFormatting,
    type ColorScaleRule,
    type ConditionalFormatting as ConditionalFormattingState,
    type ConditionalFormattingOptions,
    type DataBarRule,
    type DuplicatesRule,
    type ExpressionRule,
    type FormatPaint,
    type FormatRule,
    type TopNRule
} from './conditional-formatting/index.js'

export {
    findReplace,
    getFindReplace,
    type FindReplace as FindReplaceState,
    type FindReplaceOptions,
    type Match
} from './find-replace/index.js'

export {
    formula,
    FormulaError,
    FUNCTION_NAMES,
    getFormula,
    isFormulaError,
    type Formula,
    type FormulaColumn,
    type FormulaErrorCode,
    type FormulaOptions,
    type FormulaValue
} from './formula/index.js'

export {
    aggregate,
    getGrouping,
    grouping,
    totalsKindOf,
    type Aggregation,
    type Grouping,
    type GroupingOptions,
    type GroupRowValues
} from './grouping/index.js'

export {
    getMasterDetail,
    isDetailNode,
    masterDetail,
    type MasterDetail,
    type MasterDetailOptions
} from './master-detail/index.js'

export {
    getRangeSelection,
    rangeSelection,
    type CellRange,
    type CopyRangeOptions,
    type RangeSelection,
    type RangeSelectionOptions
} from './range-selection/index.js'

export {
    getSavedViews,
    localStorageViews,
    savedViews,
    type SavedView,
    type SavedViews as SavedViewsState,
    type SavedViewsOptions,
    type SavedViewStorage
} from './saved-views/index.js'

export {
    getShowValuesAs,
    showValuesAs,
    type ShowAs,
    type ShowValuesAs,
    type ShowValuesAsOptions
} from './show-values-as/index.js'

export {
    dataImport,
    getDataImport,
    type DataImport,
    type DataImportOptions,
    type DuplicateScope,
    type ImportDedupe,
    type ImportFormat,
    type ImportIssue,
    type ImportStep
} from './data-import/index.js'

export {
    getPolicy,
    policy,
    type MaskKind,
    type Policy,
    type PolicyContext,
    type PolicyOptions,
    type PolicyRule
} from './policy/index.js'

export {
    getServerRowModel,
    isLoadingRow,
    serverRowModel,
    type DataSource,
    type GetRowsRequest,
    type GetRowsResult,
    type ServerMode,
    type ServerRowModel,
    type ServerRowModelOptions
} from './server-row-model/index.js'

export { getTree, tree, type Tree, type TreeOptions } from './tree/index.js'

export {
    workerDataSource,
    type WorkerDataSource,
    type WorkerDataSourceOptions
} from './worker-row-model/index.js'
