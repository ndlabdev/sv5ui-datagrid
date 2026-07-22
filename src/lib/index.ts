/**
 * The public API. Everything exported here is covered by semver from 1.0 on,
 * so it stays deliberately small: what an app needs to render a grid, what a
 * feature module needs to plug into one, and nothing else. Internal helpers
 * live in their own modules and are free to change.
 */

// Components and theming
export * from './components/index.js'

// Grid instance
export { createDataGrid, GridState } from './core/grid/grid.svelte.js'
export { buildRowNodes } from './core/grid/row-node.js'
export { getCellValue, isNullish } from './core/utils/value.js'
export { SELECTION_COLUMN_ID, SNAPSHOT_VERSION } from './core/types/index.js'
export type * from './core/types/index.js'

// Models reachable from a grid instance
export { Announcer, defaultLocale } from './core/interaction/announcer.svelte.js'
export { ColumnModel } from './core/columns/column-model.svelte.js'
export { EventBus, type EventHandler } from './core/grid/events.js'
export { ExpansionModel } from './core/interaction/expansion.svelte.js'
export {
    FocusModel,
    HEADER_ROW,
    type CellPosition,
    type GridSection
} from './core/interaction/focus-model.svelte.js'

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

// Row measurement, for variable row heights
export { fixedRowLayout, variableRowLayout, type RowLayout } from './core/virtual/row-layout.js'
export {
    ColumnVirtualizer,
    type ColumnVirtualizerOptions
} from './core/virtual/column-virtualizer.svelte.js'
export {
    Virtualizer,
    type VirtualizerOptions,
    type VirtualRange
} from './core/virtual/virtualizer.svelte.js'

// Feature modules
export {
    COLUMN_OPS,
    ColumnOps,
    columnOps,
    getColumnOps,
    type ColumnOpsOptions
} from './features/column-ops/index.js'
export {
    EDITING,
    Editing,
    editing,
    getEditing,
    type EditingOptions,
    type EditMode
} from './features/editing/index.js'
export {
    FILTERING,
    Filtering,
    filtering,
    getFiltering,
    type FilteringOptions
} from './features/filtering/index.js'
export {
    PAGINATION,
    Pagination,
    getPagination,
    pagination,
    type PaginationOptions
} from './features/pagination/index.js'
export {
    getRowPinning,
    ROW_PINNING,
    RowPinning,
    rowPinning,
    type RowPinningOptions
} from './features/row-pinning/index.js'
export {
    getSelection,
    SELECTION,
    Selection,
    selection,
    toCsv,
    toTsv,
    type CopyOptions,
    type ExportCsvOptions,
    type SelectAllState,
    type SelectionOptions
} from './features/selection/index.js'
export {
    getSorting,
    SORTING,
    Sorting,
    sorting,
    type SortingOptions,
    type SortNulls,
    type ToggleSortOptions
} from './features/sorting/index.js'
export {
    getVirtualization,
    VIRTUALIZATION,
    Virtualization,
    virtualization,
    type ColumnVirtualizationOptions,
    type VirtualizationOptions
} from './features/virtualization/index.js'
