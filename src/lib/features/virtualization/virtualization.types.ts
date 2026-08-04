import type { RowNode } from '../../core/types/index.js'

export interface ColumnVirtualizationOptions {
    /**
     * Horizontal overscan each side of the visible columns, in pixels.
     * @default 200
     */
    overscanPx?: number
}

export interface VirtualizationOptions<TRow = unknown> {
    /**
     * Fixed row height in pixels. Ignored when `getRowHeight` is set.
     * @default 40
     */
    rowHeight?: number

    /**
     * Per-row height, or `'auto'` to size to content. Either switches the
     * virtualizer to its variable-height layout. An `'auto'` row renders at
     * `rowHeight` for one frame, is measured, and keeps that height.
     */
    getRowHeight?: (node: RowNode<TRow>) => number | 'auto'

    /**
     * Extra rows rendered above and below the visible window.
     * @default 5
     */
    overscan?: number

    /**
     * Rows rendered before the viewport is measured (SSR and first paint).
     * @default 20
     */
    initialRows?: number

    /** Renders only the columns intersecting the viewport, plus overscan. */
    columns?: boolean | ColumnVirtualizationOptions
}
