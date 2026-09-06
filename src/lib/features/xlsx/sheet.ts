import { conditionalFormatXml, type XlsxCfRule } from './conditional-format.js'

export interface XlsxFormula {
    formula: string
    value?: string | number | boolean | Date | null
}

export type CellValue = string | number | boolean | Date | null | undefined | XlsxFormula

export const DEFAULT_STYLE = 0

export type StyleId = number

export interface SheetColumn {
    header: string

    width?: number
    style?: StyleId
}

const MAX_ROWS = 1_048_576
const MAX_COLUMNS = 16_384

const CELL_TEXT_LIMIT = 32_767

const FORMULA_TEXT_LIMIT = 8_192

export function escapeXml(value: string): string {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;')
}

const INVALID_XML =
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

const X_ESCAPE_LITERAL = /_(x[0-9A-Fa-f]{4})_/g

const xEscape = (char: string): string =>
    `_x${char.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0')}_`

export function escapeCellText(value: string): string {
    return escapeXml(
        value
            .slice(0, CELL_TEXT_LIMIT)
            .replace(X_ESCAPE_LITERAL, '_x005F_$1_')
            .replace(INVALID_XML, xEscape)
    )
}

export function columnLetter(index: number): string {
    let letters = ''
    let remaining = index
    do {
        letters = String.fromCharCode(65 + (remaining % 26)) + letters
        remaining = Math.floor(remaining / 26) - 1
    } while (remaining >= 0)
    return letters
}

export function cellRef(row: number, column: number): string {
    return `${columnLetter(column)}${row + 1}`
}

export function toSerialDate(date: Date): number {
    const utc = Date.UTC(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        date.getHours(),
        date.getMinutes(),
        date.getSeconds(),
        date.getMilliseconds()
    )
    return utc / 86_400_000 + 25569
}

const pad = (value: number, width = 2): string => String(value).padStart(width, '0')

function isoLocal(date: Date): string {
    const day = `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    const hasTime = date.getHours() + date.getMinutes() + date.getSeconds() > 0
    return hasTime
        ? `${day} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
        : day
}

export function isFormulaCell(value: CellValue): value is XlsxFormula {
    return (
        typeof value === 'object' &&
        value !== null &&
        !(value instanceof Date) &&
        typeof (value as XlsxFormula).formula === 'string'
    )
}

function formulaText(cell: XlsxFormula, reference: string): string {
    const expression = cell.formula.replace(INVALID_XML, '').trim().replace(/^=+/, '')
    if (expression.length > FORMULA_TEXT_LIMIT) {
        throw new RangeError(
            `xlsx: the formula for ${reference} is ${expression.length} characters; Excel stops at ${FORMULA_TEXT_LIMIT}`
        )
    }
    return escapeXml(expression)
}

function cachedXml(value: XlsxFormula['value']): string {
    if (value === null || value === undefined) return ''
    if (typeof value === 'number') return Number.isFinite(value) ? `<v>${value}</v>` : ''
    if (typeof value === 'boolean') return `<v>${value ? 1 : 0}</v>`
    if (value instanceof Date) {
        const serial = toSerialDate(value)
        return Number.isNaN(serial) ? '' : `<v>${serial}</v>`
    }
    return `<v>${escapeCellText(value)}</v>`
}

function cachedType(value: XlsxFormula['value']): string {
    if (typeof value === 'boolean') return ' t="b"'
    if (typeof value === 'string') return ' t="str"'
    return ''
}

function formulaXml(attributes: string, cell: XlsxFormula, reference: string): string {
    const expression = formulaText(cell, reference)
    if (expression === '') return `<c ${attributes}/>`

    const cached = cachedXml(cell.value)
    const typed = cached === '' ? '' : cachedType(cell.value)
    return `<c ${attributes}${typed}><f>${expression}</f>${cached}</c>`
}

function inlineString(attributes: string, text: string): string {
    return `<c ${attributes} t="inlineStr"><is><t xml:space="preserve">${escapeCellText(text)}</t></is></c>`
}

const dated = (value: CellValue): boolean =>
    value instanceof Date || (isFormulaCell(value) && value.value instanceof Date)

const appliedStyle = (value: CellValue, style: StyleId, datetime: StyleId): StyleId =>
    dated(value) && style === DEFAULT_STYLE ? datetime : style

function isBlank(value: CellValue): boolean {
    return value === null || value === undefined || value === ''
}

function bodyXml(attributes: string, value: CellValue, reference: string): string {
    if (isFormulaCell(value)) return formulaXml(attributes, value, reference)
    if (typeof value === 'number') {
        return Number.isFinite(value)
            ? `<c ${attributes}><v>${value}</v></c>`
            : `<c ${attributes}/>`
    }
    if (typeof value === 'boolean') return `<c ${attributes} t="b"><v>${value ? 1 : 0}</v></c>`
    if (value instanceof Date) return dateCellXml(attributes, value)
    return inlineString(attributes, String(value))
}

function cellXml(
    reference: string,
    value: CellValue,
    style: StyleId,
    datetime: StyleId = DEFAULT_STYLE
): string {
    const applied = appliedStyle(value, style, datetime)
    const attributes = `r="${reference}"${applied ? ` s="${applied}"` : ''}`
    return isBlank(value) ? `<c ${attributes}/>` : bodyXml(attributes, value, reference)
}

function dateCellXml(attributes: string, value: Date): string {
    const serial = toSerialDate(value)
    if (Number.isNaN(serial)) return `<c ${attributes}/>`

    if (serial < 61) return inlineString(attributes, isoLocal(value))
    return `<c ${attributes}><v>${serial}</v></c>`
}

export interface SheetOptions {
    columns: SheetColumn[]
    rows: CellValue[][]

    freezeHeader?: boolean

    autoFilter?: boolean

    headerStyle?: StyleId

    datetimeStyle?: StyleId

    cellStyle?: (row: number, column: number) => StyleId | undefined

    conditionalFormats?: XlsxCfRule[]
}

const ROWS_PER_CHUNK = 500

function checkBounds(columns: SheetColumn[], rows: CellValue[][]): void {
    if (columns.length > MAX_COLUMNS) {
        throw new RangeError(
            `xlsx: ${columns.length} columns will not open in Excel (limit ${MAX_COLUMNS})`
        )
    }
    if (rows.length >= MAX_ROWS) {
        throw new RangeError(
            `xlsx: ${rows.length} rows plus the header will not open in Excel (limit ${MAX_ROWS})`
        )
    }
}

function colsXml(columns: SheetColumn[]): string {
    if (columns.length === 0) return ''
    const each = columns
        .map(
            (column, index) =>
                `<col min="${index + 1}" max="${index + 1}" width="${column.width ?? 14}" customWidth="1"/>`
        )
        .join('')
    return `<cols>${each}</cols>`
}

function headerXml(columns: SheetColumn[], style: StyleId): string {
    const cells = columns
        .map((column, index) => cellXml(cellRef(0, index), column.header, style))
        .join('')
    return `<row r="1">${cells}</row>`
}

function rowXml(options: SheetOptions, cells: CellValue[], rowIndex: number): string {
    const content = cells
        .map((value, index) =>
            cellXml(
                cellRef(rowIndex + 1, index),
                value,
                options.cellStyle?.(rowIndex, index) ??
                    options.columns[index]?.style ??
                    DEFAULT_STYLE,
                options.datetimeStyle ?? DEFAULT_STYLE
            )
        )
        .join('')
    return `<row r="${rowIndex + 2}">${content}</row>`
}

function preamble(options: SheetOptions): string {
    const freeze = options.freezeHeader
        ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
        : ''
    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        freeze +
        colsXml(options.columns) +
        '<sheetData>' +
        headerXml(options.columns, options.headerStyle ?? DEFAULT_STYLE)
    )
}

function trailer(options: SheetOptions): string {
    const { columns, rows } = options
    const lastColumn = columnLetter(Math.max(0, columns.length - 1))
    const filter =
        options.autoFilter && columns.length
            ? `<autoFilter ref="A1:${lastColumn}${rows.length + 1}"/>`
            : ''
    const formats = options.conditionalFormats?.length
        ? conditionalFormatXml(options.conditionalFormats)
        : ''
    return `</sheetData>${filter}${formats}</worksheet>`
}

export function* sheetChunks(options: SheetOptions): Generator<string> {
    const { columns, rows } = options
    checkBounds(columns, rows)

    yield preamble(options)

    for (let start = 0; start < rows.length; start += ROWS_PER_CHUNK) {
        const end = Math.min(start + ROWS_PER_CHUNK, rows.length)
        let batch = ''
        for (let index = start; index < end; index++) batch += rowXml(options, rows[index]!, index)
        yield batch
    }

    yield trailer(options)
}

export function sheetXml(options: SheetOptions): string {
    let out = ''
    for (const chunk of sheetChunks(options)) out += chunk
    return out
}
