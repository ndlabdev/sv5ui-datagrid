import type { ColumnDef } from './types.js'

export function getCellValue<TRow>(row: TRow, column: ColumnDef<TRow>): unknown {
    if (column.accessor) return column.accessor(row)
    return (row as Record<string, unknown>)[column.id]
}

export function isNullish(value: unknown): value is null | undefined {
    return value === null || value === undefined
}
