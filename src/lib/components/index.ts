import Body from './grid/GridBody.svelte'
import ColumnChooser from './chrome/GridColumnChooser.svelte'
import ContextMenu from './menus/GridContextMenu.svelte'
import DensityToggle from './chrome/GridDensityToggle.svelte'
import ExportMenu from './chrome/GridExportMenu.svelte'
import FilterChips from './chrome/GridFilterChips.svelte'
import Header from './grid/GridHeader.svelte'
import Pagination from './chrome/GridPagination.svelte'
import QuickFilter from './chrome/GridQuickFilter.svelte'
import Root from './grid/GridRoot.svelte'
import StatusBar from './chrome/GridStatusBar.svelte'
import Toolbar from './chrome/GridToolbar.svelte'
import Viewport from './grid/GridViewport.svelte'

export { default as DataGrid } from './grid/DataGrid.svelte'
export { default as GridCellValue } from './cells/GridCellValue.svelte'

export interface GridParts {
    Root: typeof Root
    Viewport: typeof Viewport
    Header: typeof Header
    Body: typeof Body
    Pagination: typeof Pagination
    Toolbar: typeof Toolbar
    QuickFilter: typeof QuickFilter
    DensityToggle: typeof DensityToggle
    ColumnChooser: typeof ColumnChooser
    ExportMenu: typeof ExportMenu
    ContextMenu: typeof ContextMenu
    FilterChips: typeof FilterChips
    StatusBar: typeof StatusBar
}

export const Grid: GridParts = {
    Root,
    Viewport,
    Header,
    Body,
    Pagination,
    Toolbar,
    QuickFilter,
    DensityToggle,
    ColumnChooser,
    ExportMenu,
    ContextMenu,
    FilterChips,
    StatusBar
}

export { getGridContext, setGridContext } from './internal/context.js'
export { datagridVariants } from './datagrid.variants.js'
export type { DataGridSlots, DataGridUi, DataGridVariantProps } from './datagrid.variants.js'
export {
    defineDataGridConfig,
    resetDataGridConfig,
    type DataGridConfig
} from './datagrid.config.js'
/**
 * Only the props that carry real configuration. A part whose props are just
 * `class` and `children` is typed from the component itself with Svelte's
 * `ComponentProps`, so there is nothing here worth naming.
 */
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
