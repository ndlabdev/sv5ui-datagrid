import { createDataGrid, grouping, tree, type ColumnDef, type GridState } from '$lib/index.js'
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
    const bar = [...document.querySelectorAll('div')].find((node) =>
        /\d+( of \d+)? rows$/.test((node.textContent ?? '').trim())
    )
    return (bar?.textContent ?? '').replace(/\s+/g, ' ').trim()
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
        expect(await statusOf(grid)).toContain('60 rows')
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
        expect(await statusOf(grid)).toContain('24 rows')
    })

    it('takes a nested tree total from the whole hierarchy, not from its roots', async () => {
        const grid = createDataGrid<Unit>({
            columns: [{ id: 'name' }],
            data: units,
            getRowId: (unit) => String(unit.id),
            features: [tree({ getChildren: (unit) => unit.children, defaultExpandedDepth: 1 })]
        })
        expect(await statusOf(grid)).toContain('5 of 6 rows')
    })
})
