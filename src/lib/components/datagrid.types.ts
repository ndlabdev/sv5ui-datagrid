import type { Snippet } from 'svelte'
import type { ClassNameValue } from 'tailwind-merge'
import type { GridState } from '../core/grid.svelte.js'
import type { ColumnDef } from '../core/types.js'
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

export interface GridBodyProps {
    /**
     * Text shown when there are no rows to display.
     * @default 'No data'
     */
    emptyText?: string

    /** Additional classes applied to the body row group. */
    class?: ClassNameValue
}

export interface GridPaginationProps {
    /** Additional classes applied to the footer element. */
    class?: ClassNameValue
}

export type DataGridProps<TRow> = {
    /**
     * Text shown when there are no rows to display.
     * @default 'No data'
     */
    emptyText?: string

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
          virtual?: never
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
           * Enables row virtualization instead of pagination.
           * Set a fixed viewport height via `class` (e.g. `h-[640px]`).
           */
          virtual?: VirtualizationOptions | true
      }
)
