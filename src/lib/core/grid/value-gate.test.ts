import { describe, expect, it } from 'vitest'
import { createDataGrid } from './grid.svelte.js'
import { buildRowNodes } from './row-node.js'
import { composeReaders, gateReader, readCell, readerToken } from './value-gate.js'
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

describe('gateReader', () => {
    interface Wide {
        id: number
        a: number
        b: string
        c: number
    }

    function wideGrid(feature: GridFeature<Wide>) {
        return createDataGrid<Wide>({
            data: Array.from({ length: 5000 }, (_, i) => ({ id: i, a: i, b: 'x', c: -i })),
            columns: [{ id: 'a' }, { id: 'b' }, { id: 'c' }],
            getRowId: (row) => String(row.id),
            features: [feature]
        })
    }

    it('composes once per column however many cells the pass reads', () => {
        // The whole reason the helper hands back a closure. Composing asks
        // every gate for a reader, and asking per cell is what this stops:
        // 15,000 compositions for the same 15,000 reads before the cache.
        let composed = 0
        const grid = wideGrid({
            id: 'counter',
            cellValue: () => {
                composed++
                return (value) => value
            }
        })

        const read = gateReader(grid, 'export')
        for (const node of grid.nodes) for (const def of grid.columns.leafDefs) read(node, def)

        expect(composed).toBe(grid.columns.leafDefs.length)
    })

    it('reads through the gate, not around it', () => {
        const grid = wideGrid({
            id: 'mask',
            cellValue: ({ column }) => (column.id === 'b' ? () => 'hidden' : undefined)
        })
        const read = gateReader(grid, 'export')
        const [first] = grid.nodes

        expect(read(first!, { id: 'b' })).toBe('hidden')
        expect(read(first!, { id: 'a' })).toBe(0)
    })

    it('falls through to the raw value for a column the grid does not know', () => {
        const grid = wideGrid({ id: 'none' })
        const read = gateReader(grid, 'export')
        const [first] = grid.nodes

        // A def a feature made up itself still reads rather than answering
        // undefined, and the miss is cached like any other lookup.
        expect(read(first!, { id: 'c' })).toBe(-0)
        expect(read(first!, { id: 'nope' })).toBeUndefined()
    })
})
