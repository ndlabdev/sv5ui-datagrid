import { describe, expect, it } from 'vitest'
import { createColumnState } from '../../core/columns/column-sizing.js'
import { buildRowNodes } from '../../core/grid/row-node.js'
import { SELECTION_COLUMN_ID, type ColumnDef, type ColumnState } from '../../core/types/index.js'
import { pickColumns, rowsToMatrix, toCsv, toTsv, withHeaderRow } from './clipboard.js'

interface Row {
    name: string
    note: string | null
    score: number
}

const defs: ColumnDef<Row>[] = [
    { id: SELECTION_COLUMN_ID, header: '' },
    { id: 'name', header: 'Name' },
    { id: 'note', header: 'Note' },
    { id: 'score', header: 'Score', accessor: (row) => row.score * 2 }
]
const columns = defs.map((def) => createColumnState(def))

const nodes = buildRowNodes<Row>(
    [
        { name: 'Alice', note: 'plain', score: 1 },
        { name: 'Bob "B"', note: 'a,b\nc', score: 2 },
        { name: 'Carol\tTab', note: null, score: 3 }
    ],
    (row) => row.name
)

describe('rowsToMatrix', () => {
    it('resolves accessors, stringifies values, maps null to empty and skips the selection column', () => {
        expect(rowsToMatrix(nodes, columns)).toEqual([
            ['Alice', 'plain', '2'],
            ['Bob "B"', 'a,b\nc', '4'],
            ['Carol\tTab', '', '6']
        ])
    })

    it('prepends visible headers via withHeaderRow', () => {
        const matrix = withHeaderRow(rowsToMatrix(nodes, columns), columns)
        expect(matrix[0]).toEqual(['Name', 'Note', 'Score'])
        expect(matrix).toHaveLength(4)
    })
})

describe('toTsv', () => {
    it('joins with tabs and flattens embedded tabs/newlines', () => {
        expect(toTsv(rowsToMatrix(nodes, columns))).toBe(
            'Alice\tplain\t2\nBob "B"\ta,b c\t4\nCarol Tab\t\t6'
        )
    })
})

describe('toCsv', () => {
    it('quotes cells containing commas, quotes or newlines and uses CRLF rows', () => {
        expect(toCsv(rowsToMatrix(nodes, columns))).toBe(
            'Alice,plain,2\r\n"Bob ""B""","a,b\nc",4\r\nCarol\tTab,,6'
        )
    })

    it('neutralizes cells a spreadsheet would run as a formula', () => {
        expect(toCsv([['=1+1', '+A1', '-2', '@SUM(A1)']])).toBe("'=1+1,'+A1,'-2,'@SUM(A1)")
    })

    it('quotes a neutralized cell that also needs escaping', () => {
        expect(toCsv([['=HYPERLINK("http://evil","x")']])).toBe(
            '"\'=HYPERLINK(""http://evil"",""x"")"'
        )
    })

    it('leaves ordinary cells untouched', () => {
        expect(toCsv([['Alice', '2', 'a-b']])).toBe('Alice,2,a-b')
    })

    it('quotes against the delimiter in use, not against the comma', () => {
        // A semicolon file: commas are ordinary text, semicolons are not.
        expect(toCsv([['a,b', 'c;d']], ';')).toBe('a,b;"c;d"')
        expect(toCsv([['a,b', 'c;d']])).toBe('"a,b",c;d')
        expect(toCsv([['x', 'y']], '\t')).toBe('x\ty')
    })
})

describe('pickColumns', () => {
    it('drops the selection column and keeps every other by default', () => {
        expect(pickColumns(columns).map((column) => column.id)).toEqual(['name', 'note', 'score'])
    })

    it('honours the requested order and ignores ids it does not know', () => {
        expect(pickColumns(columns, ['score', 'name', 'ghost']).map((column) => column.id)).toEqual(
            ['score', 'name']
        )
    })

    it('refuses to export the selection checkbox even when named', () => {
        expect(pickColumns(columns, [SELECTION_COLUMN_ID, 'name'])).toHaveLength(1)
    })
})

describe('rowsToMatrix with a formatter', () => {
    it('hands over the value, node and column and takes the text back', () => {
        const matrix = rowsToMatrix(nodes, columns, ({ value, node, column }) =>
            column.id === 'score' ? `${node.row.name}:${value}` : String(value ?? '—')
        )
        expect(matrix[0]).toEqual(['Alice', 'plain', 'Alice:2'])
        expect(matrix[2]).toEqual(['Carol\tTab', '—', 'Carol\tTab:6'])
    })
})

describe('formatted export', () => {
    const typed: ColumnState<Row>[] = [
        createColumnState<Row>({
            id: 'paid',
            type: 'currency',
            typeOptions: { currency: 'USD', locale: 'en-US' }
        }),
        createColumnState<Row>({ id: 'when', type: 'date', typeOptions: { locale: 'en-US' } }),
        createColumnState<Row>({ id: 'done', type: 'boolean' })
    ]
    const typedNodes = buildRowNodes(
        [{ paid: 204000, when: '2026-08-11', done: true }] as unknown as Row[],
        () => '1'
    )

    it('writes the value behind the cell by default, for a spreadsheet', () => {
        expect(rowsToMatrix(typedNodes, typed)).toEqual([['204000', '2026-08-11', 'true']])
    })

    it('writes what the grid shows when asked', () => {
        expect(rowsToMatrix(typedNodes, typed, undefined, { formatted: true })).toEqual([
            ['$204,000.00', 'Aug 11, 2026', 'true']
        ])
    })

    it('lets an explicit formatter win over it', () => {
        const matrix = rowsToMatrix(typedNodes, typed, ({ column }) => `<${column.id}>`, {
            formatted: true
        })
        expect(matrix).toEqual([['<paid>', '<when>', '<done>']])
    })
})
