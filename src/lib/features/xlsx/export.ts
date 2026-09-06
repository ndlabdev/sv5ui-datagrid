import { gateReader, type GridState, isDataRow } from '../../core/grid/index.js'
import { type ColumnState, type RowNode, SELECTION_COLUMN_ID } from '../../core/types/index.js'
import type { FormatRule } from '../conditional-formatting/index.js'
import {
    DEFAULT_FORMAT_COLORS,
    xlsxFormatRules,
    type XlsxCfRule,
    type XlsxFormatColors
} from './conditional-format.js'
import { type CellValue, columnLetter, type SheetColumn } from './sheet.js'
import { BUILT_IN_STYLES, StyleTable } from './styles.js'
import type { XlsxStyle } from './styles.types.js'
import {
    deflatedWorkbookEntries,
    workbookEntries,
    XLSX_MIME,
    type WorkbookOptions
} from './workbook.js'
import { createZip } from './zip.js'

export interface ExportXlsxOptions<TRow> {
    filename?: string

    sheetName?: string

    columnIds?: string[]

    rows?: RowNode<TRow>[]

    selectedOnly?: boolean

    freezeHeader?: boolean

    autoFilter?: boolean

    value?: (row: TRow, column: ColumnState<TRow>) => CellValue | undefined

    headerStyle?: XlsxStyle

    columnStyle?: (column: ColumnState<TRow>) => XlsxStyle | undefined

    cellStyle?: (value: CellValue, row: TRow, column: ColumnState<TRow>) => XlsxStyle | undefined

    conditionalFormatting?: boolean | XlsxFormatColors

    loadedOnly?: boolean

    onProgress?: (loaded: number, total: number | null) => void

    batchSize?: number
}

const SERVER_EXPORT_HINT =
    'xlsx: this grid uses rowModel: "server", so only the rows currently held in ' +
    'memory are available synchronously. Use await downloadGridXlsx(grid), which ' +
    'pages the data source for the whole set, or pass { loadedOnly: true } to ' +
    'export just what is on screen.'

function isServerGrid<TRow>(grid: GridState<TRow>): boolean {
    return grid.rowModel === 'server'
}

function exportsWholeSet<TRow>(grid: GridState<TRow>, options: ExportXlsxOptions<TRow>): boolean {
    return isServerGrid(grid) && !options.rows && !options.loadedOnly && !options.selectedOnly
}

function typeStyle<TRow>(column: ColumnState<TRow>): XlsxStyle {
    switch (column.def.type) {
        case 'currency':
            return BUILT_IN_STYLES.currency
        case 'percent':
            return BUILT_IN_STYLES.percent
        case 'date':
            return BUILT_IN_STYLES.date
        case 'datetime':
            return BUILT_IN_STYLES.datetime
        default:
            return {}
    }
}

function merge(base: XlsxStyle, over: XlsxStyle | undefined): XlsxStyle {
    if (!over) return base
    return {
        ...base,
        ...over,
        font: over.font || base.font ? { ...base.font, ...over.font } : undefined,
        border: over.border || base.border ? { ...base.border, ...over.border } : undefined,
        alignment:
            over.alignment || base.alignment ? { ...base.alignment, ...over.alignment } : undefined
    }
}

function asDate(value: unknown, dateOnly: boolean): CellValue {
    const date = value instanceof Date ? value : new Date(String(value))
    if (Number.isNaN(date.getTime())) return String(value)
    return dateOnly ? new Date(date.getFullYear(), date.getMonth(), date.getDate()) : date
}

function cellValueOf<TRow>(value: unknown, column: ColumnState<TRow>): CellValue {
    if (value === null || value === undefined) return null
    if (column.def.type === 'date') return asDate(value, true)
    if (column.def.type === 'datetime') return asDate(value, false)
    if (value instanceof Date) return value

    const primitive =
        typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string'
    return primitive ? (value as CellValue) : String(value)
}

function exportColumns<TRow>(grid: GridState<TRow>, columnIds?: string[]): ColumnState<TRow>[] {
    const visible = grid.columns.visible.filter((column) => column.id !== SELECTION_COLUMN_ID)
    if (!columnIds) return visible

    return columnIds.flatMap((id) => visible.filter((column) => column.id === id))
}

function loadedRows<TRow>(grid: GridState<TRow>, options: ExportXlsxOptions<TRow>): TRow[] {
    if (options.rows) return options.rows.map((node) => node.row)

    const isData = isDataRow
    const nodes = grid.preWindowNodes.filter(isData)
    if (!options.selectedOnly) return nodes.map((node) => node.row)

    const selection = grid.feature<{ isSelected: (id: string) => boolean }>('selection')
    const picked = selection ? nodes.filter((node) => selection.isSelected(node.id)) : nodes
    return picked.map((node) => node.row)
}

function withComputedColumns<TRow>(grid: GridState<TRow>, rows: TRow[]): TRow[] {
    const computed = grid.feature<{
        apply: (nodes: RowNode<TRow>[]) => RowNode<TRow>[]
    }>('formula')
    if (!computed) return rows

    const nodes = rows.map((row, index) => ({ id: grid.getRowId(row), row, index }))
    return computed.apply(nodes).map((node) => node.row)
}

async function exportRows<TRow>(
    grid: GridState<TRow>,
    options: ExportXlsxOptions<TRow>
): Promise<TRow[]> {
    if (!exportsWholeSet(grid, options)) return loadedRows(grid, options)

    const server = grid.feature<{
        fetchAll: (options: {
            batchSize?: number
            onProgress?: ExportXlsxOptions<TRow>['onProgress']
        }) => Promise<TRow[]>
    }>('serverRowModel')
    if (!server) throw new Error(SERVER_EXPORT_HINT)

    const fetched = await server.fetchAll({
        batchSize: options.batchSize,
        onProgress: options.onProgress
    })
    return withComputedColumns(grid, fetched)
}

function workbookOptions<TRow>(
    grid: GridState<TRow>,
    options: ExportXlsxOptions<TRow>,
    source: TRow[]
): WorkbookOptions {
    const columns = exportColumns(grid, options.columnIds)

    const styles = new StyleTable()
    const columnStyles = columns.map((column) =>
        merge(typeStyle(column), options.columnStyle?.(column))
    )

    const sheetColumns: SheetColumn[] = columns.map((column, index) => ({
        header: column.header,
        width: column.width ? Math.max(8, Math.round(column.width / 7)) : 16,
        style: styles.add(columnStyles[index]!)
    }))

    const read = gateReader(grid, 'export')
    const rows = source.map((row, index) =>
        columns.map((column) => {
            const override = options.value?.(row, column)
            if (override !== undefined) return override

            const node = { id: grid.getRowId(row), row, index }
            return cellValueOf(read(node, column.def), column)
        })
    )

    const perCell = options.cellStyle
    const cellStyle = perCell
        ? (row: number, index: number) => {
              const column = columns[index]
              const data = source[row]
              if (!column || !data) return undefined
              const extra = perCell(rows[row]?.[index] ?? null, data, column)
              return extra ? styles.add(merge(columnStyles[index]!, extra)) : undefined
          }
        : undefined

    return {
        columns: sheetColumns,
        rows,
        conditionalFormats: formatRulesOf({
            grid,
            options,
            columns,
            rowCount: rows.length,
            styles
        }),
        sheetName: options.sheetName ?? stripExtension(options.filename ?? 'export'),
        freezeHeader: options.freezeHeader ?? true,
        autoFilter: options.autoFilter ?? true,
        headerStyle: styles.add(merge(BUILT_IN_STYLES.header, options.headerStyle)),
        datetimeStyle: styles.add(BUILT_IN_STYLES.datetime),
        cellStyle,
        styles
    }
}

interface FormatRulesInput<TRow> {
    grid: GridState<TRow>
    options: ExportXlsxOptions<TRow>
    columns: ColumnState<TRow>[]
    rowCount: number
    styles: StyleTable
}

function formatRulesOf<TRow>(input: FormatRulesInput<TRow>): XlsxCfRule[] {
    const { grid, options, columns, rowCount, styles } = input
    if (options.conditionalFormatting === false) return []

    const state = grid.feature<{ rules: readonly FormatRule[] }>('conditionalFormatting')
    if (!state) return []

    const letters = new Map(columns.map((column, index) => [column.id, columnLetter(index)]))
    const overrides =
        typeof options.conditionalFormatting === 'object' ? options.conditionalFormatting : {}

    return xlsxFormatRules(state.rules, {
        letterOf: (columnId) => letters.get(columnId),
        rowCount,
        colors: { ...DEFAULT_FORMAT_COLORS, ...overrides },
        addDxf: (style) => styles.addDxf(style)
    })
}

export function buildGridXlsx<TRow>(
    grid: GridState<TRow>,
    options: ExportXlsxOptions<TRow> = {}
): Uint8Array {
    if (exportsWholeSet(grid, options)) throw new Error(SERVER_EXPORT_HINT)
    return createZip(workbookEntries(workbookOptions(grid, options, loadedRows(grid, options))))
}

function stripExtension(name: string): string {
    return name.replace(/\.xlsx$/i, '')
}

function withExtension(name: string): string {
    return /\.xlsx$/i.test(name) ? name : `${name}.xlsx`
}

export async function buildGridXlsxAsync<TRow>(
    grid: GridState<TRow>,
    options: ExportXlsxOptions<TRow> = {}
): Promise<Uint8Array> {
    const source = await exportRows(grid, options)
    return createZip(await deflatedWorkbookEntries(workbookOptions(grid, options, source)))
}

export async function downloadGridXlsx<TRow>(
    grid: GridState<TRow>,
    options: ExportXlsxOptions<TRow> = {}
): Promise<void> {
    const bytes = await buildGridXlsxAsync(grid, options)
    const blob = new Blob([bytes as BlobPart], { type: XLSX_MIME })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = withExtension(options.filename ?? 'export.xlsx')
    link.click()

    setTimeout(() => URL.revokeObjectURL(url), 0)
}
