import type { ColumnDef, SetFilterValue } from '../types/index.js'

const COMPUTED_KEY = '__dgComputed'

export function withComputed<TRow>(row: TRow, values: Record<string, unknown>): TRow {
    const carried = (row as Record<string, unknown>)[COMPUTED_KEY] as string[] | undefined
    const written = Object.keys(values)
    return {
        ...(row as object),
        ...values,
        [COMPUTED_KEY]: carried ? [...new Set([...carried, ...written])] : written
    } as TRow
}

export function getCellValue<TRow>(row: TRow, column: ColumnDef<TRow>): unknown {
    if (column.accessor) {
        const computed = (row as Record<string, unknown> | null)?.[COMPUTED_KEY] as
            string[] | undefined
        if (computed === undefined || !computed.includes(column.id)) return column.accessor(row)
    }
    return (row as Record<string, unknown>)[column.id]
}

export function sortValueGetter<TRow>(column: ColumnDef<TRow>): (row: TRow) => unknown {
    const { sortField } = column
    if (sortField) return (row) => (row as Record<string, unknown>)[sortField]
    if (column.accessor) return column.accessor
    return (row) => (row as Record<string, unknown>)[column.id]
}

function isNullish(value: unknown): value is null | undefined {
    return value === null || value === undefined
}

export function isBlank(value: unknown): value is null | undefined | '' {
    return isNullish(value) || value === ''
}

const TRUE_WORDS = new Set(['true', 'yes', 'y', '1', 'x', 'có', 'co', 'đúng', 'dung'])
const FALSE_WORDS = new Set(['false', 'no', 'n', '0', '', 'không', 'khong', 'sai'])

export function toBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') return value
    if (typeof value === 'number') return Number.isFinite(value) ? value !== 0 : null
    if (typeof value !== 'string') return null

    const word = value.trim().toLowerCase()
    if (TRUE_WORDS.has(word)) return true
    return FALSE_WORDS.has(word) ? false : null
}

export function setKeyOf(value: unknown): SetFilterValue {
    if (isBlank(value)) return null
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (value instanceof Date) return value.toISOString()
    return String(value)
}
