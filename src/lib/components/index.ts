import Body from './GridBody.svelte'
import Header from './GridHeader.svelte'
import Pagination from './GridPagination.svelte'
import Root from './GridRoot.svelte'
import Viewport from './GridViewport.svelte'

export { default as DataGrid } from './DataGrid.svelte'

export interface GridParts {
    Root: typeof Root
    Viewport: typeof Viewport
    Header: typeof Header
    Body: typeof Body
    Pagination: typeof Pagination
}

export const Grid: GridParts = {
    Root,
    Viewport,
    Header,
    Body,
    Pagination
}

export { getGridContext, setGridContext } from './context.js'
export { datagridVariants } from './datagrid.variants.js'
export type { DataGridSlots, DataGridVariantProps } from './datagrid.variants.js'
export type {
    DataGridProps,
    GridBodyProps,
    GridHeaderProps,
    GridPaginationProps,
    GridRootProps,
    GridViewportProps
} from './datagrid.types.js'
