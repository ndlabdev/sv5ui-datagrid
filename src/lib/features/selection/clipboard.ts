import { formatCellText, toDate } from '../../core/utils/index.js'
import { readCell } from '../../core/grid/index.js'
import {
    isSyntheticColumn,
    type CellValueReader,
    type ColumnDef,
    type ColumnState,
    type RowNode
} from '../../core/types/index.js'

export type CellMatrix = string[][]

function pad(value: number, width = 2): string {
    return String(value).padStart(width, '0')
}

function isoDay(date: Date): string {
    return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function isoDateTime(date: Date): string {
    return `${isoDay(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function cellText<TRow>(value: unknown, def?: ColumnDef<TRow>): string {
    if (value === null || value === undefined) return ''

    const type = def?.type
    if (type === 'date' || type === 'datetime') {
        const date = toDate(value)
        if (date) return type === 'date' ? isoDay(date) : isoDateTime(date)
    }
    if (value instanceof Date) return isoDateTime(value)
    return String(value)
}

export function dataColumns<TRow>(columns: ColumnState<TRow>[]): ColumnState<TRow>[] {
    return columns.filter((column) => !isSyntheticColumn(column.id))
}

/** Unformatted keeps a spreadsheet's number or date; formatted reads as the grid. */
export type ExportFormatter<TRow> = (context: {
    value: unknown
    node: RowNode<TRow>
    column: ColumnState<TRow>
}) => string

export function rowsToMatrix<TRow>(
    nodes: RowNode<TRow>[],
    columns: ColumnState<TRow>[],
    format?: ExportFormatter<TRow>,
    options: {
        formatted?: boolean
        locale?: string
        read?: (column: ColumnState<TRow>) => CellValueReader<TRow> | undefined
    } = {}
): CellMatrix {
    const targets = dataColumns(columns)
    const readers = options.read ? targets.map(options.read) : undefined
    return nodes.map((node) =>
        targets.map((column, index) => {
            const value = readCell(node, column.def, readers?.[index])
            if (format) return format({ value, node, column })
            if (!options.formatted) return cellText(value, column.def)
            return formatCellText(value, column.def, options.locale) ?? cellText(value, column.def)
        })
    )
}

/** In the order asked for; unknown ids are skipped, not left blank. */
export function pickColumns<TRow>(
    columns: ColumnState<TRow>[],
    ids?: string[]
): ColumnState<TRow>[] {
    const exportable = dataColumns(columns)
    if (!ids) return exportable
    return ids
        .map((id) => exportable.find((column) => column.id === id))
        .filter((column): column is ColumnState<TRow> => column !== undefined)
}

export function withHeaderRow<TRow>(matrix: CellMatrix, columns: ColumnState<TRow>[]): CellMatrix {
    return [dataColumns(columns).map((column) => column.header), ...matrix]
}

export function toTsv(matrix: CellMatrix): string {
    return matrix
        .map((row) => row.map((cell) => cell.replace(/[\t\n\r]/g, ' ')).join('\t'))
        .join('\n')
}

/**
 * A cell opening with `=`, `+`, `-`, `@` or a control character executes as a
 * formula on the machine that opens the file; an apostrophe makes it literal.
 * The clipboard is left alone: quoting there would corrupt the paste back.
 */
export function neutralizeFormula(cell: string): string {
    return /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell
}

/** The separator every locale agrees on, and the one Excel assumes in en-US. */
export const DEFAULT_CSV_DELIMITER = ','

function csvCell(cell: string, delimiter: string): string {
    const safe = neutralizeFormula(cell)
    return safe.includes(delimiter) || /["\n\r]/.test(safe)
        ? `"${safe.replaceAll('"', '""')}"`
        : safe
}

export function toCsv(matrix: CellMatrix, delimiter: string = DEFAULT_CSV_DELIMITER): string {
    return matrix
        .map((row) => row.map((cell) => csvCell(cell, delimiter)).join(delimiter))
        .join('\r\n')
}

export function downloadCsv(csv: string, filename: string): void {
    if (typeof document === 'undefined') return
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
}
