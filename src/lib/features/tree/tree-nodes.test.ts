import { type RowNode } from '../../core/types/index.js'
import { describe, expect, it } from 'vitest'
import { buildTreeNodes, indexByParent } from './tree-nodes.js'

interface Row {
    id: string
    parent: string | null
}

function nodesOf(...ids: [string, string | null][]): RowNode<Row>[] {
    return ids.map(([id, parent], index) => ({ id, row: { id, parent }, index }))
}

const flat = nodesOf(['a', null], ['a1', 'a'], ['a2', 'a'], ['a1x', 'a1'], ['b', null])

const index = indexByParent(flat, (row) => row.parent)
const childrenOf = (node: RowNode<Row>) => index.children.get(node.id) ?? []
const ids = (nodes: RowNode<Row>[]) => nodes.map((node) => node.id)

describe('indexByParent', () => {
    it('splits roots from children', () => {
        expect(ids(index.roots)).toEqual(['a', 'b'])
        expect(ids(index.children.get('a')!)).toEqual(['a1', 'a2'])
    })

    it('promotes an orphan to a root rather than dropping it', () => {
        const orphaned = indexByParent(nodesOf(['a1', 'a'], ['b', null]), (row) => row.parent)
        expect(ids(orphaned.roots)).toEqual(['a1', 'b'])
    })
})

describe('buildTreeNodes', () => {
    it('shows only roots while nothing is expanded', () => {
        const result = buildTreeNodes(index.roots, { childrenOf, isExpanded: () => false })
        expect(ids(result.nodes)).toEqual(['a', 'b'])
    })

    it('reveals a level at a time as rows expand', () => {
        const open = new Set(['a'])
        const first = buildTreeNodes(index.roots, {
            childrenOf,
            isExpanded: (id) => open.has(id)
        })
        expect(ids(first.nodes)).toEqual(['a', 'a1', 'a2', 'b'])

        open.add('a1')
        const second = buildTreeNodes(index.roots, {
            childrenOf,
            isExpanded: (id) => open.has(id)
        })
        expect(ids(second.nodes)).toEqual(['a', 'a1', 'a1x', 'a2', 'b'])
    })

    it('attaches the meta the kernel needs for treegrid ARIA', () => {
        const result = buildTreeNodes(index.roots, {
            childrenOf,
            isExpanded: () => true
        })
        const byId = new Map(result.nodes.map((node) => [node.id, node.meta]))

        expect(byId.get('a')).toMatchObject({ level: 0, expandable: true, setSize: 2, posInSet: 1 })
        expect(byId.get('a1')).toMatchObject({
            level: 1,
            expandable: true,
            setSize: 2,
            posInSet: 1
        })
        expect(byId.get('a1x')).toMatchObject({ level: 2, expandable: false, posInSet: 1 })
        expect(byId.get('b')).toMatchObject({ level: 0, expandable: false, posInSet: 2 })
    })

    it('opens to the default depth and reports what it opened', () => {
        const result = buildTreeNodes(index.roots, {
            childrenOf,
            isExpanded: () => false,
            defaultExpandedDepth: 1
        })

        expect(ids(result.nodes)).toEqual(['a', 'a1', 'a2', 'b'])
        expect(result.autoExpanded).toEqual(['a'])
    })

    it('does not report ids the user already opened', () => {
        const result = buildTreeNodes(index.roots, {
            childrenOf,
            isExpanded: (id) => id === 'a',
            defaultExpandedDepth: 1
        })
        expect(result.autoExpanded).toEqual([])
    })

    it('leaves a seeded row closed once the user collapses it', () => {
        const result = buildTreeNodes(index.roots, {
            childrenOf,
            isExpanded: () => false,
            defaultExpandedDepth: 1,
            isSeeded: (id) => id === 'a'
        })

        expect(ids(result.nodes)).toEqual(['a', 'b'])
        expect(result.autoExpanded).toEqual([])
    })

    it('walks nested children just as well as flat ones', () => {
        interface Nested {
            id: string
            kids?: Nested[]
        }
        const root: RowNode<Nested> = {
            id: 'r',
            index: 0,
            row: { id: 'r', kids: [{ id: 'k1' }, { id: 'k2' }] }
        }
        const result = buildTreeNodes([root], {
            childrenOf: (node) =>
                (node.row.kids ?? []).map((kid, i) => ({ id: kid.id, row: kid, index: i })),
            isExpanded: () => true
        })
        expect(result.nodes.map((node) => node.id)).toEqual(['r', 'k1', 'k2'])
    })
})
