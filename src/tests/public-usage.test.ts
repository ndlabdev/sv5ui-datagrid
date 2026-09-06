import { createDataGrid, type ColumnDef } from '$lib/index.js'
import { describe, expect, it } from 'vitest'
import {
    aggregate,
    commandPalette,
    conditionalFormatting,
    formula,
    FormulaError,
    FUNCTION_NAMES,
    getCommandPalette,
    isDataRow,
    isDetailNode,
    isFormulaError,
    isLoadingRow,
    localStorageViews,
    masterDetail,
    savedViews,
    ShareTooLongError,
    totalsKindOf,
    type Aggregation,
    type FormulaValue,
    type SavedViewStorage
} from '$lib/index.js'
import {
    BUILT_IN_STYLES,
    buildGridXlsx,
    cellRef,
    columnLetter,
    createWorkbook,
    createWorkbookAsync,
    DEFAULT_FORMAT_COLORS,
    StyleTable,
    toSerialDate,
    XLSX_MIME,
    type CellValue,
    type SheetColumn,
    type WorkbookOptions,
    type XlsxStyle
} from '$lib/xlsx.js'

interface Sale {
    id: number
    region: string
    amount: number
}

const sales: Sale[] = [
    { id: 1, region: 'North', amount: 100 },
    { id: 2, region: 'South', amount: 400 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region', header: 'Region' },
    { id: 'amount', header: 'Amount' }
]

const text = (bytes: Uint8Array) => new TextDecoder().decode(bytes)

describe('what the published surface is enough to do', () => {
    it('builds a workbook of several sheets by hand', () => {
        const styles = new StyleTable()
        const header = styles.add(BUILT_IN_STYLES.header)
        const money: XlsxStyle = { ...BUILT_IN_STYLES.currency, font: { bold: true } }

        const sheet = (name: string, rows: CellValue[][]): WorkbookOptions => ({
            sheetName: name,
            columns: [
                { header: 'Region', width: 20 },
                { header: 'Amount', width: 14, style: styles.add(money) }
            ] satisfies SheetColumn[],
            rows,
            headerStyle: header,
            styles
        })

        const bytes = createWorkbook([
            sheet('Sales', [['North', 100]]),
            sheet('Returns', [['South', -20]])
        ])

        expect(text(bytes)).toContain('sheet2.xml')
        expect(XLSX_MIME).toContain('spreadsheetml')
    })

    it('compresses that workbook the way a grid export does', async () => {
        const styles = new StyleTable()
        const options: WorkbookOptions = {
            sheetName: 'Sales',
            columns: [{ header: 'Region' }],
            rows: Array.from({ length: 500 }, () => ['North']),
            styles
        }

        const stored = createWorkbook(options)
        const deflated = await createWorkbookAsync(options)

        expect(deflated.byteLength).toBeLessThan(stored.byteLength)
    })

    it('styles a grid export through the callbacks the options declare', () => {
        const grid = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            features: [
                conditionalFormatting<Sale>({ rules: [{ kind: 'dataBar', column: 'amount' }] })
            ]
        })
        void grid.preWindowNodes

        const bytes = buildGridXlsx(grid, {
            headerStyle: { font: { bold: true, color: '#FFFFFF' }, fill: '#1F2937' },
            columnStyle: (column) =>
                column.id === 'amount' ? BUILT_IN_STYLES.currency : undefined,
            cellStyle: (value) => (Number(value) < 0 ? { font: { color: '#B00020' } } : undefined),
            conditionalFormatting: { ...DEFAULT_FORMAT_COLORS, bar: '#112233' }
        })

        expect(text(bytes)).toContain('<color rgb="FF112233"/>')
    })

    it('addresses a cell and a date the way the writer does', () => {
        expect(cellRef(0, 3)).toBe('D1')
        expect(columnLetter(26)).toBe('AA')
        expect(toSerialDate(new Date(2026, 0, 1))).toBeGreaterThan(45_000)
    })

    it('tells the row kinds apart without reaching inside the package', () => {
        const grid = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id)
        })

        const node = grid.preWindowNodes[0]!
        expect(isDataRow(node)).toBe(true)
        expect(isLoadingRow(node.row)).toBe(false)
        expect(totalsKindOf(node.id)).toBeNull()
    })
})

describe('the jobs the docs describe, done from outside the package', () => {
    const grid = () =>
        createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id)
        })

    it('takes a label override per grid, and leaves the next grid alone', () => {
        // It used to be one global table with a reset. A grid carries its own
        // wording now, so two grids on a page can disagree and neither has to
        // put anything back.
        const renamed = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            labels: { groupBy: 'Split by' }
        })

        expect(renamed.labels.groupBy).toBe('Split by')
        expect(grid().labels.groupBy).toBe('Group by')
    })

    it('wraps the storage adapter the feature uses by default', () => {
        const written: string[] = []
        const auditing: SavedViewStorage = {
            read: (key) => localStorageViews.read(key),
            write: (key, views) => {
                written.push(key)
                localStorageViews.write(key, views)
            }
        }

        const built = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            features: [savedViews({ storage: auditing, key: 'public-usage' })]
        })
        built.api.saveView?.('Mine')

        expect(written).toEqual(['public-usage'])
    })

    it('reuses a built-in aggregation inside a custom one', () => {
        const half: Aggregation<Sale> = (values, rows) =>
            Number(aggregate<Sale>('sum', values, rows)) / 2

        expect(aggregate<Sale>('sum', [100, 400], sales)).toBe(500)
        expect(half([100, 400], sales)).toBe(250)
    })

    it('lists the functions a formula editor can offer, as a user writes them', () => {
        expect(FUNCTION_NAMES).toContain('IF')
        expect(FUNCTION_NAMES).toContain('SUM')
        expect(FUNCTION_NAMES.every((name) => name === name.toUpperCase())).toBe(true)
        expect(FUNCTION_NAMES.length).toBeGreaterThan(10)
    })

    it('reads an error out of a formula column rather than guessing at it', () => {
        const built = createDataGrid<Sale>({
            columns: [...columns, { id: 'ratio', header: 'Ratio' }],
            data: sales,
            getRowId: (row) => String(row.id),
            features: [formula<Sale>({ columns: { ratio: 'amount / 0' } })]
        })

        const value = (built.preWindowNodes[0]!.row as unknown as Record<string, unknown>).ratio
        expect(isFormulaError(value)).toBe(false)
        expect(value).toBe('#DIV/0')

        const raw: FormulaValue = new FormulaError('#DIV/0', 'divided by zero')
        expect(isFormulaError(raw)).toBe(true)
    })

    it('tells a detail row apart from the row it hangs under', () => {
        const built = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            features: [masterDetail<Sale>()]
        })
        built.expansion.expand('1')

        const detail = built.nodes.find((node) => isDetailNode(node.id))
        expect(detail).toBeDefined()
        expect(isDataRow(detail!)).toBe(false)
    })

    it('catches the error a share link throws when the state is too big', () => {
        const thrown = new ShareTooLongError(9001)

        try {
            throw thrown
        } catch (error) {
            expect(error instanceof ShareTooLongError).toBe(true)
            expect((error as ShareTooLongError).length).toBe(9001)
        }
    })

    it('adds a command of its own to the palette', () => {
        const built = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            features: [
                commandPalette<Sale>({
                    commands: () => [
                        { id: 'app:refresh', label: 'Refresh from the server', run: () => {} }
                    ]
                })
            ]
        })

        const palette = getCommandPalette(built)!
        expect(palette.commands.map((command) => command.id)).toContain('app:refresh')
    })

    it('keeps the row helpers usable on a plain grid', () => {
        const node = grid().preWindowNodes[0]!

        expect(isDataRow(node)).toBe(true)
        expect(isLoadingRow(node.row)).toBe(false)
        expect(totalsKindOf(node.id)).toBeNull()
    })
})
