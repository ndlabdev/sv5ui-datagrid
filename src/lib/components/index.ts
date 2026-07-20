import Body from './GridBody.svelte'
import ColumnChooser from './GridColumnChooser.svelte'
import ContextMenu from './GridContextMenu.svelte'
import DensityToggle from './GridDensityToggle.svelte'
import FilterChips from './GridFilterChips.svelte'
import Header from './GridHeader.svelte'
import Pagination from './GridPagination.svelte'
import QuickFilter from './GridQuickFilter.svelte'
import Root from './GridRoot.svelte'
import StatusBar from './GridStatusBar.svelte'
import Toolbar from './GridToolbar.svelte'
import Viewport from './GridViewport.svelte'

export { default as DataGrid } from './DataGrid.svelte'

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

export { getGridContext, setGridContext } from './context.js'
export { datagridVariants } from './datagrid.variants.js'
export type { DataGridSlots, DataGridVariantProps } from './datagrid.variants.js'
export type {
    DataGridProps,
    GridBodyProps,
    DataGridFullWidthContext,
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
export { columnWindowOf, windowStartOf, type ColumnEntry, type ColumnWindow } from './window.js'
