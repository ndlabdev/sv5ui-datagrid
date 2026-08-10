/**
 * The public API, covered by semver from 1.0 on and kept deliberately small.
 * Classes the grid constructs are exported as types only: you reach instances
 * through the grid or a `getX(grid)` accessor.
 */

// Components and theming
export * from './components/index.js'

// Grid instance
export { createDataGrid } from './core/grid/grid.svelte.js'
export type { GridState } from './core/grid/grid.svelte.js'
export { getCellValue } from './core/utils/value.js'
export {
    isSyntheticColumn,
    ROW_HANDLE_COLUMN_ID,
    SELECTION_COLUMN_ID,
    SNAPSHOT_VERSION
} from './core/types/index.js'
export type * from './core/types/index.js'

// Models reachable from a grid instance
export { defaultAnnouncerStrings } from './core/interaction/announcer.svelte.js'
export { registerDataGridIcons } from './components/internal/icons.js'
export { datagridIcons } from './components/internal/icons.data.js'
export { documentLocale, resolveLocale } from './core/interaction/locale.js'
export {
    DATE_OPS,
    defaultLabels,
    mergeLabels,
    NUMBER_OPS,
    TEXT_OPS
} from './core/interaction/labels.js'
export { HEADER_ROW } from './core/interaction/focus-model.svelte.js'
export type { Announcer } from './core/interaction/announcer.svelte.js'
export type { ColumnModel } from './core/columns/column-model.svelte.js'
export type { EventBus, EventHandler } from './core/grid/events.js'
export type { ExpansionModel } from './core/interaction/expansion.svelte.js'
export type {
    CellPosition,
    FocusModel,
    GridSection
} from './core/interaction/focus-model.svelte.js'
export type { ColumnVirtualizer } from './core/virtual/column-virtualizer.svelte.js'
export type { Virtualizer, VirtualRange } from './core/virtual/virtualizer.svelte.js'

// Writing a feature module
export { PIPELINE_ORDER } from './core/grid/pipeline.svelte.js'

// Cell formatting, for custom renderers
export {
    DEFAULT_EMPTY_TEXT,
    formatCurrency,
    formatDate,
    formatNumber,
    formatPercent,
    isBlank,
    toDate,
    toNumber,
    type FormatOptions
} from './core/utils/format.js'

// Feature modules
export { columnOps, type ColumnOpsOptions } from './features/column-ops/index.js'
export { editing, type EditingOptions, type EditMode } from './features/editing/index.js'
export {
    filterConditions,
    filtering,
    isFilterGroup,
    normalizeFilterEntry,
    toFilterRequest,
    type FilteringOptions
} from './features/filtering/index.js'
export { pagination, type PaginationOptions } from './features/pagination/index.js'
export { rowPinning, type RowPinningOptions } from './features/row-pinning/index.js'
export {
    rowReorder,
    type RowDragState,
    type RowReorderOptions
} from './features/row-reorder/index.js'
export {
    dataColumns,
    DEFAULT_CSV_DELIMITER,
    downloadCsv,
    neutralizeFormula,
    pickColumns,
    rowsToMatrix,
    selection,
    toCsv,
    toTsv,
    withHeaderRow,
    type CellMatrix,
    type ExportFormatter,
    type CopyOptions,
    type ExportCsvOptions,
    type SelectAllState,
    type SelectionOptions
} from './features/selection/index.js'
export {
    sorting,
    toSortRequest,
    type SortCycle,
    type SortingOptions,
    type SortNulls,
    type ToggleSortOptions
} from './features/sorting/index.js'
export {
    virtualization,
    type ColumnVirtualizationOptions,
    type VirtualizationOptions
} from './features/virtualization/index.js'

// Reaching a feature's state from a grid instance
export { getColumnOps } from './features/column-ops/index.js'
export { getEditing } from './features/editing/index.js'
export { getFiltering } from './features/filtering/index.js'
export { getPagination } from './features/pagination/index.js'
export { getRowPinning } from './features/row-pinning/index.js'
export { getRowReorder } from './features/row-reorder/index.js'
export { getSelection } from './features/selection/index.js'
export { getSorting } from './features/sorting/index.js'
export { getVirtualization } from './features/virtualization/index.js'

export type { ColumnOps } from './features/column-ops/index.js'
export type { Editing } from './features/editing/index.js'
export type { Filtering } from './features/filtering/index.js'
export type { Pagination } from './features/pagination/index.js'
export type { RowPinning } from './features/row-pinning/index.js'
export type { RowReorder } from './features/row-reorder/index.js'
export type { Selection } from './features/selection/index.js'
export type { Sorting } from './features/sorting/index.js'
export type { Virtualization } from './features/virtualization/index.js'
