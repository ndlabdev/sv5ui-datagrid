import { createDataGrid } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { describe, expect, it } from 'vitest'
import { createZip, deflateEntries, zipEntry } from '../xlsx/index.js'
import { dataImport, getDataImport } from './data-import.svelte.js'
import { parseDelimited } from './delimited.js'
import { readArchive, readDirectory, readEntry } from './unzip.js'
import { readSharedStrings, readSheet, unescapeXml } from './xlsx-read.js'

async function lyingZip(realBytes: number, declared: number): Promise<Uint8Array> {
    const [entry] = await deflateEntries([
        zipEntry('xl/worksheets/sheet1.xml', 'A'.repeat(realBytes))
    ])
    const zip = createZip([entry!])

    const view = new DataView(zip.buffer as ArrayBuffer)
    for (let at = 0; at < zip.length - 4; at++) {
        if (view.getUint32(at, true) === 0x02014b50) view.setUint32(at + 24, declared, true)
    }
    return zip
}

describe('a zip that lies about what it unpacks to', () => {
    it('stops unpacking at the cap rather than after it', async () => {
        const zip = await lyingZip(4_000_000, 64)
        const [entry] = readDirectory(zip)

        expect(entry!.size).toBe(64)
        await expect(readEntry(zip, entry!, { maxEntrySize: 4096 })).rejects.toThrow(/zip bomb/)
    })

    it('holds the whole archive to a total, whatever the directory claims', async () => {
        const zip = await lyingZip(4_000_000, 64)

        await expect(
            readArchive(zip, () => true, { maxTotalSize: 4096, maxEntrySize: 4096 })
        ).rejects.toThrow(/RangeError|zip bomb|unpacks past/)
    })
})

describe('an XML document that attacks the reader', () => {
    it('refuses a declared entity instead of expanding it', () => {
        const billionLaughs =
            '<!DOCTYPE lolz [<!ENTITY lol "lol"><!ENTITY lol2 "&lol;&lol;&lol;">]><row/>'
        expect(() => readSheet(billionLaughs, [])).toThrow(/DOCTYPE/)
        expect(() => readSharedStrings(billionLaughs)).toThrow(/DOCTYPE/)
    })

    it('leaves a character reference past the end of Unicode as text', () => {
        expect(unescapeXml('&#x110000;')).toBe('&#x110000;')
    })

    it('refuses a worksheet with more rows than it reads', () => {
        const many = '<row><c t="inlineStr"><is><t>x</t></is></c></row>'.repeat(200)
        expect(() => readSheet(many, [], { maxRows: 50 })).toThrow(/more than 50 rows/)
    })

    it('does not fall into a hole on tags that never close', () => {
        const nasty = `<row>${'<c r="A1">'.repeat(4000)}</row>`
        const started = performance.now()
        readSheet(nasty, [])
        expect(performance.now() - started).toBeLessThan(2000)
    })
})

describe('a delimited file that attacks the reader', () => {
    it('refuses more rows than it reads', () => {
        expect(() => parseDelimited('a\n'.repeat(500), { maxRows: 50 })).toThrow(/more than 50/)
    })

    it('refuses more cells than it reads', () => {
        expect(() => parseDelimited('a,b,c,d\n'.repeat(50), { maxCells: 20 })).toThrow(/cells/)
    })
})

interface Row {
    id: number
    note: string
}

describe('what a file is allowed to become', () => {
    const columns: ColumnDef<Row>[] = [{ id: 'note', header: 'Note' }]

    function makeGrid() {
        return createDataGrid<Row>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            features: [
                dataImport<Row>({ onCommit: () => {}, newRow: (index) => ({ id: index + 1 }) })
            ]
        })
    }

    it('refuses a file too big to open, by name, before reading a byte', async () => {
        const importing = getDataImport(makeGrid())!
        const huge = new File(['x'], 'huge.csv')
        Object.defineProperty(huge, 'size', { value: 40 * 1024 * 1024 })

        await importing.take(huge)

        expect(importing.error).toContain('huge.csv')
        expect(importing.step).toBe('idle')
    })

    it('keeps a formula as the text it is, and never runs it', async () => {
        const grid = makeGrid()
        const importing = getDataImport(grid)!

        await importing.takeText('Note\n"=cmd|\'/c calc\'!A1"\n"@SUM(1)"\n"+1+1"')
        await importing.review()

        expect(importing.staged.map((row) => row.note)).toEqual([
            "=cmd|'/c calc'!A1",
            '@SUM(1)',
            '+1+1'
        ])
        expect(importing.problems).toEqual([])
    })
})
