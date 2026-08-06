import { describe, expect, it } from 'vitest'
import { groupContiguousOrder } from './column-order.js'

describe('groupContiguousOrder', () => {
    // a,b belong to g1; c,d to g2; x is ungrouped.
    const groupOf = (id: string): string | null =>
        id === 'a' || id === 'b' ? 'g1' : id === 'c' || id === 'd' ? 'g2' : null

    it('leaves an order that already keeps groups together alone', () => {
        expect(groupContiguousOrder(['a', 'b', 'x', 'c', 'd'], groupOf)).toEqual([
            'a',
            'b',
            'x',
            'c',
            'd'
        ])
    })

    it('pulls a stray member back to its group rather than splitting the header', () => {
        // A stale snapshot asking for g1, g2, g1 must not repeat the g1 label
        // over two unrelated stretches of the header row.
        expect(groupContiguousOrder(['a', 'c', 'b', 'd'], groupOf)).toEqual(['a', 'b', 'c', 'd'])
    })

    it('places a group where its first member asked to be', () => {
        expect(groupContiguousOrder(['c', 'a', 'd', 'b'], groupOf)).toEqual(['c', 'd', 'a', 'b'])
    })

    it('keeps the requested order inside a group', () => {
        expect(groupContiguousOrder(['b', 'a', 'c'], groupOf)).toEqual(['b', 'a', 'c'])
    })

    it('never merges two ungrouped columns', () => {
        expect(groupContiguousOrder(['x', 'a', 'y', 'b'], groupOf)).toEqual(['x', 'a', 'b', 'y'])
    })

    it('handles an empty order', () => {
        expect(groupContiguousOrder([], groupOf)).toEqual([])
    })
})
