import { describe, expect, it } from 'vitest'
import { createDataGrid } from '../../core/grid/index.js'
import type { ColumnDef } from '../../core/types/index.js'
import { getPagination, pagination } from './index.js'

interface Person {
    id: number
    name: string
}

const columns: ColumnDef<Person>[] = [{ id: 'name' }]

function makePeople(count: number): Person[] {
    return Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Person ${i + 1}` }))
}

function createGrid(count: number, pageSize = 5) {
    return createDataGrid<Person>({
        columns,
        data: makePeople(count),
        getRowId: (person) => String(person.id),
        features: [pagination({ pageSize })]
    })
}

describe('Pagination — page clamping', () => {
    it('holds the page while the row set is large enough', () => {
        const grid = createGrid(30)
        const state = getPagination(grid)!

        state.setPage(4)
        expect(state.page).toBe(4)
        expect(grid.nodes.map((node) => node.row.name)).toEqual([
            'Person 16',
            'Person 17',
            'Person 18',
            'Person 19',
            'Person 20'
        ])
    })

    it('clamps the page when client data shrinks under it', () => {
        const grid = createGrid(30)
        const state = getPagination(grid)!

        state.setPage(6)
        expect(state.page).toBe(6)

        // No filter or sort event fires here — the data prop simply got smaller.
        grid.data = makePeople(8)

        expect(state.pageCount).toBe(2)
        expect(state.page).toBe(2)
        expect(grid.nodes.map((node) => node.row.name)).toEqual([
            'Person 6',
            'Person 7',
            'Person 8'
        ])
    })

    it('restores the original page when the rows come back', () => {
        const grid = createGrid(30)
        const state = getPagination(grid)!

        state.setPage(6)
        grid.data = makePeople(8)
        expect(state.page).toBe(2)

        grid.data = makePeople(30)
        expect(state.page).toBe(6)
    })

    it('never reports a page below one for an empty grid', () => {
        const grid = createGrid(30)
        const state = getPagination(grid)!

        state.setPage(4)
        grid.data = []

        expect(state.pageCount).toBe(1)
        expect(state.page).toBe(1)
        expect(grid.nodes).toEqual([])
    })
})
