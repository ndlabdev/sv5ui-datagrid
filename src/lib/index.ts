/**
 * The public API, covered by semver and kept deliberately small. A symbol
 * earns a place here by being something an app does with the grid — nothing
 * is exported because it happens to exist. Classes the grid constructs are
 * types only: you reach instances through the grid or a `getX(grid)` accessor.
 *
 * `src/tests/public-api.test.ts` pins this list, so adding to it is a decision
 * rather than an accident.
 */

// Components and theming
export * from './components/index.js'

// Grid instance
export { createDataGrid } from './core/grid/grid.svelte.js'
export type { GridState } from './core/grid/grid.svelte.js'
export { getCellValue } from './core/utils/value.js'
export { SELECTION_COLUMN_ID, SNAPSHOT_VERSION } from './core/types/index.js'
export type * from './core/types/index.js'

// Models reachable from a grid instance
export { registerDataGridIcons } from './components/internal/icons.js'
export { datagridIcons } from './components/internal/icons.data.js'
export { defaultLabels, mergeLabels } from './core/interaction/labels.js'
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

// Feature modules
export { columnOps, type ColumnOpsOptions } from './features/column-ops/index.js'
export { editing, type EditingOptions, type EditMode } from './features/editing/index.js'
export { filtering, toFilterRequest, type FilteringOptions } from './features/filtering/index.js'
export { pagination, type PaginationOptions } from './features/pagination/index.js'
export { rowPinning, type RowPinningOptions } from './features/row-pinning/index.js'
export {
    rowReorder,
    type RowDragState,
    type RowReorderOptions
} from './features/row-reorder/index.js'
export {
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
