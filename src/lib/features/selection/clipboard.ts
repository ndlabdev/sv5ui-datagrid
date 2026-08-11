import { formatCellText } from '../../core/utils/format.js'
import { getCellValue } from '../../core/utils/value.js'
import { isSyntheticColumn, type ColumnState, type RowNode } from '../../core/types/index.js'

export type CellMatrix = string[][]

function cellText(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (value instanceof Date) return value.toISOString()
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
    options: { formatted?: boolean; locale?: string } = {}
): CellMatrix {
    const targets = dataColumns(columns)
    return nodes.map((node) =>
        targets.map((column) => {
            const value = getCellValue(node.row, column.def)
            if (format) return format({ value, node, column })
            if (!options.formatted) return cellText(value)
            // A widget column has no text of its own; `formatCellText` says so
            // by returning undefined, and the raw value stands in.
            return formatCellText(value, column.def, options.locale) ?? cellText(value)
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
    // Quoting rules follow the delimiter in use: a `;` file must quote cells
    // holding a semicolon, and need not quote ones holding a comma.
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
    // The BOM is what makes Excel read the file as UTF-8 rather than the
    // system codepage; without it non-ASCII text opens as mojibake.
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    // Revoking in the same task cancels the download in some browsers, which
    // have not yet read the blob when `click` returns.
    setTimeout(() => URL.revokeObjectURL(url), 0)
}
