import { describe, expect, it } from 'vitest'
import { createDataGrid } from '../grid/grid.svelte.js'
import type { ColumnDef, RowNode } from '../types/index.js'
import { rowColSpans } from './col-span.js'

interface Row {
    id: number
    kind: string
}

function make(columns: ColumnDef<Row>[], row: Row) {
    const grid = createDataGrid<Row>({
        columns,
        data: [row],
        getRowId: (r) => String(r.id)
    })
    const node = grid.nodes[0] as RowNode<Row>
    return rowColSpans(grid, node, 0)
}

const plain: ColumnDef<Row>[] = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

describe('rowColSpans', () => {
    it('is the identity when no column spans', () => {
        const spans = make(plain, { id: 1, kind: 'x' })
        expect(spans.owner).toEqual([0, 1, 2, 3])
        expect(spans.span).toEqual([1, 1, 1, 1])
    })

    it('marks the covered columns of a span', () => {
        const columns: ColumnDef<Row>[] = [
            { id: 'a', colSpan: () => 3 },
            { id: 'b' },
            { id: 'c' },
            { id: 'd' }
        ]
        const spans = make(columns, { id: 1, kind: 'x' })
        expect(spans.owner).toEqual([0, 0, 0, 3])
        expect(spans.span).toEqual([3, 1, 1, 1])
    })

    it('spans per row data, not blanket', () => {
        const columns: ColumnDef<Row>[] = [
            { id: 'a', colSpan: (ctx) => (ctx.row.kind === 'wide' ? 2 : 1) },
            { id: 'b' },
            { id: 'c' },
            { id: 'd' }
        ]
        expect(make(columns, { id: 1, kind: 'wide' }).span[0]).toBe(2)
        expect(make(columns, { id: 2, kind: 'narrow' }).span[0]).toBe(1)
    })

    it('clamps a span to the last column', () => {
        const columns: ColumnDef<Row>[] = [
            { id: 'a' },
            { id: 'b' },
            { id: 'c', colSpan: () => 10 },
            { id: 'd' }
        ]
        const spans = make(columns, { id: 1, kind: 'x' })
        expect(spans.span[2]).toBe(2)
        expect(spans.owner).toEqual([0, 1, 2, 2])
    })

    it('never spans across a pin boundary', () => {
        const columns: ColumnDef<Row>[] = [
            { id: 'a', pinned: 'left', colSpan: () => 4 },
            { id: 'b' },
            { id: 'c' },
            { id: 'd', pinned: 'right' }
        ]
        // 'a' is pinned left; the span stops before the unpinned columns.
        const spans = make(columns, { id: 1, kind: 'x' })
        expect(spans.span[0]).toBe(1)
        expect(spans.owner).toEqual([0, 1, 2, 3])
    })

    it('treats a span of less than one as a normal cell', () => {
        const columns: ColumnDef<Row>[] = [
            { id: 'a', colSpan: () => 0 },
            { id: 'b' },
            { id: 'c' },
            { id: 'd' }
        ]
        expect(make(columns, { id: 1, kind: 'x' }).span[0]).toBe(1)
    })
})
