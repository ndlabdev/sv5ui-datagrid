export interface TreeOptions<TRow> {
    /**
     * Nested shape: the children held on a row. Use this or `getParentId`,
     * not both.
     */
    getChildren?: (row: TRow) => TRow[] | undefined

    /**
     * Flat shape: the id of a row's parent, or null for a root. Rows whose
     * parent is not in the current set are promoted to roots, so a filter that
     * removes a parent still leaves matching descendants reachable.
     */
    getParentId?: (row: TRow) => string | null | undefined

    /**
     * Levels open before the user touches anything. 0 shows roots only.
     * @default 0
     */
    defaultExpandedDepth?: number
}
