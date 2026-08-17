/**
 * Plumbing the components share and nothing else does: the context the grid
 * is passed down through, the theme slots resolved once per grid, portalling,
 * the drag gesture, and the windowing arithmetic the header and body must
 * agree on.
 *
 * Only the two icon exports cross the boundary into the public API, and they
 * do it by being named again in `components/index.ts`.
 */

export { getGridContext, getGridOrNull, setGridContext } from './context.js'
export { fromDateValue, fromTimeValue, toDateValue, toTimeValue } from './editor-values.js'
export { notTabbable } from './focus.js'
export { registerDataGridIcons } from './icons.js'
export { datagridIcons } from './icons.data.js'
export { portal } from './portal.js'
export { beginRowDrag, type RowDragOptions } from './row-drag.js'
export { getGridTheme, setGridTheme, type GridTheme } from './theme.js'
export {
    ariaRowCountOf,
    columnWindowOf,
    pinLeftVar,
    pinRightVar,
    rowIndexOffsetOf,
    windowStartOf,
    type ColumnEntry,
    type ColumnWindow
} from './window.js'
