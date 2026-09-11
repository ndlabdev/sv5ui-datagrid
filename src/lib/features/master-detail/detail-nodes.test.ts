import { type RowNode } from '../../core/types/index.js'
import { describe, expect, it } from 'vitest'
import { buildDetailNodes, detailNodeId, isDetailNode, masterIdOf } from './detail-nodes.js'

interface Row {
    id: string
    lines: number
}

const nodes: RowNode<Row>[] = [
    { id: '1', index: 0, row: { id: '1', lines: 2 } },
    { id: '2', index: 1, row: { id: '2', lines: 0 } },
    { id: '3', index: 2, row: { id: '3', lines: 5 } }
]

const ids = (list: RowNode<Row>[]) => list.map((node) => node.id)

describe('detail ids', () => {
    it('round-trips a master id', () => {
        const id = detailNodeId('order-7')
        expect(isDetailNode(id)).toBe(true)
        expect(masterIdOf(id)).toBe('order-7')
        expect(isDetailNode('order-7')).toBe(false)
    })
})

describe('buildDetailNodes', () => {
    const hasDetail = (row: Row) => row.lines > 0

    it('inserts a detail row under each expanded master', () => {
        const result = buildDetailNodes(nodes, { hasDetail, isExpanded: (id) => id === '1' })
        expect(ids(result)).toEqual(['1', 'detail:1', '2', '3'])
    })

    it('marks the detail row full-width so the kernel renders the snippet', () => {
        const result = buildDetailNodes(nodes, { hasDetail, isExpanded: (id) => id === '1' })
        expect(result[1]!.meta).toMatchObject({ fullWidth: true })
        expect(result[1]!.row).toBe(nodes[0]!.row)
    })

    it('gives a chevron only to rows that have something to show', () => {
        const result = buildDetailNodes(nodes, { hasDetail, isExpanded: () => false })
        expect(result.map((node) => node.meta?.expandable)).toEqual([true, undefined, true])
    })

    it('never opens a panel for a row without detail', () => {
        const result = buildDetailNodes(nodes, { hasDetail, isExpanded: () => true })
        expect(ids(result)).toEqual(['1', 'detail:1', '2', '3', 'detail:3'])
    })

    it('leaves the list alone when nothing is expanded', () => {
        const result = buildDetailNodes(nodes, { hasDetail, isExpanded: () => false })
        expect(ids(result)).toEqual(['1', '2', '3'])
    })
})
