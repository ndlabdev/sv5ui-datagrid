/**
 * The presentation layer's public surface, assembled from the folder barrels
 * below it. Five folders draw the grid — `grid`, `chrome`, `panels`, `menus`,
 * `cells` — and this file names the handful of them an app mounts itself.
 *
 * Only two names leave: `DataGrid`, and `Grid` holding every part. A panel is
 * a part like the toolbar's controls are, so it reaches an app the same way.
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
    GridFilterRowProps,
    GridPaginationProps,
    GridQuickFilterProps,
    GridRootProps
} from './datagrid.types.js'
