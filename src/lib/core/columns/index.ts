/**
 * Everything the column layer offers the rest of the library: the model that
 * holds resolved columns, the sizing maths behind their tracks, header group
 * assembly and the two span resolvers.
 *
 * Names are listed one by one, the way every barrel here is written — a
 * wholesale re-export would publish whatever the next file happens to add.
 * What of this reaches an app is decided one level up, in `core/index.ts`.
 */

export { rowColSpans, type RowSpans } from './col-span.js'
export { ColumnModel } from './column-model.svelte.js'
export {
    columnIndexById,
    columnsById,
    groupContiguousOrder,
    orderLeafDefs
} from './column-order.js'
export {
    buildColumnCssVars,
    columnTrackSize,
    createColumnState,
    pinOffsets,
    prefixSums,
    resolveColumnWidths,
    toStyleString,
    trackWidthEstimates,
    type ColumnStateOverrides,
    type WidthOverrides
} from './column-sizing.js'
export {
    buildGroupPaths,
    buildHeaderLevels,
    flattenColumns,
    groupBoundaries,
    parentGroupIdOf
} from './header-groups.js'
export { opensRowSpanGroup, rowSpansOf, type ColumnRowSpans } from './row-span.js'
