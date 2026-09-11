import { describe, expect, it } from 'vitest'
import {
    createDataGrid,
    filtering,
    getFiltering,
    getGrouping,
    getTree,
    grouping,
    isDataRow,
    tree,
    type ColumnDef
} from '$lib/index.js'

interface Person {
    id: number
    team: string
    name: string
}

const columns: ColumnDef<Person>[] = [{ id: 'team' }, { id: 'name' }]

const people: Person[] = Array.from({ length: 24 }, (_, index) => ({
    id: index + 1,
    team: index < 6 ? 'Core' : `T${index % 3}`,
    name: `person ${index + 1}`
}))

function groupedGrid() {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (person) => String(person.id),
        features: [filtering(), grouping({ by: ['team'], groupFooters: true, grandTotal: true })]
    })
}

describe('what a screen reader is told after a filter', () => {
    it('counts rows, not the group rows drawn around them', () => {
        const grid = groupedGrid()
        getFiltering(grid)!.setQuickFilter('Core')

        expect(grid.filteredNodes.filter(isDataRow).length).toBe(6)
        expect(grid.announcer.message).toBe('6 rows')
    })

    it('says the same number whether the groups are open or shut', () => {
        const shut = createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (person) => String(person.id),
            features: [
                filtering(),
                grouping({ by: ['team'], expandedByDefault: false, grandTotal: true })
            ]
        })
        getFiltering(shut)!.setQuickFilter('Core')

        const open = groupedGrid()
        getFiltering(open)!.setQuickFilter('Core')

        expect(shut.announcer.message).toBe('6 rows')
        expect(shut.announcer.message).toBe(open.announcer.message)
    })

    it('agrees with the number the status bar puts on screen', () => {
        const grid = groupedGrid()
        getGrouping(grid)
        getFiltering(grid)!.setQuickFilter('Core')

        const onScreen = grid.filteredRowCount
        expect(grid.announcer.message).toBe(`${onScreen} rows`)
        expect(onScreen).toBe(6)
    })

    it('counts every row back when the filter is lifted', () => {
        const grid = groupedGrid()
        getFiltering(grid)!.setQuickFilter('Core')
        getFiltering(grid)!.setQuickFilter('')

        expect(grid.announcer.message).toBe('24 rows')
    })
})

interface Unit {
    id: number
    name: string
    children?: Unit[]
}

const units: Unit[] = [
    { id: 1, name: 'alpha', children: [{ id: 3, name: 'a1', children: [{ id: 5, name: 'a1x' }] }] },
    { id: 2, name: 'beta', children: [{ id: 6, name: 'b1' }] }
]

describe('a tree keeps its children off the pipeline, and is asked instead', () => {
    it('answers the same number to the screen and to the reader', () => {
        const grid = createDataGrid<Unit>({
            columns: [{ id: 'name' }] as ColumnDef<Unit>[],
            data: units,
            getRowId: (unit) => String(unit.id),
            features: [filtering(), tree({ getChildren: (unit) => unit.children })]
        })
        getFiltering(grid)!.setQuickFilter('alpha')

        expect(getTree(grid)!.filteredRows).toBe(3)
        expect(grid.filteredRowCount).toBe(3)
        expect(grid.announcer.message).toBe('3 rows')
    })
})
