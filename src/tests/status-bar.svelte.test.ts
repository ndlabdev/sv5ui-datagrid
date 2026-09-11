import {
    createDataGrid,
    filtering,
    getFiltering,
    grouping,
    rowPinning,
    tree,
    type ColumnDef,
    type GridFeature,
    type GridState
} from '$lib/index.js'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import DataGrid from '../lib/components/grid/DataGrid.svelte'

interface P {
    id: number
    team: string
    salary: number
}

interface Unit {
    id: number
    name: string
    children?: Unit[]
}

const people: P[] = Array.from({ length: 60 }, (_, index) => ({
    id: index + 1,
    team: `T${index % 5}`,
    salary: 100
}))

const units: Unit[] = [
    {
        id: 1,
        name: 'root a',
        children: [
            { id: 3, name: 'a1', children: [{ id: 5, name: 'a1x' }] },
            { id: 4, name: 'a2' }
        ]
    },
    { id: 2, name: 'root b', children: [{ id: 6, name: 'b1' }] }
]

function statusText(): string {
    const bars = [...document.querySelectorAll('div')]
        .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter((text) => /^\d+( of \d+)? rows$/.test(text))
    return bars.at(-1) ?? ''
}

async function statusOf<T>(grid: GridState<T>): Promise<string> {
    render(DataGrid as never, { grid } as never)
    await expect.poll(() => statusText()).not.toBe('')
    return statusText()
}

describe('the status bar counts rows, not the furniture around them', () => {
    const columns: ColumnDef<P>[] = [{ id: 'team' }, { id: 'salary' }]

    it('does not count a group header as a row', async () => {
        const grid = createDataGrid<P>({
            columns,
            data: people,
            getRowId: (person) => String(person.id),
            features: [grouping({ by: ['team'], aggregations: { salary: 'sum' } })]
        })
        expect(await statusOf(grid)).toBe('60 rows')
    })

    it('does not count a group footer or the grand total either', async () => {
        const grid = createDataGrid<P>({
            columns,
            data: people.slice(0, 24),
            getRowId: (person) => String(person.id),
            features: [
                grouping({
                    by: ['team'],
                    aggregations: { salary: 'sum' },
                    groupFooters: true,
                    grandTotal: true
                })
            ]
        })
        expect(await statusOf(grid)).toBe('24 rows')
    })

    it('takes a nested tree total from the whole hierarchy, not from its roots', async () => {
        const grid = createDataGrid<Unit>({
            columns: [{ id: 'name' }],
            data: units,
            getRowId: (unit) => String(unit.id),
            features: [tree({ getChildren: (unit) => unit.children, defaultExpandedDepth: 1 })]
        })
        expect(await statusOf(grid)).toBe('6 rows')
    })
})

interface Flat {
    id: number
    parentId: number | null
    name: string
}

const flatUnits: Flat[] = [
    { id: 1, parentId: null, name: 'root a' },
    { id: 2, parentId: null, name: 'root b' },
    { id: 3, parentId: 1, name: 'a1' },
    { id: 4, parentId: 1, name: 'a2' },
    { id: 5, parentId: 3, name: 'a1x' },
    { id: 6, parentId: 2, name: 'b1' }
]

describe('a tree reads the same collapsed as it does open', () => {
    it('on the nested shape', async () => {
        const shut = createDataGrid<Unit>({
            columns: [{ id: 'name' }],
            data: units,
            getRowId: (unit) => String(unit.id),
            features: [tree({ getChildren: (unit) => unit.children })]
        })
        const open = createDataGrid<Unit>({
            columns: [{ id: 'name' }],
            data: units,
            getRowId: (unit) => String(unit.id),
            features: [tree({ getChildren: (unit) => unit.children, defaultExpandedDepth: 9 })]
        })
        expect(await statusOf(shut)).toBe('6 rows')
        expect(await statusOf(open)).toBe('6 rows')
    })

    it('on the flat shape, where every row is already in data', async () => {
        const shut = createDataGrid<Flat>({
            columns: [{ id: 'name' }],
            data: flatUnits,
            getRowId: (unit) => String(unit.id),
            features: [
                tree({ getParentId: (unit) => (unit.parentId ? String(unit.parentId) : null) })
            ]
        })
        const open = createDataGrid<Flat>({
            columns: [{ id: 'name' }],
            data: flatUnits,
            getRowId: (unit) => String(unit.id),
            features: [
                tree({
                    getParentId: (unit) => (unit.parentId ? String(unit.parentId) : null),
                    defaultExpandedDepth: 9
                })
            ]
        })
        expect(await statusOf(shut)).toBe('6 rows')
        expect(await statusOf(open)).toBe('6 rows')
    })
})

describe('the status bar counts what a filter left, not what is open', () => {
    const columns: ColumnDef<P>[] = [{ id: 'team' }, { id: 'salary' }]

    function grouped(expandedByDefault: boolean, features: GridFeature<P>[] = []) {
        return createDataGrid<P>({
            columns,
            data: people,
            getRowId: (person) => String(person.id),
            features: [
                grouping({ by: ['team'], aggregations: { salary: 'sum' }, expandedByDefault }),
                ...features
            ]
        })
    }

    it('reads the same with every group shut as with every group open', async () => {
        expect(await statusOf(grouped(false))).toBe('60 rows')
        expect(await statusOf(grouped(true))).toBe('60 rows')
    })

    it('says N of M only when a filter actually narrowed something', async () => {
        const grid = grouped(false, [filtering()])
        getFiltering(grid)!.setQuickFilter('T0')
        expect(await statusOf(grid)).toBe('12 of 60 rows')
    })

    it('gives the same answer whether the matching groups are open or shut', async () => {
        const shut = grouped(false, [filtering()])
        getFiltering(shut)!.setQuickFilter('T0')
        const open = grouped(true, [filtering()])
        getFiltering(open)!.setQuickFilter('T0')

        expect(await statusOf(shut)).toBe(await statusOf(open))
    })

    it('counts a pinned row once, not twice', async () => {
        const grid = createDataGrid<P>({
            columns,
            data: people,
            getRowId: (person) => String(person.id),
            features: [rowPinning()]
        })
        grid.api.pinRow?.('1', 'top')
        expect(await statusOf(grid)).toBe('60 rows')
    })
})
