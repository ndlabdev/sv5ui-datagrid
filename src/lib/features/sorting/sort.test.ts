import { describe, expect, it } from 'vitest'
import { buildRowNodes } from '../../core/grid/index.js'
import type { ColumnDef, RowNode } from '../../core/types/index.js'
import { sortNodes } from './sort.js'

interface Person {
    name: string
    age: number | null
}

const columns: ColumnDef<Person>[] = [
    { id: 'name', sortable: true },
    { id: 'age', sortable: true }
]

const people: Person[] = [
    { name: 'Charlie', age: 35 },
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: null }
]

const nodes = buildRowNodes(people, (person) => person.name)

function names(result: RowNode<Person>[]): string[] {
    return result.map((node) => node.row.name)
}

describe('sortNodes', () => {
    it('returns nodes unchanged when sort is empty', () => {
        expect(sortNodes(nodes, columns, [])).toBe(nodes)
    })

    it('sorts strings ascending', () => {
        const sorted = sortNodes(nodes, columns, [{ columnId: 'name', direction: 'asc' }])
        expect(names(sorted)).toEqual(['Alice', 'Bob', 'Charlie'])
    })

    it('sorts numbers with nulls first when ascending', () => {
        const asc = sortNodes(nodes, columns, [{ columnId: 'age', direction: 'asc' }])
        expect(asc.map((node) => node.row.age)).toEqual([null, 30, 35])

        const desc = sortNodes(nodes, columns, [{ columnId: 'age', direction: 'desc' }])
        expect(desc.map((node) => node.row.age)).toEqual([35, 30, null])
    })

    it('treats the empty string as a hole, like the renderers and filters do', () => {
        interface Entry {
            id: string
            note: string | null
        }
        const holes: Entry[] = [
            { id: 'a', note: 'beta' },
            { id: 'b', note: '' },
            { id: 'c', note: 'alpha' },
            { id: 'd', note: null }
        ]
        const entryColumns: ColumnDef<Entry>[] = [{ id: 'note', sortable: true }]
        const entryNodes = buildRowNodes(holes, (entry) => entry.id)
        const sort = [{ columnId: 'note', direction: 'asc' as const }]

        // Collated as a value, '' would sort before every letter and so be
        // indistinguishable from nulls: 'first' whatever the option said.
        const last = sortNodes(entryNodes, entryColumns, sort, 'last')
        expect(last.map((node) => node.row.id)).toEqual(['c', 'a', 'b', 'd'])

        const first = sortNodes(entryNodes, entryColumns, sort, 'first')
        expect(first.map((node) => node.row.id)).toEqual(['b', 'd', 'c', 'a'])
    })

    it('does not mutate the input array', () => {
        const input = [...nodes]
        sortNodes(input, columns, [{ columnId: 'name', direction: 'asc' }])
        expect(input).toEqual(nodes)
    })

    it('uses a custom sortFn when provided', () => {
        const custom: ColumnDef<Person>[] = [
            { id: 'name', sortable: true, sortFn: (a, b) => a.name.length - b.name.length }
        ]
        const sorted = sortNodes(nodes, custom, [{ columnId: 'name', direction: 'asc' }])
        expect(names(sorted)).toEqual(['Bob', 'Alice', 'Charlie'])
    })

    it('returns nodes unchanged for an unknown column', () => {
        expect(sortNodes(nodes, columns, [{ columnId: 'missing', direction: 'asc' }])).toBe(nodes)
    })

    it('applies multi-sort in priority order', () => {
        interface Order {
            group: string
            value: number
        }
        const orderColumns: ColumnDef<Order>[] = [{ id: 'group' }, { id: 'value' }]
        const orders = buildRowNodes<Order>(
            [
                { group: 'b', value: 2 },
                { group: 'a', value: 1 },
                { group: 'b', value: 1 }
            ],
            (order) => `${order.group}-${order.value}`
        )

        const sorted = sortNodes(orders, orderColumns, [
            { columnId: 'group', direction: 'asc' },
            { columnId: 'value', direction: 'desc' }
        ])
        expect(sorted.map((node) => node.id)).toEqual(['a-1', 'b-2', 'b-1'])
    })

    it('keeps the original order of equal rows (stable sort)', () => {
        const tied = buildRowNodes<Person>(
            [
                { name: 'Zoe', age: 30 },
                { name: 'Amy', age: 30 },
                { name: 'Kim', age: 30 }
            ],
            (person) => person.name
        )
        const sorted = sortNodes(tied, columns, [{ columnId: 'age', direction: 'asc' }])
        expect(names(sorted)).toEqual(['Zoe', 'Amy', 'Kim'])
    })
})
