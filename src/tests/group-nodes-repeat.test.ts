import { describe, expect, it } from 'vitest'
import type { ColumnDef, RowNode } from '$lib/index.js'
import { buildGroupNodes } from '../lib/features/grouping/group-nodes.js'

interface Sale {
    region: string
    amount: number
}

const rows: Sale[] = [
    { region: 'North', amount: 100 },
    { region: 'North', amount: 80 },
    { region: 'South', amount: 200 }
]

const nodes: RowNode<Sale>[] = rows.map((row, index) => ({ id: String(index), row, index }))

const columns: ColumnDef<Sale>[] = [{ id: 'region' }, { id: 'amount' }]

const build = (repeat?: Parameters<typeof buildGroupNodes<Sale>>[1]['repeat']) =>
    buildGroupNodes(nodes, {
        by: ['region'],
        columns,
        aggregations: { amount: 'sum' },
        isExpanded: () => false,
        groupLabel: (key) => key,
        repeat
    })

const twoMeasures = {
    count: 2,
    aggregationsAt: (at: number) => ({ amount: at === 0 ? ('sum' as const) : ('avg' as const) }),
    idAt: (groupId: string, at: number) => `${groupId}::m${at}`,
    fieldsAt: (at: number) => ({ region: at === 0 ? 'Sum' : 'Average' })
}

describe('repeating a group row once per set of aggregations', () => {
    it('leaves the rows alone when nothing asks for a repeat', () => {
        const built = build()

        expect(built).toHaveLength(2)
        expect(built.map((node) => node.row.amount)).toEqual([180, 200])
    })

    it('puts the repeated rows under their group and measures each with its own reduction', () => {
        const built = build(twoMeasures)

        expect(built.map((node) => node.row.region)).toEqual([
            'North',
            'Sum',
            'Average',
            'South',
            'Sum',
            'Average'
        ])
        expect(built.map((node) => node.row.amount)).toEqual([
            undefined,
            180,
            90,
            undefined,
            200,
            200
        ])
    })

    it('sinks the repeated rows one level under the group and gives them their own set', () => {
        const built = build(twoMeasures)

        expect(built.map((node) => node.meta?.level)).toEqual([0, 1, 1, 0, 1, 1])
        expect(built.map((node) => node.meta?.expandable)).toEqual([
            true,
            undefined,
            undefined,
            true,
            undefined,
            undefined
        ])
        expect(built.slice(1, 3).map((node) => node.meta?.posInSet)).toEqual([1, 2])
        expect(built.slice(1, 3).map((node) => node.meta?.setSize)).toEqual([2, 2])
    })

    it('gives every repeated row an id of its own', () => {
        const ids = build(twoMeasures).map((node) => node.id)

        expect(new Set(ids).size).toBe(ids.length)
        expect(ids[1]).toBe(`${ids[0]}::m0`)
    })

    it('shows the repeated rows whether the group is open or shut', () => {
        const open = buildGroupNodes(nodes, {
            by: ['region'],
            columns,
            aggregations: { amount: 'sum' },
            isExpanded: () => true,
            groupLabel: (key) => key,
            repeat: twoMeasures
        })

        expect(open.slice(0, 3).map((node) => node.row.region)).toEqual(['North', 'Sum', 'Average'])
        expect(open).toHaveLength(9)
    })
})
