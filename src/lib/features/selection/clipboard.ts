import { getCellValue } from '../../core/value.js'
import { SELECTION_COLUMN_ID, type ColumnState, type RowNode } from '../../core/types.js'

export type CellMatrix = string[][]

function cellText(value: unknown): string {
    if (value === null || value === undefined) return ''
    if (value instanceof Date) return value.toISOString()
    return String(value)
}

export function dataColumns<TRow>(columns: ColumnState<TRow>[]): ColumnState<TRow>[] {
    return columns.filter((column) => column.id !== SELECTION_COLUMN_ID)
}

export function rowsToMatrix<TRow>(
    nodes: RowNode<TRow>[],
    columns: ColumnState<TRow>[]
): CellMatrix {
    const targets = dataColumns(columns)
    return nodes.map((node) =>
        targets.map((column) => cellText(getCellValue(node.row, column.def)))
    )
}

export function withHeaderRow<TRow>(matrix: CellMatrix, columns: ColumnState<TRow>[]): CellMatrix {
    return [dataColumns(columns).map((column) => column.header), ...matrix]
}

export function toTsv(matrix: CellMatrix): string {
    return matrix
        .map((row) => row.map((cell) => cell.replace(/[\t\n\r]/g, ' ')).join('\t'))
        .join('\n')
}

function csvCell(cell: string): string {
    return /[",\n\r]/.test(cell) ? `"${cell.replaceAll('"', '""')}"` : cell
}

export function toCsv(matrix: CellMatrix): string {
    return matrix.map((row) => row.map(csvCell).join(',')).join('\r\n')
}

export function downloadCsv(csv: string, filename: string): void {
    if (typeof document === 'undefined') return
    const blob = new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename
    anchor.click()
    URL.revokeObjectURL(url)
}
