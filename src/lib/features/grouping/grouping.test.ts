import { createDataGrid, type GridState } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { sorting } from '../../features/sorting/index.js'
import { virtualization } from '../../features/virtualization/index.js'
import { describe, expect, it, vi } from 'vitest'
import { getGrouping, grouping } from './grouping.svelte.js'
import type { GroupingOptions } from './grouping.types.js'

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
    { id: 'name', header: 'Name' },
    { id: 'dept', header: 'Dept' },
    { id: 'country', header: 'Country' },
    { id: 'salary', header: 'Salary' }
]

function createGrid(options: GroupingOptions<Person> = {}): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (person) => String(person.id),
        features: [sorting(), grouping({ expandedByDefault: false, ...options })]
    })
}

const ids = (grid: GridState<Person>) => grid.nodes.map((node) => node.id)

describe('grouping feature', () => {
    it('leaves the pipeline untouched when nothing is grouped', () => {
        const grid = createGrid()
        expect(ids(grid)).toEqual(['1', '2', '3', '4'])
        expect(getGrouping(grid)!.isGrouped).toBe(false)
    })

    it('turns on treegrid mode through the kernel expansion model', () => {
        expect(createGrid().expansion.enabled).toBe(true)
    })

    it('emits collapsed group rows, then children once expanded', () => {
        const grid = createGrid({ by: ['dept'] })
        expect(ids(grid)).toEqual(['group:dept=Core', 'group:dept=Data'])

        grid.expansion.expand('group:dept=Core')
        expect(ids(grid)).toEqual(['group:dept=Core', '1', '2', '3', 'group:dept=Data'])
    })

    it('groups and ungroups through the api', () => {
        const grid = createGrid()
        const state = getGrouping(grid)!

        state.groupBy('dept')
        expect(state.by).toEqual(['dept'])
        state.groupBy('dept')
        expect(state.by).toEqual(['dept'])

        state.groupBy('country')
        expect(ids(grid)).toEqual(['group:dept=Core', 'group:dept=Data'])

        state.ungroup('dept')
        expect(state.by).toEqual(['country'])
        expect(ids(grid)).toEqual(['group:country=VN', 'group:country=US'])

        state.clearGrouping()
        expect(ids(grid)).toEqual(['1', '2', '3', '4'])
    })

    it('reorders grouping levels', () => {
        const state = getGrouping(createGrid({ by: ['dept', 'country'] }))!
        state.moveGroup('country', -1)
        expect(state.by).toEqual(['country', 'dept'])
        state.moveGroup('country', -1)
        expect(state.by).toEqual(['country', 'dept'])
        state.moveGroup('country', 1)
        expect(state.by).toEqual(['dept', 'country'])
    })

    it('lists only columns that are not grouped yet', () => {
        const state = getGrouping(createGrid({ by: ['dept'] }))!
        expect(state.groupableColumns().map((column) => column.id)).toEqual([
            'name',
            'country',
            'salary'
        ])
    })

    it('exposes aggregates on the group row', () => {
        const grid = createGrid({ by: ['dept'], aggregations: { salary: 'sum', id: 'count' } })
        const core = grid.nodes[0]!.row as unknown as Record<string, unknown>
        expect(core).toMatchObject({ dept: 'Core (3)', salary: 600, id: 3 })
    })

    it('puts the advanced aggregators on the group row too', () => {
        const grid = createGrid({
            by: ['dept'],
            aggregations: { salary: 'median', country: 'distinctCount', name: 'first' }
        })
        const core = grid.nodes[0]!.row as unknown as Record<string, unknown>
        expect(core).toMatchObject({ salary: 200, country: 2, name: 'Alice' })
    })

    it('reads the weight off the row, not off the aggregated column', () => {
        const grid = createGrid({
            by: ['dept'],
            aggregations: { salary: { kind: 'weightedAvg', weight: (person) => person.id } }
        })
        const core = grid.nodes[0]!.row as unknown as Record<string, unknown>
        expect(core.salary).toBeCloseTo((100 * 1 + 200 * 2 + 300 * 3) / 6)
    })

    it('groups by a hidden column, which is what grouping usually does to it', () => {
        const grid = createDataGrid<Person>({
            columns: columns.map((column) =>
                column.id === 'dept' ? { ...column, hidden: true } : column
            ),
            data: people,
            getRowId: (person) => String(person.id),
            features: [
                sorting(),
                grouping({
                    expandedByDefault: false,
                    by: ['dept'],
                    aggregations: { salary: 'sum' }
                })
            ]
        })
        expect(ids(grid)).toEqual(['group:dept=Core', 'group:dept=Data'])
        expect((grid.nodes[0]!.row as unknown as Record<string, unknown>).salary).toBe(600)
    })

    it('aggregates a hidden column instead of reading it as empty', () => {
        const grid = createDataGrid<Person>({
            columns: columns.map((column) =>
                column.id === 'salary' ? { ...column, hidden: true } : column
            ),
            data: people,
            getRowId: (person) => String(person.id),
            features: [
                sorting(),
                grouping({
                    expandedByDefault: false,
                    by: ['dept'],
                    aggregations: { salary: 'sum' }
                })
            ]
        })
        expect((grid.nodes[0]!.row as unknown as Record<string, unknown>).salary).toBe(600)
    })

    it('takes a new aggregation at runtime, and drops one on null', () => {
        const grid = createGrid({ by: ['dept'], aggregations: { salary: 'sum' } })
        const state = getGrouping(grid)!
        const groupRow = () => grid.nodes[0]!.row as unknown as Record<string, unknown>

        expect(groupRow().salary).toBe(600)

        state.setAggregation('salary', 'median')
        expect(groupRow().salary).toBe(200)

        const setAggregation = grid.api.setAggregation as (id: string, next: unknown) => void
        setAggregation('salary', 'max')
        expect(groupRow().salary).toBe(300)

        setAggregation('salary', null)
        expect(groupRow().salary).toBeUndefined()
    })

    it('recomputes aggregates when the grouping columns change', () => {
        const grid = createGrid({ by: ['dept'], aggregations: { salary: 'sum' } })
        const setGroupBy = grid.api.setGroupBy as (columnIds: string[]) => void

        setGroupBy(['country'])
        const first = grid.nodes[0]!.row as unknown as Record<string, unknown>
        expect(first.country).toBe('VN (2)')
        expect(first.salary).toBe(300)
    })

    it('contributes group/ungroup context-menu items per column', () => {
        const grid = createGrid()
        const feature = grid.features.find((entry) => entry.id === 'grouping')!

        expect(feature.menuItems!({ grid, columnId: 'dept' }).map((item) => item.id)).toEqual([
            'group-by-column'
        ])
        feature.menuItems!({ grid, columnId: 'dept' })[0]!.onSelect()
        expect(feature.menuItems!({ grid, columnId: 'dept' }).map((item) => item.id)).toEqual([
            'ungroup-column'
        ])
        expect(feature.menuItems!({ grid })).toEqual([])
    })

    it('expands every group and collapses them again', () => {
        const grid = createGrid({ by: ['dept'] })
        const state = getGrouping(grid)!

        state.expandAllGroups()
        expect(ids(grid)).toEqual(['group:dept=Core', '1', '2', '3', 'group:dept=Data', '4'])

        state.collapseAllGroups()
        expect(ids(grid)).toEqual(['group:dept=Core', 'group:dept=Data'])
    })
})

describe('state round-trip', () => {
    function twoGrids() {
        return [createGrid({ by: ['dept'] }), createGrid()] as const
    }

    it('carries the grouping into a snapshot and back out', () => {
        const [saved, fresh] = twoGrids()
        const snapshot = saved.api.getState()

        expect(snapshot.features?.grouping).toEqual({ by: ['dept'] })
        fresh.api.setState(snapshot)
        expect(getGrouping(fresh)!.by).toEqual(['dept'])
    })

    it('leaves an ungrouped grid out of the snapshot entirely', () => {
        expect(createGrid().api.getState().features?.grouping).toBeUndefined()
    })

    it('drops a column the grid no longer has', () => {
        const fresh = createGrid()
        fresh.api.setState({
            version: 1,
            features: { grouping: { by: ['dept', 'gone'] } }
        })
        expect(getGrouping(fresh)!.by).toEqual(['dept'])
    })

    it('ignores a slice of the wrong shape, leaving the grouping alone', () => {
        for (const slice of [null, 'dept', 42, { by: 'dept' }, {}]) {
            const fresh = createGrid({ by: ['dept'] })
            fresh.api.setState({ version: 1, features: { grouping: slice } })
            expect(getGrouping(fresh)!.by, JSON.stringify(slice)).toEqual(['dept'])
        }
    })

    it('reads a list of ids the grid does not have as no grouping', () => {
        const fresh = createGrid({ by: ['dept'] })
        fresh.api.setState({ version: 1, features: { grouping: { by: [1, 2] } } })
        expect(getGrouping(fresh)!.by).toEqual([])
    })
})

describe('grouping a grid whose rows come from a server', () => {
    function serverGrid(options: GroupingOptions<Person> = {}): GridState<Person> {
        return createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (person) => String(person.id),
            rowModel: 'server',
            features: [
                sorting(),
                virtualization(),
                grouping<Person>({ by: ['dept'], expandedByDefault: false, ...options })
            ]
        })
    }

    it('says every count is scoped to the rows it has, and warns once', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = serverGrid({ groupFooters: true, grandTotal: true })

        const label = (grid.nodes[0]!.row as unknown as Record<string, unknown>).dept
        expect(label).toBe('Core (3 loaded)')

        const total = grid.nodes.at(-1)!.row as unknown as Record<string, unknown>
        expect(String(total.dept)).toContain('loaded')

        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn.mock.calls[0]?.[0]).toContain('groups the rows the client has loaded')
        expect(getGrouping(grid)!.isPartial).toBe(true)
        expect((grid.api.isGroupingPartial as () => boolean)()).toBe(true)
        warn.mockRestore()
    })

    it('leaves a label the app wrote alone, scoped or not', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = serverGrid({ groupLabel: (key, count) => `${key}: ${count}` })

        expect((grid.nodes[0]!.row as unknown as Record<string, unknown>).dept).toBe('Core: 3')
        warn.mockRestore()
    })

    it('says nothing of the sort on a client grid', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = createGrid({ by: ['dept'] })

        expect((grid.nodes[0]!.row as unknown as Record<string, unknown>).dept).toBe('Core (3)')
        expect(getGrouping(grid)!.isPartial).toBe(false)
        expect(warn).not.toHaveBeenCalled()
        warn.mockRestore()
    })
})
