import { createDataGrid, rawRead, type GridState } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { describe, expect, it } from 'vitest'
import { findMatches, replaceIn } from './find.js'

interface Row {
    id: number
    name: string
    city: string
    n: number
}

const columns: ColumnDef<Row>[] = [
    { id: 'name', header: 'Name' },
    { id: 'city', header: 'City' },
    { id: 'n', header: 'N' }
]

const data: Row[] = [
    { id: 1, name: 'Anna', city: 'Hà Nội', n: 2026 },
    { id: 2, name: 'anna', city: 'Đà Nẵng', n: 12 },
    { id: 3, name: 'Bình', city: 'Hà Nội', n: 2026 }
]

function grid(): GridState<Row> {
    return createDataGrid<Row>({ columns, data, getRowId: (row) => String(row.id) })
}

function scan(query: string, options = {}) {
    const g = grid()
    return findMatches(g.preWindowNodes, g.columns.visible, query, {
        read: rawRead,
        ...options
    }).map((match) => `${match.row}:${match.col}`)
}

describe('findMatches', () => {
    it('finds nothing for an empty query', () => {
        expect(scan('')).toEqual([])
    })

    it('walks row-major, which is the order Next steps through', () => {
        expect(scan('Hà Nội')).toEqual(['0:1', '2:1'])
    })

    it('ignores case by default and respects it on request', () => {
        expect(scan('anna')).toEqual(['0:0', '1:0'])
        expect(scan('anna', { caseSensitive: true })).toEqual(['1:0'])
    })

    it('matches inside a cell unless asked for the whole one', () => {
        expect(scan('Hà')).toEqual(['0:1', '2:1'])
        expect(scan('Hà', { wholeCell: true })).toEqual([])
        expect(scan('Hà Nội', { wholeCell: true })).toEqual(['0:1', '2:1'])
    })

    it('searches numbers as the text they read as', () => {
        expect(scan('2026')).toEqual(['0:2', '2:2'])

        expect(scan('12')).toEqual(['1:2'])
    })

    it('skips nodes that are not data', () => {
        const g = grid()
        const found = findMatches(g.preWindowNodes, g.columns.visible, 'Hà Nội', {
            read: rawRead,
            isDataNode: (node) => node.id !== '1'
        })
        expect(found.map((match) => match.row)).toEqual([2])
    })

    it('reports the ids an edit needs, not only the coordinates', () => {
        const g = grid()
        expect(
            findMatches(g.preWindowNodes, g.columns.visible, 'Bình', { read: rawRead })[0]
        ).toMatchObject({
            rowId: '3',
            columnId: 'name'
        })
    })
})

describe('replaceIn', () => {
    it('returns null when there is nothing to change', () => {
        expect(replaceIn('Anna', 'zz', 'x')).toBeNull()
        expect(replaceIn('Anna', '', 'x')).toBeNull()
    })

    it('rewrites every occurrence in the cell', () => {
        expect(replaceIn('a-a-a', 'a', 'b')).toBe('b-b-b')
    })

    it('rewrites case-insensitively while keeping the rest of the text', () => {
        expect(replaceIn('Anna and ANNA', 'anna', 'Bình')).toBe('Bình and Bình')
    })

    it('honours case sensitivity', () => {
        expect(replaceIn('Anna and anna', 'anna', 'x', { caseSensitive: true })).toBe('Anna and x')
    })

    it('replaces the whole cell or nothing at all', () => {
        expect(replaceIn('Hà Nội', 'Hà', 'X', { wholeCell: true })).toBeNull()
        expect(replaceIn('Hà Nội', 'hà nội', 'X', { wholeCell: true })).toBe('X')
    })

    it('treats the query as text, not as a pattern', () => {
        expect(replaceIn('a.b.c', '.', '-')).toBe('a-b-c')
        expect(replaceIn('cost (net)', '(net)', '(gross)')).toBe('cost (gross)')
    })

    it('rewrites inside a number, which is what Replace is opened for', () => {
        expect(replaceIn(2026, '2026', '2027')).toBe('2027')
    })

    it('handles a blank cell without inventing text', () => {
        expect(replaceIn(null, 'a', 'b')).toBeNull()
        expect(replaceIn(undefined, 'a', 'b')).toBeNull()
    })
})

describe('replacing without regard to case', () => {
    it('does not drift on a character that changes length when lowercased', () => {
        expect(replaceIn('\u0130stanbul office', 'office', 'branch')).toBe('\u0130stanbul branch')
    })

    it('treats the query as text, not as a pattern', () => {
        expect(replaceIn('a.b.c', '.', '-')).toBe('a-b-c')
    })

    it('leaves a dollar sign in the replacement alone', () => {
        expect(replaceIn('cost: x', 'x', '$&5')).toBe('cost: $&5')
    })
})
