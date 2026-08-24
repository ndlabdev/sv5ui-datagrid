import { describe, expect, it } from 'vitest'
import { createDataGrid } from './grid.svelte.js'
import { buildRowNodes } from './row-node.js'
import { composeReaders, readCell, readerToken } from './value-gate.js'
import type { CellValueScope, ColumnDef, GridFeature } from '../types/index.js'

interface Row {
    id: number
    name: string
}

const columns: ColumnDef<Row>[] = [{ id: 'name', header: 'Name' }]
const nodes = buildRowNodes([{ id: 1, name: 'Ada' }], (row) => String(row.id))
const node = nodes[0]!

function scope(): CellValueScope<Row> {
    const grid = createDataGrid<Row>({ columns, data: [], getRowId: (row) => String(row.id) })
    return { grid, column: grid.columns.get('name')!, purpose: 'render' }
}

describe('readCell', () => {
    it('reads the value straight through without a reader', () => {
        expect(readCell(node, columns[0]!)).toBe('Ada')
    })

    it('hands the reader the value and the node it came from', () => {
        const seen: unknown[] = []
        const value = readCell(node, columns[0]!, (raw, from) => {
            seen.push(raw, from.id)
            return 'hidden'
        })
        expect(value).toBe('hidden')
        expect(seen).toEqual(['Ada', '1'])
    })
})

describe('composeReaders', () => {
    const gate = (id: string, fn: (value: unknown) => unknown): GridFeature<Row> => ({
        id,
        cellValue: () => (value) => fn(value)
    })

    it('is undefined when no feature stands in front of the column', () => {
        expect(composeReaders([{ id: 'plain' }], scope())).toBeUndefined()
    })

    it('runs the gates in feature order, each seeing the last one output', () => {
        const composed = composeReaders(
            [
                gate('first', (value) => `${String(value)}-1`),
                gate('second', (value) => `${String(value)}-2`)
            ],
            scope()
        )
        expect(composed?.('x', node)).toBe('x-1-2')
    })

    it('skips a feature that returns no reader for this column', () => {
        const absent: GridFeature<Row> = { id: 'absent', cellValue: () => undefined }
        const composed = composeReaders([absent, gate('only', () => 'mask')], scope())
        expect(composed?.('x', node)).toBe('mask')
    })
})

describe('readerToken', () => {
    it('gives one reader one token, and two readers two', () => {
        const a = () => 'a'
        const b = () => 'b'
        expect(readerToken(a)).toBe(readerToken(a))
        expect(readerToken(a)).not.toBe(readerToken(b))
    })

    it('marks the absence of a reader, so an ungated column keys apart', () => {
        expect(readerToken(undefined)).toBe('-')
        expect(readerToken(() => 'x')).not.toBe('-')
    })
})
