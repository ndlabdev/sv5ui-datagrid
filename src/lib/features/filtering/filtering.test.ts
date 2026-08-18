import { describe, expect, it, vi } from 'vitest'
import { HEADER_ROW } from '../../core/interaction/index.js'
import { createDataGrid, type GridState } from '../../core/grid/index.js'
import type { ColumnDef, FilterModel } from '../../core/types/index.js'
import { getSorting, sorting } from '../sorting/index.js'
import { filtering, getFiltering } from './index.js'

interface Person {
    id: number
    name: string
    age: number | null
    dept: string
    active: boolean
    joined: string
}

const people: Person[] = [
    { id: 1, name: 'Alice', age: 30, dept: 'Core', active: true, joined: '2024-01-10' },
    { id: 2, name: 'Bob', age: null, dept: 'Data', active: false, joined: '2024-06-01' },
    { id: 3, name: 'Carol', age: 45, dept: 'Core', active: true, joined: '2025-03-15' },
    { id: 4, name: 'Dave', age: 22, dept: 'Infra', active: false, joined: '2025-11-30' }
]

const columns: ColumnDef<Person>[] = [
    { id: 'name', sortable: true, filter: 'text' },
    { id: 'age', sortable: true, filter: 'number' },
    { id: 'dept', filter: 'set' },
    { id: 'active', filter: 'boolean' },
    { id: 'joined', filter: 'date' }
]

function createGrid(): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (person) => String(person.id),
        features: [filtering(), sorting({ nulls: 'last' })]
    })
}

function names(grid: GridState<Person>): string[] {
    return grid.nodes.map((node) => node.row.name)
}

describe('Filtering v2', () => {
    it('applies column filters through the pipeline alongside quick filter', () => {
        const grid = createGrid()
        const state = getFiltering(grid)!

        state.setColumnFilter('dept', { kind: 'set', values: ['Core'] })
        expect(names(grid)).toEqual(['Alice', 'Carol'])

        state.setQuickFilter('car')
        expect(names(grid)).toEqual(['Carol'])

        state.setColumnFilter('dept', null)
        state.setQuickFilter('')
        expect(names(grid)).toHaveLength(4)
    })

    it('serializes and round-trips the filter model through JSON (exit criteria)', () => {
        const grid = createGrid()
        const state = getFiltering(grid)!

        state.setQuickFilter('a')
        state.setColumnFilter('age', { kind: 'number', op: 'between', value: 20, to: 40 })
        state.setColumnFilter('joined', { kind: 'date', op: 'after', value: '2024-12-31' })

        const json = JSON.stringify(state.getFilterModel())
        const restored = createGrid()
        getFiltering(restored)!.applyFilterModel(JSON.parse(json) as FilterModel)

        expect(names(restored)).toEqual(names(grid))
        expect(getFiltering(restored)!.getFilterModel()).toEqual(JSON.parse(json))
    })

    it('emits filterChanged with the full model payload', () => {
        const grid = createGrid()
        const handler = vi.fn()
        grid.events.on('filterChanged', handler)

        getFiltering(grid)!.setColumnFilter('active', { kind: 'boolean', value: true })
        expect(handler).toHaveBeenCalledWith({
            filter: {
                quick: '',
                columns: { active: { kind: 'boolean', value: true } }
            }
        })
    })

    it('clears all column filters at once and counts active ones', () => {
        const grid = createGrid()
        const state = getFiltering(grid)!

        state.setColumnFilter('dept', { kind: 'set', values: ['Core'] })
        state.setColumnFilter('active', { kind: 'boolean', value: true })
        expect(state.activeCount).toBe(2)

        state.clearColumnFilters()
        expect(state.activeCount).toBe(0)
        expect(names(grid)).toHaveLength(4)
    })

    it('provides cached distinct values from the unfiltered source', () => {
        const grid = createGrid()
        const state = getFiltering(grid)!

        state.setColumnFilter('dept', { kind: 'set', values: ['Core'] })
        expect(state.distinctFor('dept')).toEqual(['Core', 'Data', 'Infra'])
        expect(state.distinctFor('ghost')).toEqual([])
    })
})

describe('Sorting v2', () => {
    it('appends multi-sort and cycles the appended column independently', () => {
        const grid = createGrid()
        const sort = getSorting(grid)!

        sort.toggleSort('name')
        sort.toggleSort('age', { append: true })
        expect(sort.sort).toEqual([
            { columnId: 'name', direction: 'asc' },
            { columnId: 'age', direction: 'asc' }
        ])
        expect(sort.priorityOf('name')).toBe(1)
        expect(sort.priorityOf('age')).toBe(2)

        sort.toggleSort('age', { append: true })
        expect(sort.directionOf('age')).toBe('desc')

        sort.toggleSort('age', { append: true })
        expect(sort.sort).toEqual([{ columnId: 'name', direction: 'asc' }])
        expect(sort.priorityOf('name')).toBeNull()
    })

    it('replaces the whole sort without append', () => {
        const grid = createGrid()
        const sort = getSorting(grid)!

        sort.toggleSort('name')
        sort.toggleSort('age')
        expect(sort.sort).toEqual([{ columnId: 'age', direction: 'asc' }])
    })

    it('honors nulls: last', () => {
        const grid = createGrid()
        getSorting(grid)!.toggleSort('age')
        expect(grid.nodes.map((node) => node.row.age)).toEqual([22, 30, 45, null])
    })

    it('appends via Shift+Enter on a focused header', () => {
        const grid = createGrid()
        const sort = getSorting(grid)!
        sort.toggleSort('name')

        grid.focus.focusCell({ row: HEADER_ROW, col: 1 })
        grid.focus.handleKeydown({
            key: 'Enter',
            shiftKey: true,
            ctrlKey: false,
            metaKey: false,
            altKey: false,
            preventDefault: vi.fn()
        } as unknown as KeyboardEvent)

        expect(sort.sort.map((entry) => entry.columnId)).toEqual(['name', 'age'])
    })
})
