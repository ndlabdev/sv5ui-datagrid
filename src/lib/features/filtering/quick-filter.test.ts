import { describe, expect, it } from 'vitest'
import { buildRowNodes } from '../../core/grid/row-node.js'
import type { ColumnDef } from '../../core/types/index.js'
import { quickFilterNodes } from './quick-filter.js'

interface Person {
    name: string
    age: number | null
}

const columns: ColumnDef<Person>[] = [{ id: 'name' }, { id: 'age' }]

const people: Person[] = [
    { name: 'Charlie', age: 35 },
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: null }
]

const nodes = buildRowNodes(people, (person) => person.name)

describe('quickFilterNodes', () => {
    it('returns nodes unchanged for an empty query', () => {
        expect(quickFilterNodes(nodes, columns, '   ')).toBe(nodes)
    })

    it('matches case-insensitively across all columns', () => {
        expect(quickFilterNodes(nodes, columns, 'ALI').map((n) => n.row.name)).toEqual(['Alice'])
        expect(quickFilterNodes(nodes, columns, '3').map((n) => n.row.name)).toEqual([
            'Charlie',
            'Alice'
        ])
    })

    it('ignores null values', () => {
        expect(quickFilterNodes(nodes, columns, 'null')).toEqual([])
    })

    it('only searches the provided columns', () => {
        const nameOnly: ColumnDef<Person>[] = [{ id: 'name' }]
        expect(quickFilterNodes(nodes, nameOnly, '35')).toEqual([])
    })
})
