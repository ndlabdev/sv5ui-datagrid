import { createDataGrid } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { pagination } from '../../features/pagination/index.js'
import { describe, expect, it } from 'vitest'
import { conditionalFormatting, type FormatRule } from '../conditional-formatting/index.js'
import { formula } from '../formula/index.js'
import { grouping } from '../grouping/index.js'
import { masterDetail } from '../master-detail/index.js'
import { serverRowModel } from '../server-row-model/index.js'
import { tree } from '../tree/index.js'
import { buildGridXlsx, buildGridXlsxAsync } from './index.js'

interface Person {
    id: number
    dept: string
    salary: number
}

const people: Person[] = [
    { id: 1, dept: 'Core', salary: 100 },
    { id: 2, dept: 'Core', salary: 200 },
    { id: 3, dept: 'Data', salary: 300 }
]

const columns: ColumnDef<Person>[] = [
    { id: 'dept', header: 'Dept' },
    { id: 'salary', header: 'Salary' }
]

const sheetOf = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

const rowCount = (bytes: Uint8Array) => (sheetOf(bytes).match(/<row r=/g) ?? []).length

function numbersIn(bytes: Uint8Array): number[] {
    return [...sheetOf(bytes).matchAll(/<v>(-?[\d.]+)<\/v>/g)].map((match) => Number(match[1]))
}

describe('an export carries data rows and nothing else', () => {
    function groupedGrid(extra: { groupFooters?: boolean; grandTotal?: boolean } = {}) {
        return createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (row) => String(row.id),
            features: [
                grouping<Person>({
                    by: ['dept'],
                    aggregations: { salary: 'sum' },
                    ...extra
                })
            ]
        })
    }

    it('leaves group header rows out of the file', () => {
        const grid = groupedGrid()
        expect(grid.nodes.length).toBeGreaterThan(people.length)

        expect(rowCount(buildGridXlsx(grid))).toBe(people.length + 1)
    })

    it('leaves footers and the grand total out too', () => {
        const grid = groupedGrid({ groupFooters: true, grandTotal: true })
        expect(grid.nodes.length).toBe(8)

        const bytes = buildGridXlsx(grid)
        expect(rowCount(bytes)).toBe(people.length + 1)
        expect(numbersIn(bytes)).toEqual([100, 200, 300])
    })

    it('adds up in a spreadsheet to what the data adds up to', () => {
        const grid = groupedGrid({ groupFooters: true, grandTotal: true })
        const total = numbersIn(buildGridXlsx(grid)).reduce((sum, value) => sum + value, 0)

        expect(total).toBe(600)
    })

    it('writes the grouped column as its value, not as a group label', () => {
        const bytes = buildGridXlsx(groupedGrid())
        const text = sheetOf(bytes)

        expect(text).not.toContain('Core (2)')
        expect(text).not.toContain('Total')
        expect(text).toContain('Core')
    })

    it('carries the children of a nested tree, which the file used to lose', () => {
        interface Node {
            id: number
            dept: string
            salary: number
            reports?: Node[]
        }
        const nested: Node[] = [
            { id: 1, dept: 'Core', salary: 100, reports: [{ id: 2, dept: 'Core', salary: 250 }] }
        ]
        const grid = createDataGrid<Node>({
            columns: columns as unknown as ColumnDef<Node>[],
            data: nested,
            getRowId: (row) => String(row.id),
            features: [tree<Node>({ getChildren: (row) => row.reports, defaultExpandedDepth: 2 })]
        })
        expect(grid.nodes.length).toBe(2)

        const bytes = buildGridXlsx(grid)
        expect(rowCount(bytes)).toBe(3)
        expect(numbersIn(bytes)).toEqual([100, 250])
    })

    it('still leaves a detail panel out, as it always did', () => {
        const grid = createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (row) => String(row.id),
            features: [masterDetail<Person>()]
        })
        grid.expansion.expand('1')
        expect(grid.nodes.length).toBe(people.length + 1)

        expect(rowCount(buildGridXlsx(grid))).toBe(people.length + 1)
    })
})

describe('an export carries the conditional formatting as Excel rules', () => {
    function formattedGrid(rules: FormatRule[]) {
        const grid = createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (row) => String(row.id),
            features: [conditionalFormatting<Person>({ rules })]
        })
        void grid.preWindowNodes
        return grid
    }

    it('writes the rule against the column it names, over the rows it wrote', () => {
        const bytes = buildGridXlsx(
            formattedGrid([{ kind: 'colorScale', column: 'salary', from: '#fff', to: '#0a7' }])
        )
        const sheet = sheetOf(bytes)

        expect(sheet).toContain('<conditionalFormatting sqref="B2:B4">')
        expect(sheet).toContain('<color rgb="FF00AA77"/>')
    })

    it('puts the rules after the autofilter, where the schema wants them', () => {
        const sheet = sheetOf(buildGridXlsx(formattedGrid([{ kind: 'dataBar', column: 'salary' }])))

        expect(sheet.indexOf('<conditionalFormatting')).toBeGreaterThan(
            sheet.indexOf('<autoFilter')
        )
        expect(sheet.indexOf('<conditionalFormatting')).toBeLessThan(sheet.indexOf('</worksheet>'))
    })

    it('carries the differential format a highlight rule points at', () => {
        const bytes = buildGridXlsx(formattedGrid([{ kind: 'duplicates', column: 'dept' }]))

        expect(sheetOf(bytes)).toContain('dxfId="0"')
        expect(sheetOf(bytes)).toContain('<dxfs count="1">')
    })

    it('covers the rows a server export fetched, not the page on screen', async () => {
        const TOTAL = 25
        const grid = createDataGrid<Person>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                pagination({ pageSize: 10 }),
                serverRowModel<Person>({
                    getRows: async ({ startRow, endRow }) => ({
                        rows: Array.from(
                            { length: Math.max(0, Math.min(endRow, TOTAL) - startRow) },
                            (_, i) => ({ id: startRow + i, dept: 'Core', salary: startRow + i })
                        ),
                        rowCount: TOTAL
                    })
                }),
                conditionalFormatting<Person>({
                    rules: [{ kind: 'colorScale', column: 'salary' }]
                })
            ]
        })
        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await expect.poll(() => grid.data.length).toBe(10)

        const sheet = await inflateSheet(await buildGridXlsxAsync(grid))

        expect(sheet).toContain(`sqref="B2:B${TOTAL + 1}"`)
    })

    it('follows the export order when the caller reorders the columns', () => {
        const bytes = buildGridXlsx(formattedGrid([{ kind: 'dataBar', column: 'salary' }]), {
            columnIds: ['salary', 'dept']
        })

        expect(sheetOf(bytes)).toContain('sqref="A2:A4"')
    })

    it('leaves the file alone when the grid has no rules or the caller says no', () => {
        expect(sheetOf(buildGridXlsx(formattedGrid([])))).not.toContain('conditionalFormatting')

        const off = buildGridXlsx(formattedGrid([{ kind: 'dataBar', column: 'salary' }]), {
            conditionalFormatting: false
        })
        expect(sheetOf(off)).not.toContain('conditionalFormatting')
        expect(sheetOf(off)).not.toContain('<dxfs')
    })

    it('takes the colours the caller passes for a rule written in theme tokens', () => {
        const bytes = buildGridXlsx(formattedGrid([{ kind: 'dataBar', column: 'salary' }]), {
            conditionalFormatting: { bar: '#112233' }
        })
        expect(sheetOf(bytes)).toContain('<color rgb="FF112233"/>')
    })
})

describe('a computed column survives the trip through a data source', () => {
    interface Line {
        id: number
        a: number
        b: number
        total?: number
    }

    const TOTAL = 40

    function serverGrid() {
        const grid = createDataGrid<Line>({
            columns: [
                { id: 'a', header: 'A' },
                { id: 'b', header: 'B' },
                { id: 'total', header: 'Total' }
            ],
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                pagination({ pageSize: 10 }),
                serverRowModel<Line>({
                    getRows: async ({ startRow, endRow }) => ({
                        rows: Array.from(
                            { length: Math.max(0, Math.min(endRow, TOTAL) - startRow) },
                            (_, i) => ({ id: startRow + i, a: startRow + i + 1, b: 2 })
                        ),
                        rowCount: TOTAL
                    })
                }),
                formula<Line>({ columns: { total: 'a * b' } })
            ]
        })
        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        return grid
    }

    it('computes the formula over rows the export fetched itself', async () => {
        const grid = serverGrid()
        await expect.poll(() => grid.data.length).toBe(10)

        const rows = await pipeRows(grid)
        expect(rows).toHaveLength(TOTAL)
        expect(rows.every((row) => row.total === row.a * row.b)).toBe(true)
    })

    it('writes those values into the file rather than leaving the column blank', async () => {
        const grid = serverGrid()
        await expect.poll(() => grid.data.length).toBe(10)

        const bytes = await buildGridXlsxAsync(grid)
        const sheet = await inflateSheet(bytes)

        expect((sheet.match(/<row r=/g) ?? []).length).toBe(TOTAL + 1)
        expect(sheet).not.toMatch(/<c r="C\d+"\/>/)
        expect(sheet).toContain('<c r="C2"><v>2</v></c>')
        expect(sheet).toContain(`<c r="C${TOTAL + 1}"><v>${TOTAL * 2}</v></c>`)
    })

    async function pipeRows(grid: ReturnType<typeof serverGrid>) {
        const server = grid.feature<{ fetchAll: (o: object) => Promise<Line[]> }>('serverRowModel')!
        const computed = grid.feature<{
            apply: (nodes: { id: string; row: Line; index: number }[]) => {
                row: Line
            }[]
        }>('formula')!

        const fetched = await server.fetchAll({})
        return computed
            .apply(fetched.map((row, index) => ({ id: String(row.id), row, index })))
            .map((node) => node.row)
    }
})

async function inflateSheet(bytes: Uint8Array): Promise<string> {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    let end = bytes.length - 22
    while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--

    const count = view.getUint16(end + 10, true)
    let offset = view.getUint32(end + 16, true)
    const decoder = new TextDecoder()

    for (let i = 0; i < count; i++) {
        const compressed = view.getUint32(offset + 20, true)
        const nameLength = view.getUint16(offset + 28, true)
        const localOffset = view.getUint32(offset + 42, true)
        const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))

        if (name.includes('worksheets/sheet1')) {
            const localNameLength = view.getUint16(localOffset + 26, true)
            const extra = view.getUint16(localOffset + 28, true)
            const start = localOffset + 30 + localNameLength + extra
            const body = bytes.subarray(start, start + compressed)

            const stream = new Blob([body as BlobPart])
                .stream()
                .pipeThrough(new DecompressionStream('deflate-raw'))
            return decoder.decode(await new Response(stream).arrayBuffer())
        }
        offset += 46 + nameLength
    }
    throw new Error('no worksheet in the archive')
}
