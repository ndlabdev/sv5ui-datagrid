import type { RowNode } from '../../core/types/index.js'

export interface ColumnVirtualizationOptions {
    /**
     * Horizontal overscan rendered on each side of the visible columns,
     * in pixels.
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
     * Per-row height in pixels, or `'auto'` to let the row size itself to its
     * content. Either answer switches the virtualizer to the variable-height
     * layout (Fenwick-tree offset cache) instead of the fixed fast path.
     *
     * An `'auto'` row renders at `rowHeight` for one frame, is measured, and
     * keeps its measured height from then on — so scroll offsets settle after
     * the first paint rather than being guessed forever.
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

    /**
     * Enables column virtualization: only columns intersecting the
     * horizontal viewport (plus overscan) are rendered. Column widths are
     * resolved to pixels from the container width.
     */
    columns?: boolean | ColumnVirtualizationOptions
}
