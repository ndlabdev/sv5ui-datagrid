import { escapeXml, sheetChunks, type SheetOptions, sheetXml } from './sheet.js'
import { StyleTable } from './styles.js'
import { createZip, deflateChunks, deflateEntries, type ZipEntry, zipEntry } from './zip.js'

const ROOT_RELS =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'

function workbookXml(names: string[]): string {
    const sheets = names
        .map(
            (name, index) =>
                `<sheet name="${escapeXml(name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
        )
        .join('')
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets}</sheets></workbook>`
}

function contentTypes(count: number): string {
    const sheets = Array.from(
        { length: count },
        (_, index) =>
            `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    ).join('')
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
}

function workbookRels(count: number): string {
    const sheets = Array.from(
        { length: count },
        (_, index) =>
            `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
    ).join('')
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets}<Relationship Id="rId${count + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
}

function uniqueNames(sheets: WorkbookSheet[]): string[] {
    const taken = new Set<string>()
    return sheets.map((sheet, index) => {
        const base = sanitizeSheetName(sheet.sheetName ?? `Sheet${index + 1}`)
        let name = base
        let suffix = 2
        while (taken.has(name.toLowerCase())) name = `${base.slice(0, 28)} (${suffix++})`
        taken.add(name.toLowerCase())
        return name
    })
}

export interface WorkbookSheet extends SheetOptions {
    sheetName?: string
}

export interface WorkbookOptions extends WorkbookSheet {
    styles?: StyleTable
}

export function sanitizeSheetName(name: string): string {
    const cleaned = name
        .replace(/[[\]:*?/\\\u0000-\u001F]/g, ' ')
        .trim()
        .replace(/^'+|'+$/g, '')
        .slice(0, 31)
        .trim()
    return cleaned === '' || /^history$/i.test(cleaned) ? 'Sheet1' : cleaned
}

export function workbookEntries(options: WorkbookOptions | WorkbookOptions[]): ZipEntry[] {
    const sheets = Array.isArray(options) ? options : [options]
    if (sheets.length === 0) throw new RangeError('xlsx: a workbook needs at least one sheet')

    const styles = sheets.find((sheet) => sheet.styles)?.styles ?? new StyleTable()
    const names = uniqueNames(sheets)

    const worksheets = sheets.map((sheet, index) =>
        zipEntry(`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet))
    )

    return [
        zipEntry('[Content_Types].xml', contentTypes(sheets.length)),
        zipEntry('_rels/.rels', ROOT_RELS),
        zipEntry('xl/workbook.xml', workbookXml(names)),
        zipEntry('xl/_rels/workbook.xml.rels', workbookRels(sheets.length)),
        zipEntry('xl/styles.xml', styles.toXml()),
        ...worksheets
    ]
}

export async function deflatedWorkbookEntries(
    options: WorkbookOptions | WorkbookOptions[]
): Promise<ZipEntry[]> {
    const sheets = Array.isArray(options) ? options : [options]
    if (sheets.length === 0) throw new RangeError('xlsx: a workbook needs at least one sheet')

    const styles = sheets.find((sheet) => sheet.styles)?.styles ?? new StyleTable()
    const names = uniqueNames(sheets)

    const worksheets: ZipEntry[] = []
    for (const [index, sheet] of sheets.entries()) {
        worksheets.push(
            await deflateChunks(`xl/worksheets/sheet${index + 1}.xml`, sheetChunks(sheet))
        )
    }

    const rest = await deflateEntries([
        zipEntry('[Content_Types].xml', contentTypes(sheets.length)),
        zipEntry('_rels/.rels', ROOT_RELS),
        zipEntry('xl/workbook.xml', workbookXml(names)),
        zipEntry('xl/_rels/workbook.xml.rels', workbookRels(sheets.length)),
        zipEntry('xl/styles.xml', styles.toXml())
    ])

    return [...rest, ...worksheets]
}

export function createWorkbook(options: WorkbookOptions | WorkbookOptions[]): Uint8Array {
    return createZip(workbookEntries(options))
}

export async function createWorkbookAsync(
    options: WorkbookOptions | WorkbookOptions[]
): Promise<Uint8Array> {
    return createZip(await deflatedWorkbookEntries(options))
}

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
