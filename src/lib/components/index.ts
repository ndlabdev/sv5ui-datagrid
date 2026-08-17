/**
 * The presentation layer's public surface, assembled from the folder barrels
 * below it. Four folders draw the grid — `grid`, `chrome`, `menus`, `cells` —
 * and this file names the handful of them an app mounts itself.
 *
 * `cells` never appears: a cell is drawn by the grid or by the app's own
 * snippet. Nor does most of `internal`, beyond the two icon exports that an
 * app behind a dynamic import genuinely needs.
 */

export { DataGrid } from './grid/index.js'
export { Grid, type GridParts } from './parts.js'
export { datagridIcons, registerDataGridIcons } from './internal/index.js'

export type { DataGridSlots, DataGridUi } from './datagrid.variants.js'
export {
    defineDataGridConfig,
    resetDataGridConfig,
    type DataGridConfig
} from './datagrid.config.js'

/** Only the props carrying real configuration; the rest use `ComponentProps`. */
export type {
    DataGridFullWidthContext,
    DataGridProps,
    GridBodyProps,
    GridContextMenuProps,
    GridExportMenuProps,
    GridPaginationProps,
    GridQuickFilterProps,
    GridRootProps
} from './datagrid.types.js'
