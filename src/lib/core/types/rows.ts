/** Rows as the pipeline sees them: identity, position and structure. */

/** The unit of the row pipeline: a raw row with identity and position. */
/**
 * Attached by row-structure features. Drives treegrid ARIA, indent, the
 * expand toggle and full-width rendering; absent on plain rows.
 */
export interface RowMeta {
    /** Treegrid depth, 0-based. Drives `aria-level` and indent. */
    level?: number
    /** Renders the expand/collapse toggle and `aria-expanded`. */
    expandable?: boolean
    /** One cell across every column, rendered through `fullWidthRow`. */
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
