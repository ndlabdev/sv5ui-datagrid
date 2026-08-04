import type { ColumnDef } from '../types/index.js'

export function getCellValue<TRow>(row: TRow, column: ColumnDef<TRow>): unknown {
    if (column.accessor) return column.accessor(row)
    return (row as Record<string, unknown>)[column.id]
}

/**
 * How a sort reads its value. A getter rather than a per-call branch: a sort
 * asks n log n times and which branch applies is fixed for the column.
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
