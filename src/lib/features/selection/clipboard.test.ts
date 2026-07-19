import { describe, expect, it } from 'vitest'
import { createColumnState } from '../../core/column-sizing.js'
import { buildRowNodes } from '../../core/row-node.js'
import { SELECTION_COLUMN_ID, type ColumnDef } from '../../core/types.js'
import { rowsToMatrix, toCsv, toTsv, withHeaderRow } from './clipboard.js'

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
})
