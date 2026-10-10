import { isBlank } from '../../core/utils/index.js'
import type { CellRead } from '../../core/grid/index.js'
import type { ColumnDef, RowNode } from '../../core/types/index.js'

export const PIVOT_PREFIX = '__pv'
export const CROSSING = `${PIVOT_PREFIX}:c:`
export const TOTAL = `${PIVOT_PREFIX}:t:`

export const isPivotColumn = (columnId: string): boolean => columnId.startsWith(`${PIVOT_PREFIX}:`)

export const MEASURE_COLUMN = `${PIVOT_PREFIX}:m`

export const MEASURE_ROW = /^m(\d+):/

export const measureRowId = (groupId: string, at: number): string => `m${at}:${groupId}`

export const measureRowBase = (rowId: string): string => rowId.replace(MEASURE_ROW, '')

export function agreedLook<TRow>(looks: Partial<ColumnDef<TRow>>[]): Partial<ColumnDef<TRow>> {
    const first = looks[0] ?? {}
    const agree = looks.every(
        (look) =>
            look.type === first.type &&
            look.typeOptions === first.typeOptions &&
            look.cell === first.cell
    )
    if (agree) return first

    return {
        align: first.align ?? 'right',
        ...(first.width === undefined ? {} : { width: first.width }),
        ...(first.minWidth === undefined ? {} : { minWidth: first.minWidth })
    }
}

export const isPivotTotalColumn = (columnId: string): boolean => columnId.startsWith(TOTAL)

export function isCrossingBody(columnId: string): boolean {
    if (!columnId.startsWith(CROSSING)) return false

    const cut = columnId.lastIndexOf('::')
    if (cut < 0) return false
    return /^\d+$/.test(columnId.slice(cut + 2))
}

export const escapeKey = (key: string): string =>
    key.replaceAll('\\', '\\\\').replaceAll('|', '\\|')

export const pathId = (keys: string[]): string => keys.map(escapeKey).join('|')

export const crossingId = (keys: string[], measure: number): string =>
    `${CROSSING}${pathId(keys)}::${measure}`

export const totalId = (measure: number): string => `${TOTAL}${measure}`

export const subtotalId = (keys: string[], measure: number): string =>
    `${CROSSING}${pathId(keys)}::s${measure}`

export const BLANK_KEY = '(blank)'

export function rawKeyOf<TRow>(row: TRow, column: ColumnDef<TRow>, read: CellRead<TRow>): unknown {
    return read({ id: '', row, index: 0 } as RowNode<TRow>, column)
}

export const textOf = (value: unknown): string => (isBlank(value) ? BLANK_KEY : String(value))

export function keyOf<TRow>(row: TRow, column: ColumnDef<TRow>, read: CellRead<TRow>): string {
    return textOf(rawKeyOf(row, column, read))
}

export function pathOf<TRow>(
    row: TRow,
    columns: ColumnDef<TRow>[],
    read: CellRead<TRow>
): string[] {
    return columns.map((column) => keyOf(row, column, read))
}
