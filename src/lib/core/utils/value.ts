import type { ColumnDef } from '../types/index.js'

export function getCellValue<TRow>(row: TRow, column: ColumnDef<TRow>): unknown {
    if (column.accessor) return column.accessor(row)
    return (row as Record<string, unknown>)[column.id]
}

export function sortValueGetter<TRow>(column: ColumnDef<TRow>): (row: TRow) => unknown {
    const { sortField } = column
    if (sortField) return (row) => (row as Record<string, unknown>)[sortField]
    if (column.accessor) return column.accessor
    return (row) => (row as Record<string, unknown>)[column.id]
}

export function isNullish(value: unknown): value is null | undefined {
    return value === null || value === undefined
}

export function isBlank(value: unknown): value is null | undefined | '' {
    return isNullish(value) || value === ''
}
