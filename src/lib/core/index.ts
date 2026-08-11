/**
 * The kernel's public surface. Names are listed one by one on purpose: a
 * barrel that re-exported a module wholesale would publish whatever anyone
 * adds to it next, which is how an API grows without a decision behind it.
 */

export { createDataGrid } from './grid/grid.svelte.js'
export type { GridState } from './grid/grid.svelte.js'
export { getCellValue } from './utils/value.js'
export { PIPELINE_ORDER } from './grid/pipeline.svelte.js'
export { SELECTION_COLUMN_ID, SNAPSHOT_VERSION } from './types/index.js'
export { defaultLabels, mergeLabels } from './interaction/labels.js'

// Models an app reaches through the grid instance, never constructs itself.
export type { Announcer } from './interaction/announcer.svelte.js'
export type { ColumnModel } from './columns/column-model.svelte.js'
export type { EventBus, EventHandler } from './grid/events.js'
export type { ExpansionModel } from './interaction/expansion.svelte.js'
export type { CellPosition, FocusModel, GridSection } from './interaction/focus-model.svelte.js'
export type { ColumnVirtualizer } from './virtual/column-virtualizer.svelte.js'
export type { Virtualizer, VirtualRange } from './virtual/virtualizer.svelte.js'

export type * from './types/index.js'
