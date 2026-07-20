import type { Snippet } from 'svelte'
import type { ClassNameValue } from 'tailwind-merge'
import type { GridState } from '../core/grid.svelte.js'
import type { ColumnDef, ColumnState, Density, RowNode } from '../core/types.js'
import type { SelectionOptions } from '../features/selection/index.js'
import type { VirtualizationOptions } from '../features/virtualization/index.js'

export interface GridRootProps<TRow> {
    /** The grid instance created with `createDataGrid`. */
    grid: GridState<TRow>

    /** Additional classes applied to the root element. */
    class?: ClassNameValue

    children?: Snippet
}

export interface GridViewportProps {
    /** Additional classes applied to the `role="grid"` element. */
    class?: ClassNameValue

    children?: Snippet
}

export interface GridHeaderProps {
    /** Additional classes applied to the header row group. */
    class?: ClassNameValue
}

/**
 * Context passed to the `fullWidthRow` snippet for rows flagged with
 * `meta.fullWidth` (detail panels, group rows).
 */
export interface DataGridFullWidthContext<TRow> {
    /** The pipeline node being rendered. */
    node: RowNode<TRow>
    /** The raw row object the node points at. */
    row: TRow
    /** Absolute row index within the filtered/sorted set. */
    rowIndex: number
}

export interface GridBodyProps {
    /** Renders rows flagged `meta.fullWidth` across every column. */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fullWidthRow?: Snippet<[DataGridFullWidthContext<any>]>

    /**
     * Text shown when there are no rows to display.
     * @default 'No data'
     */
    emptyText?: string

    /** Renders skeleton rows instead of data rows. */
    loading?: boolean

    /**
     * Number of skeleton rows rendered while loading.
     * @default 5
     */
    loadingRows?: number

    /** Error message. Takes precedence over `loading` and rows. */
    error?: string | null

    /** Renders a Retry action in the error state. */
    onRetry?: () => void

    /** Additional classes applied to the body row group. */
    class?: ClassNameValue
}

export interface GridPaginationProps {
    /**
     * Page-size choices shown in the footer select.
     * @default [10, 25, 50, 100]
     */
    pageSizes?: number[]

    /** Additional classes applied to the footer element. */
    class?: ClassNameValue
}

export interface GridFilterPanelProps<TRow> {
    /** The column the filter editor operates on. */
    column: ColumnState<TRow>
}

export interface GridFilterChipsProps {
    /** Additional classes applied to the chips container. */
    class?: ClassNameValue
}

export interface GridStatusBarProps {
    /** Additional classes applied to the status bar. */
    class?: ClassNameValue
}

export interface GridToolbarProps {
    /** Additional classes applied to the toolbar container. */
    class?: ClassNameValue

    children?: Snippet
}

export interface GridQuickFilterProps {
    /**
     * Input placeholder text.
     * @default 'Search...'
     */
    placeholder?: string

    /**
     * Debounce delay in milliseconds before the filter is applied.
     * @default 200
     */
    debounce?: number

    /** Additional classes applied to the input. */
    class?: ClassNameValue
}

export interface GridDensityToggleProps {
    /** Additional classes applied to the button group. */
    class?: ClassNameValue
}

export interface GridColumnChooserProps {
    /** Additional classes applied to the trigger button. */
    class?: ClassNameValue
}

export interface GridColumnMenuProps<TRow> {
    /** The column the menu operates on. */
    column: ColumnState<TRow>
}

export interface GridContextMenuProps {
    /**
     * File name used by the Export CSV item.
     * @default 'export.csv'
     */
    exportFilename?: string

    /** The right-click target, typically `Grid.Viewport`. */
    children?: Snippet
}

export type DataGridProps<TRow> = {
    /**
     * Text shown when there are no rows to display.
     * @default 'No data'
     */
    emptyText?: string

    /** Renders the default toolbar (quick filter + density toggle). */
    toolbar?: boolean

    /** Renders skeleton rows instead of data rows. */
    loading?: boolean

    /** Error message shown instead of rows. */
    error?: string | null

    /** Renders a Retry action in the error state. */
    onRetry?: () => void

    /** Renders rows flagged `meta.fullWidth` across every column. */
    fullWidthRow?: GridBodyProps['fullWidthRow']

    /** Additional classes applied to the root element. */
    class?: ClassNameValue
} & (
    | {
          /**
           * External grid instance created with `createDataGrid`.
           * Owns data, columns and features.
           */
          grid: GridState<TRow>
          data?: never
          columns?: never
          getRowId?: never
          pageSize?: never
          selection?: never
          virtual?: never
          density?: never
      }
    | {
          grid?: never

          /** Rows to display. */
          data: TRow[]

          /** Column definitions. */
          columns: ColumnDef<TRow>[]

          /** Returns a stable unique id for a row. */
          getRowId: (row: TRow) => string

          /** Rows per page. Omit to disable pagination. Ignored when `virtual` is set. */
          pageSize?: number

          /**
           * Enables row selection with the checkbox column, clipboard
           * copy and CSV export.
           */
          selection?: SelectionOptions<TRow> | true

          /**
           * Enables row virtualization instead of pagination.
           * Set a fixed viewport height via `class` (e.g. `h-[640px]`).
           */
          virtual?: VirtualizationOptions | true

          /**
           * Initial row density.
           * @default 'standard'
           */
          density?: Density
      }
)
