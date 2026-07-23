import { describe, expect, it } from 'vitest'
import { createDataGrid } from '../../core/grid/grid.svelte.js'
import type { ColumnDef } from '../../core/types/index.js'
import { getSorting, sorting, type SortCycle } from './index.js'

interface Row {
    id: number
    name: string
}

const columns: ColumnDef<Row>[] = [
    { id: 'name', sortable: true },
    { id: 'other', sortable: true }
]

function grid(cycle?: SortCycle) {
    return createDataGrid<Row>({
        columns,
        data: [{ id: 1, name: 'a' }],
        getRowId: (row) => String(row.id),
        features: [sorting(cycle ? { cycle } : {})]
    })
}

function walk(cycle: SortCycle | undefined, clicks: number): (string | null)[] {
    const sort = getSorting(grid(cycle))!
    const seen: (string | null)[] = []
    for (let i = 0; i < clicks; i++) {
        sort.toggleSort('name')
        seen.push(sort.directionOf('name') ?? null)
    }
    return seen
}

describe('sort cycle', () => {
    it('defaults to asc → desc → none', () => {
        expect(walk(undefined, 4)).toEqual(['asc', 'desc', null, 'asc'])
    })

    it('honours a custom order', () => {
        expect(walk(['desc', 'asc', null], 4)).toEqual(['desc', 'asc', null, 'desc'])
    })

    it('never clears when the cycle has no null', () => {
        expect(walk(['asc', 'desc'], 4)).toEqual(['asc', 'desc', 'asc', 'desc'])
    })

    it('supports a single-direction cycle that toggles on and off', () => {
        expect(walk(['desc', null], 4)).toEqual(['desc', null, 'desc', null])
    })

    it('falls back to the default when given an all-null cycle', () => {
        expect(walk([null], 3)).toEqual(['asc', 'desc', null])
    })

    it('applies the cycle per column when appending', () => {
        const sort = getSorting(grid(['asc', 'desc', null]))!
        sort.toggleSort('name')
        sort.toggleSort('other', { append: true })
        sort.toggleSort('other', { append: true })
        expect(sort.sort).toEqual([
            { columnId: 'name', direction: 'asc' },
            { columnId: 'other', direction: 'desc' }
        ])

        // Cycling the appended column to null drops just that column.
        sort.toggleSort('other', { append: true })
        expect(sort.sort).toEqual([{ columnId: 'name', direction: 'asc' }])
    })
})
