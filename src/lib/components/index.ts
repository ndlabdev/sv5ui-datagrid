import Body from './grid/GridBody.svelte'
import ColumnChooser from './chrome/GridColumnChooser.svelte'
import ContextMenu from './menus/GridContextMenu.svelte'
import DensityToggle from './chrome/GridDensityToggle.svelte'
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
    ContextMenu,
    FilterChips,
    StatusBar
}

export { getGridContext, setGridContext } from './internal/context.js'
export { datagridVariants } from './datagrid.variants.js'
export type { DataGridSlots, DataGridVariantProps } from './datagrid.variants.js'
export type {
    DataGridProps,
    GridBodyProps,
    DataGridFullWidthContext,
    GridCellEditorProps,
    GridColumnChooserProps,
    GridColumnMenuProps,
    GridContextMenuProps,
    GridDensityToggleProps,
    GridFilterChipsProps,
    GridFilterPanelProps,
    GridHeaderProps,
    GridPaginationProps,
    GridQuickFilterProps,
    GridRootProps,
    GridStatusBarProps,
    GridToolbarProps,
    GridViewportProps
} from './datagrid.types.js'
