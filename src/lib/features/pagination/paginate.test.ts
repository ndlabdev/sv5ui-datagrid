import { describe, expect, it } from 'vitest'
import { buildRowNodes } from '../../core/row-node.js'
import { paginateNodes } from './paginate.js'

interface Person {
    name: string
}

const people: Person[] = [{ name: 'Charlie' }, { name: 'Alice' }, { name: 'Bob' }]

const nodes = buildRowNodes(people, (person) => person.name)

describe('paginateNodes', () => {
    it('returns nodes unchanged when pageSize is null', () => {
        expect(paginateNodes(nodes, 1, null)).toBe(nodes)
    })

    it('slices the requested page', () => {
        expect(paginateNodes(nodes, 1, 2).map((n) => n.row.name)).toEqual(['Charlie', 'Alice'])
        expect(paginateNodes(nodes, 2, 2).map((n) => n.row.name)).toEqual(['Bob'])
    })

    it('returns an empty array past the last page', () => {
        expect(paginateNodes(nodes, 3, 2)).toEqual([])
    })
})
