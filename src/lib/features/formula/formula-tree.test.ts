import { createDataGrid } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { filtering } from '../../features/filtering/index.js'
import { sorting } from '../../features/sorting/index.js'
import { describe, expect, it } from 'vitest'
import { getTree, tree } from '../tree/index.js'
import { formula } from './formula.svelte.js'

interface Task {
    id: number
    parentId: number | null
    name: string
    rate: number
    hours: number
    cost?: number
    children?: Task[]
}

const columns: ColumnDef<Task>[] = [
    { id: 'name', header: 'Name', filter: 'text' },
    { id: 'rate', header: 'Rate' },
    { id: 'hours', header: 'Hours' },
    { id: 'cost', header: 'Cost', sortable: true, filter: 'number' }
]

const flat: Task[] = [
    { id: 1, parentId: null, name: 'design', rate: 100, hours: 2 },
    { id: 2, parentId: 1, name: 'sketch', rate: 50, hours: 3 },
    { id: 3, parentId: 2, name: 'revise', rate: 20, hours: 4 },
    { id: 4, parentId: null, name: 'build', rate: 10, hours: 10 }
]

const nested: Task[] = [
    {
        id: 1,
        parentId: null,
        name: 'design',
        rate: 100,
        hours: 2,
        children: [
            {
                id: 2,
                parentId: 1,
                name: 'sketch',
                rate: 50,
                hours: 3,
                children: [{ id: 3, parentId: 2, name: 'revise', rate: 20, hours: 4 }]
            }
        ]
    },
    { id: 4, parentId: null, name: 'build', rate: 10, hours: 10 }
]

function flatGrid(expression = 'rate * hours') {
    return createDataGrid<Task>({
        columns,
        data: flat,
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            filtering(),
            formula<Task>({ columns: { cost: expression } }),
            tree<Task>({
                getParentId: (row) => (row.parentId === null ? null : String(row.parentId)),
                defaultExpandedDepth: 3
            })
        ]
    })
}

function nestedGrid(expression = 'rate * hours') {
    return createDataGrid<Task>({
        columns,
        data: nested,
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            filtering(),
            formula<Task>({ columns: { cost: expression } }),
            tree<Task>({ getChildren: (row) => row.children, defaultExpandedDepth: 3 })
        ]
    })
}

const costsOf = (built: ReturnType<typeof flatGrid>) =>
    built.preWindowNodes.map((node) => [node.id, node.row.cost] as const)

describe('a formula column on a tree, parent rows and children alike', () => {
    it('computes every level of the flat shape', () => {
        expect(costsOf(flatGrid())).toEqual([
            ['1', 200],
            ['2', 150],
            ['3', 80],
            ['4', 100]
        ])
    })

    it('computes every level of the nested shape', () => {
        expect(costsOf(nestedGrid())).toEqual([
            ['1', 200],
            ['2', 150],
            ['3', 80],
            ['4', 100]
        ])
    })

    it('leaves the source rows untouched, children included', () => {
        void nestedGrid().preWindowNodes
        expect(nested[0]!.cost).toBeUndefined()
        expect(nested[0]!.children![0]!.cost).toBeUndefined()
    })

    it('sorts a level by what the formula computed', () => {
        const built = flatGrid()
        built.api.setSort?.([{ columnId: 'cost', direction: 'desc' }])

        expect(built.preWindowNodes.map((node) => node.id)).toEqual(['1', '2', '3', '4'])
        expect(built.preWindowNodes.map((node) => node.row.cost)).toEqual([200, 150, 80, 100])
    })

    it('filters on the computed value and keeps the survivors reachable', () => {
        const built = flatGrid()
        built.api.setColumnFilter?.('cost', { kind: 'number', op: 'gt', value: 90 })

        expect(built.preWindowNodes.map((node) => node.id).sort()).toEqual(['1', '2', '4'])
    })

    it('holds the level a row sits at, so the tree is still a tree', () => {
        const built = nestedGrid()
        expect(built.preWindowNodes.map((node) => node.meta?.level ?? 0)).toEqual([0, 1, 2, 0])
    })

    it('recomputes the whole tree when the expression changes', () => {
        const built = nestedGrid()
        void built.preWindowNodes

        built.api.setFormula?.('cost', 'rate + hours')
        expect(costsOf(built)).toEqual([
            ['1', 102],
            ['2', 53],
            ['3', 24],
            ['4', 20]
        ])
    })

    it('computes a child that is expanded only later', () => {
        const built = createDataGrid<Task>({
            columns,
            data: nested,
            getRowId: (row) => String(row.id),
            features: [
                formula<Task>({ columns: { cost: 'rate * hours' } }),
                tree<Task>({ getChildren: (row) => row.children })
            ]
        })
        void built.preWindowNodes

        getTree(built)!.expandAll()
        expect(costsOf(built)).toEqual([
            ['1', 200],
            ['2', 150],
            ['3', 80],
            ['4', 100]
        ])
    })
})
