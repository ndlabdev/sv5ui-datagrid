import { describe, expect, it } from 'vitest'
import { BUILT_IN_STYLES, createWorkbook, StyleTable } from '../xlsx/index.js'
import { readDirectory } from './unzip.js'
import {
    columnIndexOf,
    readDateStyles,
    readSharedStrings,
    readSheet,
    readXlsx,
    serialToDate,
    sheetNames,
    unescapeXml
} from './xlsx-read.js'

describe('reading back what the writer wrote', () => {
    it('reads a date the writer marked with no style as the number it is', async () => {
        const workbook = await createWorkbook({
            sheetName: 'Data',
            columns: [{ header: 'When' }],
            rows: [[new Date(2026, 2, 2)]]
        })

        const { rows } = await readXlsx(workbook)
        expect(typeof rows[1]?.[0]).toBe('number')
    })

    it('returns the same grid of values', async () => {
        const workbook = await createWorkbook({
            sheetName: 'Data',
            columns: [{ header: 'Name' }, { header: 'Qty' }, { header: 'When' }],
            rows: [
                ['Chi', 3, new Date(2026, 2, 2)],
                ['An "quoted"', 0, new Date(2026, 11, 31)],
                ['Bình, có dấu', -12.5, null]
            ]
        })

        const { rows, sheets } = await readXlsx(workbook)

        expect(sheets).toEqual(['Data'])
        expect(rows[0]).toEqual(['Name', 'Qty', 'When'])
        expect(rows[1]?.[0]).toBe('Chi')
        expect(rows[1]?.[1]).toBe(3)
        expect(rows[2]?.[0]).toBe('An "quoted"')
        expect(rows[2]?.[1]).toBe(0)
        expect(rows[3]?.[0]).toBe('Bình, có dấu')
        expect(rows[3]?.[1]).toBe(-12.5)
    })

    it('brings a date back as a date, not as a number', async () => {
        const styles = new StyleTable()
        const workbook = await createWorkbook({
            sheetName: 'Data',
            columns: [{ header: 'When' }],
            rows: [[new Date(2026, 2, 2)]],
            datetimeStyle: styles.add(BUILT_IN_STYLES.datetime),
            styles
        })

        const { rows } = await readXlsx(workbook)
        const value = rows[1]?.[0]

        expect(value).toBeInstanceOf(Date)
        expect(`${(value as Date).getFullYear()}-${(value as Date).getMonth() + 1}`).toBe('2026-3')
    })

    it('names the sheet it could not find', async () => {
        const workbook = await createWorkbook({
            sheetName: 'Only',
            columns: [{ header: 'A' }],
            rows: [['x']]
        })

        await expect(readXlsx(workbook, { sheet: 'Missing' })).rejects.toThrow(/no sheet called/)
    })

    it('reads a named sheet rather than the first', async () => {
        const workbook = await createWorkbook([
            { sheetName: 'First', columns: [{ header: 'A' }], rows: [['one']] },
            { sheetName: 'Second', columns: [{ header: 'A' }], rows: [['two']] }
        ])

        const { rows } = await readXlsx(workbook, { sheet: 'Second' })
        expect(rows[1]?.[0]).toBe('two')
    })

    it('leaves a zip it wrote readable by the directory it wrote', async () => {
        const workbook = await createWorkbook({
            sheetName: 'A',
            columns: [{ header: 'A' }],
            rows: [['x']]
        })

        const names = readDirectory(workbook).map((entry) => entry.name)
        expect(names).toContain('xl/workbook.xml')
        expect(names).toContain('xl/worksheets/sheet1.xml')
    })
})

describe('the pieces of a worksheet', () => {
    it('turns a column reference into an index', () => {
        expect(columnIndexOf('A1')).toBe(0)
        expect(columnIndexOf('Z9')).toBe(25)
        expect(columnIndexOf('AA1')).toBe(26)
        expect(columnIndexOf('AB12')).toBe(27)
    })

    it('places a cell by its reference, not by its position', () => {
        const xml = '<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>'
        expect(readSheet(xml, ['left', 'right'])).toEqual([['left', null, 'right']])
    })

    it('keeps a column when the cell before it is empty and closes itself', () => {
        const xml = '<row><c r="A1" s="1"/><c r="B1"><v>2</v></c></row>'
        expect(readSheet(xml, [])).toEqual([[null, 2]])
    })

    it('keeps two empty cells apart rather than swallowing what follows', () => {
        const xml = '<row><c r="A1"/><c r="B1"/><c r="C1" t="s"><v>0</v></c></row>'
        expect(readSheet(xml, ['third'])).toEqual([[null, null, 'third']])
    })

    it('reads a shared string, an inline one and a boolean', () => {
        const xml =
            '<row><c t="s"><v>0</v></c>' +
            '<c t="inlineStr"><is><t>inline</t></is></c>' +
            '<c t="b"><v>1</v></c></row>'
        expect(readSheet(xml, ['shared'])).toEqual([['shared', 'inline', true]])
    })

    it('reads a rich string as the text a person sees', () => {
        const xml = '<si><r><t>Bì</t></r><r><t>nh</t></r></si><si><t>plain</t></si>'
        expect(readSharedStrings(xml)).toEqual(['Bình', 'plain'])
    })

    it('unescapes the five entities and numeric references', () => {
        expect(unescapeXml('a&amp;b&lt;c&gt;d&quot;e&apos;f&#65;&#x42;')).toBe('a&b<c>d"e\'fAB')
    })

    it('turns a serial into the date a spreadsheet shows', () => {
        expect(serialToDate(1).toISOString().slice(0, 10)).toBe('1899-12-31')
        expect(serialToDate(46083).toISOString().slice(0, 10)).toBe('2026-03-02')
    })

    it('reads which styles mean a date', () => {
        const styles =
            '<numFmts><numFmt numFmtId="165" formatCode="dd/mm/yyyy"/></numFmts>' +
            '<cellXfs count="3"><xf numFmtId="0"/><xf numFmtId="165"/><xf numFmtId="14"/></cellXfs>'
        expect([...readDateStyles(styles)]).toEqual([1, 2])
    })

    it('does not read a money format as a date because it holds an m', () => {
        const styles =
            '<numFmts><numFmt numFmtId="166" formatCode="#,##0.00&quot;m&quot;"/></numFmts>' +
            '<cellXfs count="1"><xf numFmtId="166"/></cellXfs>'
        expect([...readDateStyles(styles)]).toEqual([])
    })

    it('lists the sheets a workbook declares', () => {
        expect(sheetNames('<sheets><sheet name="A"/><sheet name="B &amp; C"/></sheets>')).toEqual([
            'A',
            'B & C'
        ])
    })
})

describe('what the reader refuses', () => {
    it('refuses a document that declares entities', () => {
        expect(() => readSheet('<!DOCTYPE x [<!ENTITY a "b">]><row/>', [])).toThrow(/DOCTYPE/)
        expect(() => readSharedStrings('<!ENTITY lol "ha">')).toThrow(/DOCTYPE/)
    })

    it('leaves an entity outside Unicode as the text it is, rather than throwing', () => {
        expect(unescapeXml('&#x110000;')).toBe('&#x110000;')
        expect(unescapeXml('&#999999999;')).toBe('&#999999999;')
        expect(unescapeXml('&#x1F600;')).toBe('😀')
    })

    it('refuses something that is not a zip at all', () => {
        expect(() => readDirectory(new Uint8Array([1, 2, 3, 4]))).toThrow(/not a zip/)
    })
})
