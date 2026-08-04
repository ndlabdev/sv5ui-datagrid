import { describe, expect, it } from 'vitest'
import { createDataGrid, type GridState } from '../grid/grid.svelte.js'
import type { ColumnDef, RowNode } from '../types/index.js'
import { rowSpansOf } from './row-span.js'

interface Entry {
    id: number
    region: string
    city: string
}

const entries: Entry[] = [
    { id: 1, region: 'APAC', city: 'Hanoi' },
    { id: 2, region: 'APAC', city: 'Tokyo' },
    { id: 3, region: 'APAC', city: 'Seoul' },
    { id: 4, region: 'EMEA', city: 'Berlin' },
    { id: 5, region: 'EMEA', city: 'Paris' }
]

/** How many rows from `index` repeat the region, counted only at a run's head. */
function regionRun(rows: Entry[], index: number): number {
    if (index > 0 && rows[index - 1].region === rows[index].region) return 1
    let n = 1
    while (index + n < rows.length && rows[index + n].region === rows[index].region) n++
    return n
}

function makeGrid(
    rows: Entry[] = entries,
    rowSpan: ColumnDef<Entry>['rowSpan'] = (ctx) => regionRun(rows, ctx.rowIndex)
): GridState<Entry> {
    return createDataGrid<Entry>({
        columns: [
            { id: 'region', header: 'Region', width: 120, rowSpan },
            { id: 'city', header: 'City', flex: 1 }
        ],
        data: rows,
        getRowId: (entry) => String(entry.id)
    })
}

describe('rowSpansOf', () => {
    it('maps every covered row back to the cell that draws it', () => {
        const grid = makeGrid()
        const spans = rowSpansOf(grid, grid.preWindowNodes).get('region')!

        expect(spans.owner).toEqual([0, 0, 0, 3, 3])
        // Only a run's head carries its length; a covered row counts as one.
        expect(spans.span).toEqual([3, 1, 1, 2, 1])
    })

    it('costs nothing when no column asks for it', () => {
        const grid = createDataGrid<Entry>({
            columns: [{ id: 'region' }, { id: 'city' }],
            data: entries,
            getRowId: (entry) => String(entry.id)
        })
        expect(rowSpansOf(grid, grid.preWindowNodes).size).toBe(0)
    })

    it('clamps a span that would run off the end of the list', () => {
        // Asks for far more rows than exist.
        const grid = makeGrid(entries, () => 99)
        const spans = rowSpansOf(grid, grid.preWindowNodes).get('region')!
        expect(spans.span[0]).toBe(entries.length)
        expect(spans.owner).toEqual([0, 0, 0, 0, 0])
    })

    it('treats a missing or nonsense span as a single row', () => {
        const grid = makeGrid(entries, () => 0)
        const spans = rowSpansOf(grid, grid.preWindowNodes).get('region')!
        expect(spans.span).toEqual([1, 1, 1, 1, 1])
        expect(spans.owner).toEqual([0, 1, 2, 3, 4])
    })

    it('stops a span at a full-width row', () => {
        const grid = makeGrid()
        const nodes = grid.preWindowNodes.map((node: RowNode<Entry>, index: number) =>
            index === 1 ? { ...node, meta: { ...node.meta, fullWidth: true } } : node
        )
        const spans = rowSpansOf(grid, nodes).get('region')!

        // A full-width row renders one cell across every column, so nothing can
        // span into it: the run of three breaks after the first row.
        expect(spans.span[0]).toBe(1)
        expect(spans.owner[1]).toBe(1)
    })
})
