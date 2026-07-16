export interface VirtualizationOptions {
    /**
     * Fixed row height in pixels.
     * @default 40
     */
    rowHeight?: number

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
}
