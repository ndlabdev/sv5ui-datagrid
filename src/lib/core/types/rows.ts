/** Rows as the pipeline sees them: identity, position and structure. */

/**
 * The unit of the row pipeline after node building.
 * Wraps a raw row with identity and position; grouping and tree phases
 * extend this with depth, group info and expansion state.
 */
/**
 * Structural metadata attached to a pipeline node by row-structure
 * features (grouping, tree data, master/detail, expandable rows).
 * Drives treegrid ARIA, first-column indent, the expand toggle and
 * full-width rendering. Absent on plain flat rows.
 */
export interface RowMeta {
    /** Treegrid depth, 0-based. Drives `aria-level` and indent. */
    level?: number
    /** Renders the expand/collapse toggle and `aria-expanded`. */
    expandable?: boolean
    /**
     * Full-width row: a single cell spanning every column, rendered
     * through the `fullWidthRow` snippet instead of column cells.
     */
    fullWidth?: boolean
    /** `aria-setsize` — number of siblings at this level. */
    setSize?: number
    /** `aria-posinset` — 1-based position among siblings. */
    posInSet?: number
}

export interface RowNode<TRow> {
    /** Stable id from `getRowId`. Render key and selection/edit identity. */
    id: string
    /** The raw row object. */
    row: TRow
    /** Index of the row in the original data array. */
    index: number
    /** Structural metadata set by row-structure pipeline stages. */
    meta?: RowMeta
}

export type RowPinSide = 'top' | 'bottom'

export type RowModel = 'client' | 'server'
