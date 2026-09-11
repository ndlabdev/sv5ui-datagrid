import { type ColumnDef, type RowNode } from '../../core/types/index.js'
import { describe, expect, it } from 'vitest'
import { buildGroupNodes, groupNodeId } from './group-nodes.js'
import type { Aggregation } from './grouping.types.js'

function buildRowNodes<TRow>(data: TRow[], getRowId: (row: TRow) => string): RowNode<TRow>[] {
    return data.map((row, index) => ({ id: getRowId(row), row, index }))
}

interface Person {
    id: number
    name: string
    dept: string
    country: string
    salary: number
}

const people: Person[] = [
    { id: 1, name: 'Alice', dept: 'Core', country: 'VN', salary: 100 },
    { id: 2, name: 'Bob', dept: 'Core', country: 'VN', salary: 200 },
    { id: 3, name: 'Carol', dept: 'Core', country: 'US', salary: 300 },
    { id: 4, name: 'Dave', dept: 'Data', country: 'US', salary: 400 }
]

const columns: ColumnDef<Person>[] = [
    { id: 'name' },
    { id: 'dept' },
    { id: 'country' },
    { id: 'salary' }
]

const nodes = buildRowNodes(people, (person) => String(person.id))

function build(
    by: string[],
    {
        expanded = () => true,
        aggregations = {}
    }: {
        expanded?: (id: string) => boolean
        aggregations?: Record<string, Aggregation<Person>>
    } = {}
) {
    return buildGroupNodes(nodes, {
        by,
        columns,
        aggregations,
        isExpanded: expanded,
        groupLabel: (key, count) => `${key} (${count})`
    })
}

describe('buildGroupNodes', () => {
    it('passes nodes through when nothing is grouped', () => {
        expect(build([])).toBe(nodes)
    })

    it('emits a group row before its members, in first-appearance order', () => {
        const result = build(['dept'])
        expect(result.map((node) => node.id)).toEqual([
            'group:dept=Core',
            '1',
            '2',
            '3',
            'group:dept=Data',
            '4'
        ])
    })

    it('marks group rows expandable and indents members one level deeper', () => {
        const [group, member] = build(['dept'])
        expect(group!.meta).toMatchObject({ level: 0, expandable: true, setSize: 2, posInSet: 1 })
        expect(member!.meta).toMatchObject({ level: 1 })
        expect(member!.meta?.expandable).toBeUndefined()
    })

    it('nests several grouped columns', () => {
        const result = build(['dept', 'country'])
        expect(result.map((node) => node.id)).toEqual([
            'group:dept=Core',
            'group:dept=Core|country=VN',
            '1',
            '2',
            'group:dept=Core|country=US',
            '3',
            'group:dept=Data',
            'group:dept=Data|country=US',
            '4'
        ])
        expect(result[1]!.meta).toMatchObject({ level: 1, expandable: true })
        expect(result[2]!.meta).toMatchObject({ level: 2 })
    })

    it('omits members of collapsed groups', () => {
        const result = build(['dept'], { expanded: (id) => id !== 'group:dept=Core' })
        expect(result.map((node) => node.id)).toEqual(['group:dept=Core', 'group:dept=Data', '4'])
    })

    it('labels the grouped column and computes aggregates on the group row', () => {
        const result = build(['dept'], {
            aggregations: { salary: 'sum', id: 'count' }
        })
        const core = result[0]!.row as unknown as Record<string, unknown>
        expect(core.dept).toBe('Core (3)')
        expect(core.salary).toBe(600)
        expect(core.id).toBe(3)
    })

    it('aggregates over every descendant when nested', () => {
        const result = build(['dept', 'country'], { aggregations: { salary: 'sum' } })
        expect((result[0]!.row as unknown as Record<string, unknown>).salary).toBe(600)
        expect((result[1]!.row as unknown as Record<string, unknown>).salary).toBe(300)
    })

    it('buckets nullish values under (blank)', () => {
        const withBlank = buildRowNodes(
            [{ id: 9, name: 'X', dept: '', country: 'VN', salary: 1 }],
            (person) => String(person.id)
        )
        const result = buildGroupNodes(withBlank, {
            by: ['dept'],
            columns,
            aggregations: {},
            isExpanded: () => true,
            groupLabel: (key) => key
        })
        expect(result[0]!.id).toBe('group:dept=(blank)')
    })

    it('falls back to plain rows for an unknown grouped column', () => {
        const result = build(['nope'])
        expect(result.map((node) => node.id)).toEqual(['1', '2', '3', '4'])
    })

    it('builds stable ids from the group path', () => {
        expect(groupNodeId([{ columnId: 'dept', key: 'Core' }])).toBe('group:dept=Core')
    })

    it('escapes the separator so keys containing it cannot collide', () => {
        const nested = groupNodeId([
            { columnId: 'a', key: 'x' },
            { columnId: 'b', key: 'y' }
        ])
        const single = groupNodeId([{ columnId: 'a', key: 'x|b=y' }])
        expect(single).not.toBe(nested)
        expect(groupNodeId([{ columnId: 'a', key: 'x\\|y' }])).toBe('group:a=x\\\\\\|y')
    })
})
