import type { ColumnDef } from '../types/index.js'

export function getCellValue<TRow>(row: TRow, column: ColumnDef<TRow>): unknown {
    if (column.accessor) return column.accessor(row)
    return (row as Record<string, unknown>)[column.id]
}

/**
 * How a sort reads its value from a row. `sortField` names a different property
 * from the one on screen — a column rendering a full name can still order by
 * surname — and without one the sort compares what the cell shows.
 *
 * Returned as a getter rather than resolved per call: a sort asks for it on the
 * order of n log n times, and which branch applies is fixed for the column.
 */
export function sortValueGetter<TRow>(column: ColumnDef<TRow>): (row: TRow) => unknown {
    const { sortField } = column
    if (sortField) return (row) => (row as Record<string, unknown>)[sortField]
    if (column.accessor) return column.accessor
    return (row) => (row as Record<string, unknown>)[column.id]
}

export function isNullish(value: unknown): value is null | undefined {
    return value === null || value === undefined
}
