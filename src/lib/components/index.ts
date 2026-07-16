import Body from './GridBody.svelte'
import DensityToggle from './GridDensityToggle.svelte'
import Header from './GridHeader.svelte'
import Pagination from './GridPagination.svelte'
import QuickFilter from './GridQuickFilter.svelte'
import Root from './GridRoot.svelte'
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
}

export const Grid: GridParts = {
    Root,
    Viewport,
    Header,
    Body,
    Pagination,
    Toolbar,
    QuickFilter,
    DensityToggle
}

export { getGridContext, setGridContext } from './context.js'
export { datagridVariants } from './datagrid.variants.js'
export type { DataGridSlots, DataGridVariantProps } from './datagrid.variants.js'
export type {
    DataGridProps,
    GridBodyProps,
    GridDensityToggleProps,
    GridHeaderProps,
    GridPaginationProps,
    GridQuickFilterProps,
    GridRootProps,
    GridToolbarProps,
    GridViewportProps
} from './datagrid.types.js'
export { windowStartOf } from './window.js'
