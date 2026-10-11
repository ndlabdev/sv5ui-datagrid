import { describe, expect, it } from 'vitest'
import type { RowNode } from '$lib/index.js'
import { reorderGroups } from '../lib/features/pivot/pivot-sort.js'

interface Cell {
    label: string
}

const group = (id: string, level: number): RowNode<Cell> => ({
    id,
    row: { label: id },
    index: 0,
    meta: { level, expandable: true }
})

const leaf = (id: string, level: number): RowNode<Cell> => ({
    id,
    row: { label: id },
    index: 0,
    meta: { level }
})

const ids = (nodes: RowNode<Cell>[]): string[] => nodes.map((node) => node.id)

const byIdDescending = (siblings: RowNode<Cell>[]): RowNode<Cell>[] =>
    [...siblings].sort((left, right) => right.id.localeCompare(left.id))

describe('reordering pivot groups', () => {
    it('sorts group heads and carries each body with its head', () => {
        const run = [group('a', 0), leaf('a1', 1), group('b', 0), leaf('b1', 1)]

        expect(ids(reorderGroups(run, byIdDescending))).toEqual(['b', 'b1', 'a', 'a1'])
    })

    it('sorts the groups that follow rows belonging to the group above them', () => {
        const run = [leaf('measure-1', 1), leaf('measure-2', 1), group('a', 1), group('b', 1)]

        expect(ids(reorderGroups(run, byIdDescending))).toEqual([
            'measure-1',
            'measure-2',
            'b',
            'a'
        ])
    })

    it('sorts a nested level that opens with rows of its own', () => {
        const run = [
            group('a', 0),
            leaf('a-measure', 1),
            group('a-x', 1),
            group('a-y', 1),
            group('b', 0),
            leaf('b-measure', 1)
        ]

        expect(ids(reorderGroups(run, byIdDescending))).toEqual([
            'b',
            'b-measure',
            'a',
            'a-measure',
            'a-y',
            'a-x'
        ])
    })

    it('leaves a run of rows alone when none of them opens a group', () => {
        const run = [leaf('one', 1), leaf('two', 1), leaf('three', 1)]

        expect(ids(reorderGroups(run, byIdDescending))).toEqual(['one', 'two', 'three'])
    })

    it('leaves the run alone when a row stands between two groups at the same level', () => {
        const run = [group('a', 0), leaf('stray', 0), group('b', 0)]

        expect(ids(reorderGroups(run, byIdDescending))).toEqual(['a', 'stray', 'b'])
    })
})
