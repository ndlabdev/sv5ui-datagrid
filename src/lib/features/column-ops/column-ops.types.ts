export interface ColumnOpsOptions {
    /**
     * Enables drag / keyboard / double-click resize.
     * @default true
     */
    resize?: boolean

    /**
     * Enables drag / keyboard reorder.
     * @default true
     */
    reorder?: boolean

    /**
     * Enables pinning via the column menu and API.
     * @default true
     */
    pin?: boolean

    /**
     * Enables hiding via the column menu, chooser and API.
     * @default true
     */
    hide?: boolean

    /**
     * Pixel step for keyboard resize (Shift+Arrow).
     * @default 16
     */
    resizeStep?: number
}

export interface ColumnDragState {
    /** Id of the column being dragged. */
    sourceId: string
    /** Prospective drop index within the visible columns. */
    targetIndex: number
    /** X offset of the drop indicator within the scroll content. */
    indicatorX: number
}
