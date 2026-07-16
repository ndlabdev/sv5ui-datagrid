import { describe, expect, it } from 'vitest'
import { filtering, getFiltering } from '../features/filtering/index.js'
import { getPagination, pagination } from '../features/pagination/index.js'
import { getSorting, sorting } from '../features/sorting/index.js'
import { createDataGrid } from './grid.svelte.js'
import type { DataGridOptions } from './types.js'

interface Person {
    id: number
    name: string
}

const people: Person[] = [
    { id: 1, name: 'Alice' },
    { id: 2, name: 'Bob' },
    { id: 3, name: 'Charlie' }
]

function createGrid(overrides: Partial<DataGridOptions<Person>> = {}) {
    return createDataGrid<Person>({
        columns: [{ id: 'name', header: 'Name', sortable: true }],
        data: people,
        getRowId: (person) => String(person.id),
        features: [filtering(), sorting(), pagination({ pageSize: 2 })],
        ...overrides
    })
}

describe('Announcer', () => {
    it('announces sort changes with the column header', () => {
        const grid = createGrid()
        getSorting(grid)!.toggleSort('name')
        expect(grid.announcer.message).toBe('sorted by Name ascending')

        getSorting(grid)!.toggleSort('name')
        expect(grid.announcer.message).toBe('sorted by Name descending')

        getSorting(grid)!.toggleSort('name')
        expect(grid.announcer.message).toBe('sort cleared')
    })

    it('announces the post-filter row count', () => {
        const grid = createGrid()
        getFiltering(grid)!.setQuickFilter('ali')
        expect(grid.announcer.message).toBe('1 rows')
    })

    it('announces page changes', () => {
        const grid = createGrid()
        getPagination(grid)!.setPage(2)
        expect(grid.announcer.message).toBe('page 2')
    })

    it('uses locale overrides', () => {
        const grid = createGrid({
            locale: { filtered: (count) => `còn ${count} dòng` }
        })
        getFiltering(grid)!.setQuickFilter('bob')
        expect(grid.announcer.message).toBe('còn 1 dòng')
    })
})
