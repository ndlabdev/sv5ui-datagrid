/**
 * The kernel's public surface, assembled from the folder barrels below it.
 *
 * Each folder decides what it offers the library; this file decides the far
 * smaller set an app is allowed to reach, which is why every name is spelled
 * out again here rather than starred through. Adding to the public API is
 * therefore a deliberate edit at the folder and at the boundary both.
 *
 * Classes leave as types. An app receives instances through the grid or a
 * `getX(grid)` accessor and never constructs one.
 */

export { createDataGrid, PIPELINE_ORDER } from './grid/index.js'
export { getCellValue } from './utils/index.js'
export { SELECTION_COLUMN_ID, SNAPSHOT_VERSION } from './types/index.js'
export { defaultLabels, mergeLabels } from './interaction/index.js'

// Models an app reaches through the grid instance, never constructs itself.
export type { GridState } from './grid/index.js'
export type { EventBus, EventHandler } from './grid/index.js'
export type { ColumnModel } from './columns/index.js'
export type { Announcer, ExpansionModel } from './interaction/index.js'
export type { CellPosition, FocusModel, GridSection } from './interaction/index.js'
export type { ColumnVirtualizer, Virtualizer, VirtualRange } from './virtual/index.js'

export type * from './types/index.js'
