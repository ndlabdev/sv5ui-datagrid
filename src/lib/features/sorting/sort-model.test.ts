import { describe, expect, it } from 'vitest'
import { buildRowNodes } from '../../core/grid/index.js'
import type { ColumnDef } from '../../core/types/index.js'
import { toSortRequest } from './sort-model.js'
import { sortNodes } from './sort.js'

interface Person {
    id: number
    display: string
    lastName: string
    age: number
}

const people: Person[] = [
    { id: 1, display: 'Ada Lovelace', lastName: 'Lovelace', age: 36 },
    { id: 2, display: 'Alan Turing', lastName: 'Turing', age: 41 },
    { id: 3, display: 'Grace Hopper', lastName: 'Hopper', age: 85 }
]

const nodes = buildRowNodes<Person>(people, (person) => String(person.id))

const columns: ColumnDef<Person>[] = [
    // Shows the full name, orders by surname.
    { id: 'display', sortable: true, sortField: 'lastName' },
    { id: 'age', sortable: true }
]

describe('sortField on the client', () => {
    it('orders by the named field, not the one on screen', () => {
        const sorted = sortNodes(nodes, columns, [{ columnId: 'display', direction: 'asc' }])
        // By surname: Hopper, Lovelace, Turing. By what the cell shows it
        // would have been Ada, Alan, Grace.
        expect(sorted.map((node) => node.row.display)).toEqual([
            'Grace Hopper',
            'Ada Lovelace',
            'Alan Turing'
        ])
    })

    it('lets sortFn win over it', () => {
        const withFn: ColumnDef<Person>[] = [
            {
                id: 'display',
                sortable: true,
                sortField: 'lastName',
                sortFn: (a, b) => a.age - b.age
            }
        ]
        const sorted = sortNodes(nodes, withFn, [{ columnId: 'display', direction: 'asc' }])
        expect(sorted.map((node) => node.row.age)).toEqual([36, 41, 85])
    })

    it('leaves a column without one sorting on what it shows', () => {
        const sorted = sortNodes(nodes, columns, [{ columnId: 'age', direction: 'desc' }])
        expect(sorted.map((node) => node.row.age)).toEqual([85, 41, 36])
    })
})

describe('toSortRequest', () => {
    it('sends the wire field and keeps the priority order', () => {
        expect(
            toSortRequest(
                [
                    { columnId: 'display', direction: 'asc' },
                    { columnId: 'age', direction: 'desc' }
                ],
                columns
            )
        ).toEqual([
            { field: 'lastName', direction: 'asc' },
            { field: 'age', direction: 'desc' }
        ])
    })

    it('falls back to the id when the column names no field', () => {
        expect(toSortRequest([{ columnId: 'age', direction: 'asc' }], columns)).toEqual([
            { field: 'age', direction: 'asc' }
        ])
    })

    it('finds a column nested under a header group', () => {
        // What `grid.columns.defs` looks like once the grid has header groups:
        // the groups sit at the top and the real columns hang off `children`.
        const grouped: ColumnDef<Person>[] = [
            { id: 'identity', header: 'Identity', children: columns }
        ]
        expect(toSortRequest([{ columnId: 'display', direction: 'asc' }], grouped)).toEqual([
            { field: 'lastName', direction: 'asc' }
        ])
    })

    it('drops a sort naming a column the grid does not have', () => {
        // The server can resolve it no better than the grid could.
        expect(toSortRequest([{ columnId: 'ghost', direction: 'asc' }], columns)).toEqual([])
    })

    it('is empty for an empty sort', () => {
        expect(toSortRequest([], columns)).toEqual([])
    })
})
