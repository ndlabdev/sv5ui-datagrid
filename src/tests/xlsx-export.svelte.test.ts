import {
    createDataGrid,
    filtering,
    selection,
    sorting,
    type ColumnDef,
    type GridState
} from '$lib/index.js'
import { describe, expect, it, vi } from 'vitest'
import { buildGridXlsx, downloadGridXlsx } from '../lib/features/xlsx/export.js'
import { toSerialDate } from '../lib/features/xlsx/sheet.js'
import { XLSX_MIME } from '../lib/features/xlsx/workbook.js'

interface Order {
    id: number
    customer: string
    total: number
    placedAt: string
    active: boolean
}

const orders: Order[] = [
    { id: 1, customer: 'Alice', total: 1200.5, placedAt: '2026-01-15T00:00:00Z', active: true },
    { id: 2, customer: 'Bob & Co', total: 950, placedAt: '2025-12-31T00:00:00Z', active: false },
    { id: 3, customer: 'Charlie', total: 300, placedAt: '2026-02-01T00:00:00Z', active: true }
]

const columns: ColumnDef<Order>[] = [
    { id: 'customer', header: 'Customer', width: 200, filter: 'text' },
    { id: 'total', header: 'Total', type: 'currency', width: 140, sortable: true },
    { id: 'placedAt', header: 'Placed', type: 'date', width: 140 },
    { id: 'active', header: 'Active', type: 'boolean', width: 100 }
]

function makeGrid(extra: Parameters<typeof createDataGrid<Order>>[0]['features'] = []) {
    return createDataGrid<Order>({
        columns,
        data: orders,
        getRowId: (order) => String(order.id),
        features: [sorting(), filtering(), ...(extra ?? [])]
    })
}

function partOf(bytes: Uint8Array, path: string): string {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    const decoder = new TextDecoder()

    let end = bytes.length - 22
    while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end--
    const count = view.getUint16(end + 10, true)
    let offset = view.getUint32(end + 16, true)

    for (let i = 0; i < count; i++) {
        const size = view.getUint32(offset + 24, true)
        const nameLength = view.getUint16(offset + 28, true)
        const localOffset = view.getUint32(offset + 42, true)
        const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))

        if (name === path) {
            const localNameLength = view.getUint16(localOffset + 26, true)
            const extra = view.getUint16(localOffset + 28, true)
            const start = localOffset + 30 + localNameLength + extra
            return decoder.decode(bytes.subarray(start, start + size))
        }
        offset += 46 + nameLength
    }
    throw new Error(`${path} missing from the archive`)
}

const sheetOf = (grid: GridState<Order>, options = {}) =>
    partOf(buildGridXlsx(grid, options), 'xl/worksheets/sheet1.xml')

describe('exporting a grid', () => {
    it('writes the visible columns as the header row', () => {
        const sheet = sheetOf(makeGrid())
        expect(sheet).toContain('Customer')
        expect(sheet).toContain('Total')
        expect(sheet).toContain('Placed')
    })

    it('writes numbers as numbers, not as formatted text', () => {
        expect(sheetOf(makeGrid())).toContain('<v>1200.5</v>')
    })

    it('turns an ISO date column into an Excel serial so it sorts as a date', () => {
        const local = new Date('2026-01-15T00:00:00Z')
        const expected = toSerialDate(
            new Date(local.getFullYear(), local.getMonth(), local.getDate())
        )
        const sheet = sheetOf(makeGrid())

        expect(sheet).toContain(`<v>${expected}</v>`)
        expect(sheet).not.toContain('2026-01-15T00:00:00Z')
    })

    it('writes a date column as a whole serial so it compares equal to DATE()', () => {
        const sheet = sheetOf(makeGrid())
        const serials = [...sheet.matchAll(/<c r="C\d+" s="2"><v>([\d.]+)<\/v>/g)].map((match) =>
            Number(match[1])
        )

        expect(serials).toHaveLength(3)
        expect(serials.every(Number.isInteger)).toBe(true)
    })

    it('carries booleans as booleans', () => {
        expect(sheetOf(makeGrid())).toContain('t="b"><v>1</v>')
    })

    it('gives a currency column a currency number format', () => {
        const bytes = buildGridXlsx(makeGrid())
        const sheet = partOf(bytes, 'xl/worksheets/sheet1.xml')
        const styles = partOf(bytes, 'xl/styles.xml')

        const id = Number(/<c r="B2" s="(\d+)"/.exec(sheet)?.[1])
        const records = [...styles.matchAll(/<xf [^>]*?(?:\/>|>.*?<\/xf>)/g)].map((m) => m[0])
        const cellXfs = records.slice(
            records.length - Number(/<cellXfs count="(\d+)"/.exec(styles)![1])
        )
        expect(cellXfs[id]).toContain('numFmtId="4"')
    })

    it('escapes a value that would otherwise break the XML', () => {
        expect(sheetOf(makeGrid())).toContain('Bob &amp; Co')
    })

    it('exports what the pipeline produced, so a filter narrows the file', () => {
        const grid = makeGrid()
        ;(grid.api.setQuickFilter as (query: string) => void)('Charlie')

        const sheet = sheetOf(grid)
        expect(sheet).toContain('Charlie')
        expect(sheet).not.toContain('Alice')
    })

    it('follows the sort order rather than the source order', () => {
        const grid = makeGrid()
        ;(grid.api.setSort as (sort: { columnId: string; direction: 'asc' | 'desc' }[]) => void)([
            { columnId: 'total', direction: 'asc' }
        ])

        const sheet = sheetOf(grid)
        expect(sheet.indexOf('Charlie')).toBeLessThan(sheet.indexOf('Alice'))
    })

    it('takes only the columns asked for, in that order', () => {
        const sheet = sheetOf(makeGrid(), { columnIds: ['total', 'customer'] })
        expect(sheet.indexOf('Total')).toBeLessThan(sheet.indexOf('Customer'))
        expect(sheet).not.toContain('Placed')
    })

    it('lets a caller override a cell value', () => {
        const sheet = sheetOf(makeGrid(), {
            value: (row: Order, column: { id: string }) =>
                column.id === 'customer' ? row.customer.toUpperCase() : undefined
        })
        expect(sheet).toContain('ALICE')
    })

    it('exports only the selected rows when asked', () => {
        const grid = makeGrid([selection()])
        ;(grid.api.selectRow as (id: string) => void)('3')

        const sheet = sheetOf(grid, { selectedOnly: true })
        expect(sheet).toContain('Charlie')
        expect(sheet).not.toContain('Alice')
    })

    it('leaves the checkbox column out of the file', () => {
        const grid = makeGrid([selection()])
        expect(sheetOf(grid)).not.toContain('__dg-select__')
    })
})

describe('downloading', () => {
    it('hands the browser a blob of the right type and file name', async () => {
        const clicks: HTMLAnchorElement[] = []
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
            this: HTMLAnchorElement
        ) {
            clicks.push(this)
        })
        const createUrl = vi.spyOn(URL, 'createObjectURL')
        const revoke = vi.spyOn(URL, 'revokeObjectURL')

        await downloadGridXlsx(makeGrid(), { filename: 'orders' })

        expect(clicks[0]!.download).toBe('orders.xlsx')
        const blob = createUrl!.mock.calls[0]![0] as Blob
        expect(blob.type).toBe(XLSX_MIME)

        expect(revoke).not.toHaveBeenCalled()
        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(revoke).toHaveBeenCalled()

        const head = new Uint8Array(await blob.arrayBuffer())
        expect([...head.slice(0, 2)]).toEqual([0x50, 0x4b])
        expect(blob.size).toBeGreaterThan(0)

        click.mockRestore()
        createUrl.mockRestore()
        revoke.mockRestore()
    })

    it('does not double up the extension', async () => {
        const clicks: string[] = []
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
            this: HTMLAnchorElement
        ) {
            clicks.push(this.download)
        })

        await downloadGridXlsx(makeGrid(), { filename: 'report.xlsx' })
        expect(clicks[0]).toBe('report.xlsx')
        click.mockRestore()
    })
})
