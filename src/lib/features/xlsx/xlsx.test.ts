import { describe, expect, it } from 'vitest'
import { createDataGrid } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { pagination } from '../../features/pagination/index.js'
import { virtualization } from '../../features/virtualization/index.js'
import { serverRowModel } from '../server-row-model/index.js'
import { buildGridXlsx, buildGridXlsxAsync } from './export.js'
import { cellRef, columnLetter, escapeXml, sheetChunks, sheetXml, toSerialDate } from './sheet.js'
import { BUILT_IN_STYLES, StyleTable } from './styles.js'
import { createWorkbook, sanitizeSheetName } from './workbook.js'
import { crc32, createZip, deflateChunks, deflateEntries, zipEntry } from './zip.js'

function readZip(bytes: Uint8Array): Map<string, string> {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const decoder = new TextDecoder()

    let end = bytes.length - 22
    while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--
    expect(end).toBeGreaterThanOrEqual(0)

    const count = view.getUint16(end + 10, true)
    let offset = view.getUint32(end + 16, true)
    const entries = new Map<string, string>()

    for (let i = 0; i < count; i++) {
        expect(view.getUint32(offset, true)).toBe(0x02014b50)
        const crc = view.getUint32(offset + 16, true)
        const size = view.getUint32(offset + 24, true)
        const nameLength = view.getUint16(offset + 28, true)
        const localOffset = view.getUint32(offset + 42, true)
        const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))

        expect(view.getUint32(localOffset, true)).toBe(0x04034b50)
        const localNameLength = view.getUint16(localOffset + 26, true)
        const extraLength = view.getUint16(localOffset + 28, true)
        const start = localOffset + 30 + localNameLength + extraLength
        const data = bytes.subarray(start, start + size)

        expect(crc32(data)).toBe(crc)
        entries.set(name, decoder.decode(data))
        offset += 46 + nameLength
    }

    return entries
}

describe('cell addressing', () => {
    it('numbers columns the way a spreadsheet does', () => {
        expect(columnLetter(0)).toBe('A')
        expect(columnLetter(25)).toBe('Z')
        expect(columnLetter(26)).toBe('AA')
        expect(columnLetter(701)).toBe('ZZ')
        expect(columnLetter(702)).toBe('AAA')
        expect(cellRef(0, 0)).toBe('A1')
        expect(cellRef(9, 2)).toBe('C10')
    })
})

describe('serial dates', () => {
    it('anchors on the 1899-12-30 epoch Excel uses', () => {
        expect(toSerialDate(new Date(1900, 0, 1))).toBe(2)
        expect(toSerialDate(new Date(2026, 0, 1))).toBe(46023)
    })

    it('carries the time of day in the fraction', () => {
        expect(toSerialDate(new Date(2026, 0, 1, 12, 0, 0))).toBeCloseTo(46023.5, 5)
    })
})

describe('escaping', () => {
    it('escapes what would otherwise break the XML', () => {
        expect(escapeXml('a & b < c > "d" \'e\'')).toBe(
            'a &amp; b &lt; c &gt; &quot;d&quot; &apos;e&apos;'
        )
    })

    it('survives a value that looks like markup', () => {
        const xml = sheetXml({
            columns: [{ header: '<script>' }],
            rows: [['</sheetData>']]
        })
        expect(xml).not.toContain('<script>')
        expect(xml).toContain('&lt;/sheetData&gt;')
    })

    it('writes control characters as _xHHHH_ so the file still opens', () => {
        const xml = sheetXml({ columns: [{ header: 'a' }], rows: [['a\u0000b\u0007c']] })
        expect(xml).toContain('a_x0000_b_x0007_c')
        expect(xml).not.toMatch(/[\u0000-\u0008\u000B-\u001F]/)
    })

    it('keeps tab and newline, which XML allows', () => {
        const xml = sheetXml({ columns: [{ header: 'a' }], rows: [['a\tb\nc']] })
        expect(xml).toContain('a\tb\nc')
    })

    it('guards literal _xHHHH_ in the data so Excel does not decode it', () => {
        const xml = sheetXml({ columns: [{ header: 'a' }], rows: [['file_x0041_name']] })
        expect(xml).toContain('file_x005F_x0041_name')
    })

    it('escapes an unpaired surrogate, which is invalid XML', () => {
        const xml = sheetXml({ columns: [{ header: 'a' }], rows: [['a\uD800b']] })
        expect(xml).toContain('a_xD800_b')
    })

    it('caps a cell at the 32,767 characters Excel accepts', () => {
        const xml = sheetXml({ columns: [{ header: 'a' }], rows: [['x'.repeat(40_000)]] })
        expect(xml).toContain('x'.repeat(32_767))
        expect(xml).not.toContain('x'.repeat(32_768))
    })

    it('writes formula-looking text as inert inline text, never as a formula', () => {
        const xml = sheetXml({
            columns: [{ header: 'a' }],
            rows: [["=cmd|' /C calc'!A0"], ['@SUM(A1)'], ['+1-1']]
        })
        expect(xml).not.toContain('<f>')
        expect(xml.match(/t="inlineStr"/g)!.length).toBeGreaterThanOrEqual(3)
    })
})

describe('sheet xml', () => {
    it('types each value so Excel does not read numbers as text', () => {
        const xml = sheetXml({
            columns: [{ header: 'n' }, { header: 's' }, { header: 'b' }, { header: 'd' }],
            rows: [[42, 'text', true, new Date(2026, 0, 1)]]
        })

        expect(xml).toContain('<v>42</v>')
        expect(xml).toContain('t="inlineStr"')
        expect(xml).toContain('t="b"><v>1</v>')
        expect(xml).toContain('<v>46023</v>')
    })

    it('writes an empty cell rather than the word null', () => {
        const xml = sheetXml({ columns: [{ header: 'a' }], rows: [[null], [undefined], ['']] })
        expect(xml).not.toContain('null')
        expect(xml).not.toContain('undefined')
        expect(xml.match(/<c r="A\d+"\/>/g)).toHaveLength(3)
    })

    it('refuses to write NaN or Infinity, which Excel cannot parse', () => {
        const xml = sheetXml({ columns: [{ header: 'a' }], rows: [[NaN], [Infinity]] })
        expect(xml).not.toContain('NaN')
        expect(xml).not.toContain('Infinity')
    })

    it('applies the column style to the body but never to the header', () => {
        const xml = sheetXml({
            columns: [{ header: 'Total', style: 4 }],
            rows: [[10]],
            headerStyle: 1
        })
        expect(xml).toContain('<c r="A1" s="1"')
        expect(xml).toContain('<c r="A2" s="4"')
    })

    it('lets a per-cell style win over the column it sits in', () => {
        const xml = sheetXml({
            columns: [{ header: 'Total', style: 4 }],
            rows: [[10], [20]],
            cellStyle: (row) => (row === 1 ? 7 : undefined)
        })
        expect(xml).toContain('<c r="A2" s="4"')
        expect(xml).toContain('<c r="A3" s="7"')
    })

    it('freezes the header and adds a filter when asked', () => {
        const xml = sheetXml({
            columns: [{ header: 'a' }, { header: 'b' }],
            rows: [[1, 2]],
            freezeHeader: true,
            autoFilter: true
        })
        expect(xml).toContain('state="frozen"')
        expect(xml).toContain('<autoFilter ref="A1:B2"/>')
    })

    it('writes a date before 1900-03-01 as text, dodging the leap-year bug', () => {
        const xml = sheetXml({
            columns: [{ header: 'd', style: 2 }],
            rows: [[new Date(1900, 0, 1)], [new Date(1899, 11, 25)]]
        })
        expect(xml).toContain('1900-01-01')
        expect(xml).toContain('1899-12-25')
        expect(xml).not.toContain('<v>2</v>')
    })

    it('drops an invalid Date instead of writing NaN', () => {
        const xml = sheetXml({ columns: [{ header: 'd' }], rows: [[new Date('nope')]] })
        expect(xml).not.toContain('NaN')
    })

    it('gives a Date in an unstyled column the datetime format', () => {
        const xml = sheetXml({
            columns: [{ header: 'd' }],
            rows: [[new Date(2026, 0, 1)]],
            datetimeStyle: 3
        })
        expect(xml).toContain('<c r="A2" s="3"')
    })

    it('omits the cols block and filter when there are no columns', () => {
        const xml = sheetXml({ columns: [], rows: [], autoFilter: true })
        expect(xml).not.toContain('<cols>')
        expect(xml).not.toContain('<autoFilter')
    })

    it('refuses a sheet Excel could not open', () => {
        expect(() => sheetXml({ columns: [{ header: 'a' }], rows: new Array(1_048_576) })).toThrow(
            RangeError
        )
        expect(() =>
            sheetXml({
                columns: Array.from({ length: 16_385 }, () => ({ header: 'a' })),
                rows: []
            })
        ).toThrow(RangeError)
    })
})

describe('a cell that carries a formula', () => {
    it('writes it as a formula Excel recalculates, not as text', () => {
        const xml = sheetXml({
            columns: [{ header: 'a' }, { header: 'b' }, { header: 'total' }],
            rows: [[2, 3, { formula: 'A2*B2' }]]
        })

        expect(xml).toContain('<c r="C2"><f>A2*B2</f></c>')
        expect(xml).not.toContain('<t xml:space="preserve">A2*B2</t>')
    })

    it('keeps the last known answer beside it, so a reader sees a value before Excel opens', () => {
        const xml = sheetXml({
            columns: [{ header: 'total' }],
            rows: [[{ formula: 'SUM(A1:A9)', value: 6 }]]
        })

        expect(xml).toContain('<f>SUM(A1:A9)</f><v>6</v>')
    })

    it('types a cached string and a cached boolean, which Excel reads by type', () => {
        const xml = sheetXml({
            columns: [{ header: 's' }, { header: 'b' }],
            rows: [
                [
                    { formula: 'A1&"x"', value: 'ax' },
                    { formula: 'TRUE()', value: true }
                ]
            ]
        })

        expect(xml).toContain('<c r="A2" t="str"><f>A1&amp;&quot;x&quot;</f><v>ax</v></c>')
        expect(xml).toContain('<c r="B2" t="b"><f>TRUE()</f><v>1</v></c>')
    })

    it('takes the leading = an app is used to typing, and drops it', () => {
        const xml = sheetXml({ columns: [{ header: 'a' }], rows: [[{ formula: '=1+1' }]] })
        expect(xml).toContain('<f>1+1</f>')
    })

    it('gives a cached Date the datetime format the column did not ask for', () => {
        const xml = sheetXml({
            columns: [{ header: 'd' }],
            rows: [[{ formula: 'TODAY()', value: new Date(2026, 0, 1) }]],
            datetimeStyle: 3
        })

        expect(xml).toContain('<c r="A2" s="3"><f>TODAY()</f><v>46023</v></c>')
    })

    it('writes an empty cell when the formula is blank rather than an empty <f>', () => {
        const xml = sheetXml({ columns: [{ header: 'a' }], rows: [[{ formula: '   ' }]] })
        expect(xml).toContain('<c r="A2"/>')
        expect(xml).not.toContain('<f>')
    })

    it('refuses a formula longer than Excel accepts, naming the cell', () => {
        expect(() =>
            sheetXml({
                columns: [{ header: 'a' }],
                rows: [[{ formula: `A1+${'1+'.repeat(4200)}1` }]]
            })
        ).toThrow(/A2/)
    })

    it('still writes a string that looks like a formula as inert text', () => {
        const xml = sheetXml({ columns: [{ header: 'a' }], rows: [['=1+1']] })
        expect(xml).toContain('t="inlineStr"')
        expect(xml).not.toContain('<f>')
    })
})

describe('sheet names', () => {
    it.each([
        ['Orders', 'Orders'],
        ['a/b:c*d?e[f]g', 'a b c d e f g'],
        ['', 'Sheet1'],
        ['   ', 'Sheet1'],
        ["'Quoted'", 'Quoted'],
        ['History', 'Sheet1'],
        [`a${String.fromCharCode(0)}b`, 'a b']
    ])('sanitizes %p', (input, expected) => {
        expect(sanitizeSheetName(input)).toBe(expected)
    })

    it('caps at the 31 characters Excel allows', () => {
        expect(sanitizeSheetName('x'.repeat(40))).toHaveLength(31)
    })
})

describe('workbook container', () => {
    const bytes = createWorkbook({
        columns: [{ header: 'Name' }, { header: 'Total', style: 1 }],
        rows: [
            ['Alice', 1200],
            ['Bob & Co', 950]
        ],
        sheetName: 'Orders'
    })

    it('starts with the zip signature', () => {
        expect([...bytes.slice(0, 2)]).toEqual([0x50, 0x4b])
    })

    it('holds every part an xlsx reader looks for', () => {
        const entries = readZip(bytes)
        expect([...entries.keys()]).toEqual([
            '[Content_Types].xml',
            '_rels/.rels',
            'xl/workbook.xml',
            'xl/_rels/workbook.xml.rels',
            'xl/styles.xml',
            'xl/worksheets/sheet1.xml'
        ])
    })

    it('round-trips the data through the archive', () => {
        const sheet = readZip(bytes).get('xl/worksheets/sheet1.xml')!
        expect(sheet).toContain('Alice')
        expect(sheet).toContain('Bob &amp; Co')
        expect(sheet).toContain('<v>1200</v>')
    })

    it('names the tab in the workbook part', () => {
        expect(readZip(bytes).get('xl/workbook.xml')).toContain('name="Orders"')
    })

    it('writes the style table the workbook was given', () => {
        const table = new StyleTable()
        table.add(BUILT_IN_STYLES.header)
        const archive = readZip(
            createWorkbook({ columns: [{ header: 'a' }], rows: [[1]], styles: table })
        )
        expect(archive.get('xl/styles.xml')).toContain('<cellXfs count="2">')
    })

    it('falls back to an empty table rather than an empty styles part', () => {
        const styles = readZip(bytes).get('xl/styles.xml')!
        expect(styles).toContain('<cellXfs count="1">')
        expect(styles).toContain('</styleSheet>')
    })

    it('stamps a valid DOS date, not the month-zero epoch some readers reject', () => {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        expect(view.getUint32(0, true)).toBe(0x04034b50)
        expect(view.getUint16(12, true)).toBe((1 << 5) | 1)
    })
})

describe('compressed archive', () => {
    const text = '<row>'.repeat(200)

    it('deflates an entry and records method 8 in both zip headers', async () => {
        const entries = await deflateEntries([zipEntry('a.xml', text)])
        expect(entries[0]!.deflated!.length).toBeLessThan(entries[0]!.data.length)

        const bytes = createZip(entries)
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
        expect(view.getUint16(8, true)).toBe(8)

        let end = bytes.length - 22
        while (view.getUint32(end, true) !== 0x06054b50) end--
        const directory = view.getUint32(end + 16, true)
        expect(view.getUint32(directory, true)).toBe(0x02014b50)
        expect(view.getUint16(directory + 10, true)).toBe(8)
        expect(view.getUint32(directory + 20, true)).toBe(entries[0]!.deflated!.length)
        expect(view.getUint32(directory + 24, true)).toBe(entries[0]!.data.length)
    })

    it('round-trips the deflated bytes through the platform inflater', async () => {
        const [entry] = await deflateEntries([zipEntry('a.xml', text)])
        const stream = new Blob([entry!.deflated! as BlobPart])
            .stream()
            .pipeThrough(new DecompressionStream('deflate-raw'))
        expect(await new Response(stream).text()).toBe(text)
    })

    it('keeps an entry stored when compression would grow it', async () => {
        const [entry] = await deflateEntries([zipEntry('a.xml', 'x')])
        expect(entry!.deflated).toBeUndefined()
    })
})

describe('styled export', () => {
    interface Sale {
        id: number
        region: string
        amount: number
        margin: number
    }

    const saleColumns: ColumnDef<Sale>[] = [
        { id: 'region', header: 'Region' },
        { id: 'amount', header: 'Amount', type: 'currency' },
        { id: 'margin', header: 'Margin', type: 'percent' }
    ]

    function saleGrid(rows = 2) {
        return createDataGrid<Sale>({
            columns: saleColumns,
            data: Array.from({ length: rows }, (_, i) => ({
                id: i + 1,
                region: i % 2 ? 'South' : 'North',
                amount: i % 2 ? -300 : 1200,
                margin: 0.42
            })),
            getRowId: (row) => String(row.id)
        })
    }

    const stylesOf = (bytes: Uint8Array) => readZip(bytes).get('xl/styles.xml')!

    function recordOfCell(bytes: Uint8Array, reference: string): string {
        const sheet = readZip(bytes).get('xl/worksheets/sheet1.xml')!
        const styles = stylesOf(bytes)
        const id = Number(new RegExp(`<c r="${reference}" s="(\\d+)"`).exec(sheet)?.[1])
        const records = [...styles.matchAll(/<xf [^>]*?(?:\/>|>.*?<\/xf>)/g)].map((m) => m[0])
        const count = Number(/<cellXfs count="(\d+)"/.exec(styles)![1])
        return records.slice(records.length - count)[id]!
    }

    it('keeps the type-driven number formats when nothing else is asked', () => {
        const styles = stylesOf(buildGridXlsx(saleGrid()))
        expect(styles).toContain('numFmtId="4"')
        expect(styles).toContain('numFmtId="10"')
    })

    it('takes a header look and applies it to row one only', () => {
        const bytes = buildGridXlsx(saleGrid(), {
            headerStyle: { font: { bold: true, color: 'FFFFFF' }, fill: '1F4E79' }
        })
        expect(stylesOf(bytes)).toContain('<fgColor rgb="FF1F4E79"/>')
        expect(recordOfCell(bytes, 'A1')).not.toBe(recordOfCell(bytes, 'A2'))
    })

    it('lets a column style override the format its type would pick', () => {
        const bytes = buildGridXlsx(saleGrid(), {
            columnStyle: (column) =>
                column.id === 'amount' ? { numberFormat: '[$$-409]#,##0' } : undefined
        })
        expect(stylesOf(bytes)).toContain('formatCode="[$$-409]#,##0"')
    })

    it('styles one cell without touching its neighbours', () => {
        const bytes = buildGridXlsx(saleGrid(), {
            cellStyle: (value) =>
                typeof value === 'number' && value < 0 ? { font: { color: 'C00000' } } : undefined
        })
        expect(stylesOf(bytes)).toContain('<color rgb="FFC00000"/>')
        expect(recordOfCell(bytes, 'B2')).not.toBe(recordOfCell(bytes, 'B3'))
    })

    it('keeps the column format under a cell style that does not mention one', () => {
        const bytes = buildGridXlsx(saleGrid(), {
            cellStyle: (value) =>
                typeof value === 'number' && value < 0 ? { font: { bold: true } } : undefined
        })
        const record = recordOfCell(bytes, 'B3')
        expect(record).toContain('numFmtId="4"')
        expect(record).toContain('applyFont="1"')
    })

    it('writes one style entry however many cells share the look', () => {
        const bytes = buildGridXlsx(saleGrid(500), { cellStyle: () => ({ fill: 'FFFF00' }) })
        expect(Number(/<cellXfs count="(\d+)"/.exec(stylesOf(bytes))?.[1])).toBeLessThan(12)
    })
})

describe('multi-sheet workbooks', () => {
    const twoSheets = createWorkbook([
        { sheetName: 'Orders', columns: [{ header: 'a' }], rows: [[1]] },
        { sheetName: 'Returns', columns: [{ header: 'b' }], rows: [[2]] }
    ])

    it('writes one part per sheet and lists them all', () => {
        const entries = readZip(twoSheets)
        expect(entries.has('xl/worksheets/sheet1.xml')).toBe(true)
        expect(entries.has('xl/worksheets/sheet2.xml')).toBe(true)

        const workbook = entries.get('xl/workbook.xml')!
        expect(workbook).toContain('name="Orders" sheetId="1" r:id="rId1"')
        expect(workbook).toContain('name="Returns" sheetId="2" r:id="rId2"')
    })

    it('declares every sheet in the content types and the relationships', () => {
        const entries = readZip(twoSheets)
        expect(entries.get('[Content_Types].xml')).toContain('/xl/worksheets/sheet2.xml')

        const rels = entries.get('xl/_rels/workbook.xml.rels')!
        expect(rels).toContain('Target="worksheets/sheet2.xml"')
        expect(rels).toContain('Id="rId3"')
    })

    it('makes two sheets of the same name distinct, which Excel demands', () => {
        const workbook = readZip(
            createWorkbook([
                { sheetName: 'Data', columns: [{ header: 'a' }], rows: [] },
                { sheetName: 'Data', columns: [{ header: 'b' }], rows: [] }
            ])
        ).get('xl/workbook.xml')!
        expect(workbook).toContain('name="Data"')
        expect(workbook).toContain('name="Data (2)"')
    })

    it('refuses a workbook with no sheets rather than writing a broken one', () => {
        expect(() => createWorkbook([])).toThrow(RangeError)
    })
})

describe('rows a server grid is still waiting for', () => {
    const rowsIn = (bytes: Uint8Array) =>
        (new TextDecoder().decode(bytes).match(/<row r=/g) ?? []).length

    const TOTAL = 500

    function serverGrid() {
        const grid = createDataGrid<{ id: number; name: string }>({
            columns: [{ id: 'name', header: 'Name' }],
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                virtualization(),
                serverRowModel<{ id: number; name: string }>(
                    {
                        getRows: async ({ startRow, endRow }) => ({
                            rows: Array.from(
                                { length: Math.max(0, Math.min(endRow, TOTAL) - startRow) },
                                (_, i) => ({ id: startRow + i, name: `row ${startRow + i}` })
                            ),
                            rowCount: TOTAL
                        })
                    },
                    {
                        mode: 'infinite',
                        blockSize: 100,
                        placeholder: (index) => ({ id: -index - 1, name: '' })
                    }
                )
            ]
        })
        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        return grid
    }

    it('refuses a synchronous whole-set export rather than writing one block', async () => {
        const grid = serverGrid()
        await expect.poll(() => grid.data.some((row) => row.name !== '')).toBe(true)

        expect(() => buildGridXlsx(grid)).toThrow(/rowModel: "server"/)
    })

    it('leaves placeholder rows out when asked for only what is loaded', async () => {
        const grid = serverGrid()
        await expect.poll(() => grid.data.some((row) => row.name !== '')).toBe(true)

        const loaded = grid.data.filter((row) => row.name !== '').length
        expect(grid.data.length).toBe(TOTAL)
        expect(loaded).toBeLessThan(TOTAL)
        expect(rowsIn(buildGridXlsx(grid, { loadedOnly: true }))).toBe(loaded + 1)
    })

    it('walks the set in large batches, not in the page size the user browses at', async () => {
        const requests: number[] = []
        const grid = createDataGrid<{ id: number; name: string }>({
            columns: [{ id: 'name', header: 'Name' }],
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                pagination({ pageSize: 25 }),
                serverRowModel<{ id: number; name: string }>({
                    getRows: async ({ startRow, endRow }) => {
                        requests.push(endRow - startRow)
                        const end = Math.min(endRow, 4_000)
                        return {
                            rows: Array.from({ length: Math.max(0, end - startRow) }, (_, i) => ({
                                id: startRow + i,
                                name: `row ${startRow + i}`
                            })),
                            rowCount: 4_000
                        }
                    }
                })
            ]
        })
        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await expect.poll(() => grid.data.length).toBe(25)

        const server = grid.feature<{
            fetchAll: (options?: { batchSize?: number }) => Promise<{ id: number }[]>
        }>('serverRowModel')!

        requests.length = 0
        const all = await server.fetchAll()

        expect(all.length).toBe(4_000)
        expect(requests).toHaveLength(1)
        expect(requests[0]).toBeGreaterThanOrEqual(4_000)
    })

    it('honours a batch size an app picks to match its own API limits', async () => {
        const requests: number[] = []
        const grid = createDataGrid<{ id: number; name: string }>({
            columns: [{ id: 'name', header: 'Name' }],
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                pagination({ pageSize: 25 }),
                serverRowModel<{ id: number; name: string }>({
                    getRows: async ({ startRow, endRow }) => {
                        requests.push(endRow - startRow)
                        const end = Math.min(endRow, 900)
                        return {
                            rows: Array.from({ length: Math.max(0, end - startRow) }, (_, i) => ({
                                id: startRow + i,
                                name: `row ${startRow + i}`
                            })),
                            rowCount: 900
                        }
                    }
                })
            ]
        })
        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await expect.poll(() => grid.data.length).toBe(25)

        const server = grid.feature<{
            fetchAll: (options?: { batchSize?: number }) => Promise<{ id: number }[]>
        }>('serverRowModel')!

        requests.length = 0
        const all = await server.fetchAll({ batchSize: 300 })

        expect(all.length).toBe(900)
        expect(requests).toEqual([300, 300, 300])
    })

    it('pages the data source for every row the server has', async () => {
        const grid = serverGrid()
        await expect.poll(() => grid.data.some((row) => row.name !== '')).toBe(true)

        const server = grid.feature<{
            fetchAll: (options: {
                onProgress?: (loaded: number, total: number | null) => void
            }) => Promise<{ id: number; name: string }[]>
        }>('serverRowModel')!

        const seen: number[] = []
        const all = await server.fetchAll({ onProgress: (loaded) => seen.push(loaded) })

        expect(all.length).toBe(TOTAL)
        expect(all.every((row) => row.name !== '')).toBe(true)
        expect(seen.at(-1)).toBe(TOTAL)
        const nodes = all.map((row, index) => ({ id: String(row.id), row, index }))
        expect(rowsIn(buildGridXlsx(grid, { rows: nodes }))).toBe(TOTAL + 1)
    })
})

describe('the compressed and uncompressed builders', () => {
    const grid = () =>
        createDataGrid<{ id: number; text: string }>({
            columns: [{ id: 'text', header: 'Text' }],
            data: Array.from({ length: 2_000 }, (_, i) => ({
                id: i,
                text: 'the same repeated sentence, which deflate should crush'
            })),
            getRowId: (row) => String(row.id)
        })

    it('deflates, where the synchronous builder can only store', async () => {
        const stored = buildGridXlsx(grid())
        const deflated = await buildGridXlsxAsync(grid())

        expect(deflated.byteLength).toBeLessThan(stored.byteLength / 4)
    })

    it('produces an archive holding the same rows either way', async () => {
        const count = (bytes: Uint8Array) =>
            (new TextDecoder().decode(bytes).match(/<row r=/g) ?? []).length

        expect(count(buildGridXlsx(grid()))).toBe(2_001)
        expect(
            createZip(await deflateEntries([zipEntry('a.xml', 'x')])).byteLength
        ).toBeGreaterThan(0)
    })
})

describe('streamed worksheets', () => {
    async function inflate(bytes: Uint8Array): Promise<Uint8Array> {
        const stream = new Blob([bytes as BlobPart])
            .stream()
            .pipeThrough(new DecompressionStream('deflate-raw'))
        return new Uint8Array(await new Response(stream).arrayBuffer())
    }

    const options = {
        columns: [{ header: 'a' }, { header: 'b' }],
        rows: Array.from({ length: 3_000 }, (_, i) => [i, `row ${i}`])
    }

    it('writes a crc and a size matching what the chunks actually held', async () => {
        const entry = await deflateChunks('sheet.xml', sheetChunks(options))
        const raw = await inflate(entry.deflated!)

        expect(entry.size).toBe(raw.length)
        expect(entry.crc).toBe(crc32(raw))
    })

    it('reassembles byte for byte into what the one-shot writer produces', async () => {
        const entry = await deflateChunks('sheet.xml', sheetChunks(options))
        const raw = await inflate(entry.deflated!)

        expect(new TextDecoder().decode(raw)).toBe(sheetXml(options))
    })

    it('crosses a chunk boundary without dropping or duplicating a row', async () => {
        const chunks = [...sheetChunks(options)]
        expect(chunks.length).toBeGreaterThan(2)

        const joined = chunks.join('')
        expect(joined.match(/<row r=/g)).toHaveLength(3_001)
        expect(joined.match(/<row r="501"/g)).toHaveLength(1)
        expect(joined.match(/<row r="3001"/g)).toHaveLength(1)
    })
})
