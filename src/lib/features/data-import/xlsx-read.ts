import { readArchive } from './unzip.js'

interface SheetCell {
    value: string | number | boolean | Date | null
}

const ENTITIES: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'"
}

const EXCEL_EPOCH = Date.UTC(1899, 11, 30)
const MS_PER_DAY = 86_400_000

const MAX_CODE_POINT = 0x10ffff

function fromCode(code: number, whole: string): string {
    if (!Number.isFinite(code) || code < 0 || code > MAX_CODE_POINT) return whole
    return String.fromCodePoint(code)
}

export function unescapeXml(text: string): string {
    return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (whole, entity: string) => {
        if (entity.startsWith('#x') || entity.startsWith('#X')) {
            return fromCode(Number.parseInt(entity.slice(2), 16), whole)
        }
        if (entity.startsWith('#')) return fromCode(Number.parseInt(entity.slice(1), 10), whole)
        return ENTITIES[entity] ?? whole
    })
}

function refuseDoctype(xml: string, what: string): void {
    if (/<!DOCTYPE|<!ENTITY/i.test(xml)) {
        throw new Error(
            `${what} carries a DOCTYPE or ENTITY declaration. Those are how a small file expands ` +
                'into a huge one, and this reader does not resolve them.'
        )
    }
}

function textOf(node: string): string {
    let out = ''
    const pattern = /<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g
    let match = pattern.exec(node)
    while (match) {
        out += unescapeXml(match[1] ?? '')
        match = pattern.exec(node)
    }
    return out
}

export function readSharedStrings(xml: string | undefined): string[] {
    if (!xml) return []
    refuseDoctype(xml, 'sharedStrings.xml')

    const strings: string[] = []
    const pattern = /<si(?:\s[^>]*)?>([\s\S]*?)<\/si>|<si(?:\s[^>]*)?\/>/g
    let match = pattern.exec(xml)
    while (match) {
        strings.push(match[1] === undefined ? '' : textOf(match[1]))
        match = pattern.exec(xml)
    }
    return strings
}

export function columnIndexOf(reference: string): number {
    let index = 0
    for (const char of reference) {
        const code = char.charCodeAt(0)
        if (code < 65 || code > 90) break
        index = index * 26 + (code - 64)
    }
    return index - 1
}

export function serialToDate(serial: number): Date {
    return new Date(EXCEL_EPOCH + Math.round(serial * MS_PER_DAY))
}

interface CellContext {
    type: string | undefined
    style: number | undefined
    strings: string[]
    dateStyles: Set<number>
}

function typedValue(text: string, context: CellContext): SheetCell['value'] | undefined {
    if (context.type === 's') return context.strings[Number(text)] ?? ''
    if (context.type === 'str') return text
    if (context.type === 'b') return text === '1'
    if (context.type === 'e') return null
    return undefined
}

function cellValue(cell: string, context: CellContext): SheetCell['value'] {
    if (context.type === 'inlineStr') return textOf(cell)

    const raw = /<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/.exec(cell)?.[1]
    if (raw === undefined) return null

    const text = unescapeXml(raw)
    const typed = typedValue(text, context)
    if (typed !== undefined) return typed

    const numeric = Number(text)
    if (!Number.isFinite(numeric)) return text
    if (context.style !== undefined && context.dateStyles.has(context.style)) {
        return serialToDate(numeric)
    }
    return numeric
}

function customDateFormats(stylesXml: string): Set<number> {
    const ids = new Set<number>([14, 15, 16, 17, 22, 45, 46, 47])
    const pattern = /<numFmt[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]*)"/g

    let match = pattern.exec(stylesXml)
    while (match) {
        const code = unescapeXml(match[2] ?? '')
        if (/[dmyhs]/i.test(code) && !/[#0]/.test(code.replace(/\[[^\]]*\]/g, ''))) {
            ids.add(Number(match[1]))
        }
        match = pattern.exec(stylesXml)
    }
    return ids
}

export function readDateStyles(stylesXml: string | undefined): Set<number> {
    const styles = new Set<number>()
    if (!stylesXml) return styles
    refuseDoctype(stylesXml, 'styles.xml')

    const dateFormats = customDateFormats(stylesXml)
    const cellXfs = /<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/.exec(stylesXml)?.[1] ?? ''
    const pattern = /<xf\b[^>]*>/g

    let index = 0
    let entry = pattern.exec(cellXfs)
    while (entry) {
        const id = Number(/numFmtId="(\d+)"/.exec(entry[0])?.[1] ?? '0')
        if (dateFormats.has(id)) styles.add(index)
        index += 1
        entry = pattern.exec(cellXfs)
    }
    return styles
}

function readRow(body: string, strings: string[], dateStyles: Set<number>): SheetCell['value'][] {
    const cells: SheetCell['value'][] = []
    const pattern = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g

    let match = pattern.exec(body)
    while (match) {
        const attributes = match[1] ?? ''
        const reference = /r="([A-Z]+)\d+"/.exec(attributes)?.[1]
        const at = reference ? columnIndexOf(reference) : cells.length
        const styleText = /s="(\d+)"/.exec(attributes)?.[1]

        while (cells.length < at) cells.push(null)
        cells[at] = cellValue(match[2] ?? '', {
            type: /t="([^"]+)"/.exec(attributes)?.[1],
            style: styleText === undefined ? undefined : Number(styleText),
            strings,
            dateStyles
        })

        match = pattern.exec(body)
    }

    return cells
}

interface SheetLimits {
    dateStyles?: Set<number>
    maxRows?: number
}

const DEFAULT_SHEET_MAX_ROWS = 200_000

export function readSheet(
    xml: string,
    strings: string[],
    limits: SheetLimits = {}
): SheetCell['value'][][] {
    refuseDoctype(xml, 'The worksheet')

    const dateStyles = limits.dateStyles ?? new Set<number>()
    const maxRows = limits.maxRows ?? DEFAULT_SHEET_MAX_ROWS

    const rows: SheetCell['value'][][] = []
    const pattern = /<row\b[^>]*>([\s\S]*?)<\/row>|<row\b[^>]*\/>/g

    let match = pattern.exec(xml)
    while (match) {
        rows.push(readRow(match[1] ?? '', strings, dateStyles))
        if (rows.length > maxRows) {
            throw new RangeError(
                `The worksheet holds more than ${maxRows.toLocaleString('en-US')} rows, which is ` +
                    'more than this reads in one go. Split it, or raise maxRows.'
            )
        }
        match = pattern.exec(xml)
    }

    while (rows.length > 0 && rows[rows.length - 1]!.every((cell) => cell === null)) rows.pop()
    return rows
}

export function sheetNames(workbookXml: string | undefined): string[] {
    if (!workbookXml) return []
    refuseDoctype(workbookXml, 'workbook.xml')

    const names: string[] = []
    const pattern = /<sheet\b[^>]*name="([^"]*)"/g
    let match = pattern.exec(workbookXml)
    while (match) {
        names.push(unescapeXml(match[1] ?? ''))
        match = pattern.exec(workbookXml)
    }
    return names
}

export async function readXlsx(
    bytes: Uint8Array,
    options: { sheet?: string; maxRows?: number } = {}
): Promise<{ rows: SheetCell['value'][][]; sheets: string[] }> {
    const wanted = (name: string) =>
        name === 'xl/workbook.xml' ||
        name === 'xl/sharedStrings.xml' ||
        name === 'xl/styles.xml' ||
        /^xl\/worksheets\/sheet\d+\.xml$/.test(name)

    const files = await readArchive(bytes, wanted)
    const sheets = sheetNames(files.get('xl/workbook.xml'))
    const strings = readSharedStrings(files.get('xl/sharedStrings.xml'))
    const dateStyles = readDateStyles(files.get('xl/styles.xml'))

    const index = options.sheet ? sheets.indexOf(options.sheet) : 0
    if (index < 0) {
        throw new Error(
            `This workbook has no sheet called "${options.sheet}". It has: ${sheets.join(', ')}.`
        )
    }

    const xml = files.get(`xl/worksheets/sheet${index + 1}.xml`)
    if (!xml) throw new Error('This workbook has no readable worksheet.')

    return {
        rows: readSheet(xml, strings, { dateStyles, maxRows: options.maxRows }),
        sheets
    }
}
