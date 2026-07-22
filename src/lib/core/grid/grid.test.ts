import { describe, expect, it } from 'vitest'
import { filtering, getFiltering } from '../../features/filtering/index.js'
import { getPagination, pagination } from '../../features/pagination/index.js'
import { getSorting, sorting } from '../../features/sorting/index.js'
import { getVirtualization, virtualization } from '../../features/virtualization/index.js'
import { createDataGrid, type GridState } from './grid.svelte.js'
import type { GridFeature } from '../types.js'

interface Person {
    id: number
    name: string
    age: number
}

const people: Person[] = [
    { id: 1, name: 'Charlie', age: 35 },
    { id: 2, name: 'Alice', age: 30 },
    { id: 3, name: 'Bob', age: 28 },
    { id: 4, name: 'Dave', age: 41 },
    { id: 5, name: 'Erin', age: 22 }
]

function createGrid(features?: GridFeature<Person>[]): GridState<Person> {
    return createDataGrid<Person>({
        columns: [
            { id: 'name', sortable: true },
            { id: 'age', sortable: true }
        ],
        data: people,
        getRowId: (person) => String(person.id),
        features: features ?? [filtering(), sorting(), pagination({ pageSize: 2 })]
    })
}

function names(grid: GridState<Person>): string[] {
    return grid.nodes.map((node) => node.row.name)
}

describe('GridState', () => {
    it('builds nodes from data without features', () => {
        const grid = createGrid([])
        expect(names(grid)).toEqual(['Charlie', 'Alice', 'Bob', 'Dave', 'Erin'])
        expect(grid.nodes.map((node) => node.id)).toEqual(['1', '2', '3', '4', '5'])
    })

    it('registers feature state and merges feature apis', () => {
        const grid = createGrid()
        expect(getSorting(grid)).toBeDefined()
        expect(getFiltering(grid)).toBeDefined()
        expect(getPagination(grid)).toBeDefined()
        expect(Object.keys(grid.api).toSorted()).toEqual([
            'applyFilterModel',
            'clearColumnFilters',
            'getFilterModel',
            'getState',
            'setColumnFilter',
            'setPage',
            'setPageSize',
            'setQuickFilter',
            'setRowCount',
            'setSort',
            'setState',
            'toggleSort'
        ])
    })

    it('windows nodes by page while totalRows reflects the pre-window count', () => {
        const grid = createGrid()
        expect(names(grid)).toEqual(['Charlie', 'Alice'])
        expect(grid.totalRows).toBe(5)
        expect(getPagination(grid)!.pageCount).toBe(3)
    })

    it('cycles sort asc → desc → none through the pipeline', () => {
        const grid = createGrid()
        const sort = getSorting(grid)!

        sort.toggleSort('name')
        expect(names(grid)).toEqual(['Alice', 'Bob'])

        sort.toggleSort('name')
        expect(names(grid)).toEqual(['Erin', 'Dave'])

        sort.toggleSort('name')
        expect(names(grid)).toEqual(['Charlie', 'Alice'])
    })

    it('ignores toggleSort on non-sortable or unknown columns', () => {
        const grid = createDataGrid<Person>({
            columns: [{ id: 'name' }],
            data: people,
            getRowId: (person) => String(person.id),
            features: [sorting()]
        })
        getSorting(grid)!.toggleSort('name')
        getSorting(grid)!.toggleSort('missing')
        expect(getSorting(grid)!.sort).toEqual([])
    })

    it('filters across visible columns and updates totalRows', () => {
        const grid = createGrid()
        getFiltering(grid)!.setQuickFilter('li')
        expect(grid.totalRows).toBe(2)
        expect(names(grid)).toEqual(['Charlie', 'Alice'])
    })

    it('resets the page when sort or filter changes', () => {
        const grid = createGrid()
        const page = getPagination(grid)!

        page.setPage(3)
        expect(names(grid)).toEqual(['Erin'])

        getSorting(grid)!.toggleSort('age')
        expect(page.page).toBe(1)

        page.setPage(2)
        getFiltering(grid)!.setQuickFilter('a')
        expect(page.page).toBe(1)
    })

    it('clamps setPage to the valid range', () => {
        const grid = createGrid()
        const page = getPagination(grid)!

        page.setPage(99)
        expect(page.page).toBe(3)

        page.setPage(-5)
        expect(page.page).toBe(1)
    })

    it('runs custom stages in pipeline order', () => {
        const takeFirst: GridFeature<Person> = {
            id: 'take-first',
            pipelineStage: {
                order: 150,
                transform: (nodes) => nodes.slice(0, 3)
            }
        }
        const grid = createGrid([filtering(), takeFirst, sorting(), pagination({ pageSize: 2 })])

        getSorting(grid)!.toggleSort('name')
        expect(names(grid)).toEqual(['Alice', 'Bob'])
        expect(grid.totalRows).toBe(3)
    })

    it('rebuilds nodes when data is replaced', () => {
        const grid = createGrid([])
        grid.data = people.slice(0, 2)
        expect(names(grid)).toEqual(['Charlie', 'Alice'])
    })

    it('rejects two window-order features', () => {
        expect(() => createGrid([pagination({ pageSize: 2 }), virtualization()])).toThrow(
            /window-order/
        )
    })

    it('virtualization resets scroll when sort or filter changes', () => {
        const grid = createGrid([filtering(), sorting(), virtualization({ rowHeight: 40 })])
        const virt = getVirtualization(grid)!

        virt.virtualizer.scrollTop = 4000
        getFiltering(grid)!.setQuickFilter('a')
        expect(virt.virtualizer.scrollTop).toBe(0)

        virt.virtualizer.scrollTop = 4000
        getSorting(grid)!.toggleSort('name')
        expect(virt.virtualizer.scrollTop).toBe(0)
    })
})
