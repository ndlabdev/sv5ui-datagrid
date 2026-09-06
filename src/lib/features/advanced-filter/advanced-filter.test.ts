import { createDataGrid, type GridState } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { filtering } from '../../features/filtering/index.js'
import { sorting } from '../../features/sorting/index.js'
import { describe, expect, it, vi } from 'vitest'
import { advancedFilter, getAdvancedFilter } from './advanced-filter.svelte.js'
import { grouping } from '../grouping/index.js'
import type { AdvancedFilterOptions, FilterGroup } from './advanced-filter.types.js'

interface Sale {
    id: number
    region: string
    rep: string
    total: number
}

const columns: ColumnDef<Sale>[] = [
    { id: 'region', header: 'Region' },
    { id: 'rep', header: 'Rep' },
    { id: 'total', header: 'Total' }
]

const data: Sale[] = [
    { id: 1, region: 'North', rep: 'Alice', total: 120 },
    { id: 2, region: 'North', rep: 'Bob', total: 80 },
    { id: 3, region: 'South', rep: 'Alice', total: 300 },
    { id: 4, region: 'South', rep: 'Chi', total: 50 }
]

function createGrid(options: AdvancedFilterOptions<Sale> = {}): GridState<Sale> {
    return createDataGrid<Sale>({
        columns,
        data,
        getRowId: (row) => String(row.id),
        features: [sorting(), filtering(), advancedFilter<Sale>(options)]
    })
}

const ids = (grid: GridState<Sale>) => grid.nodes.map((node) => node.id)

const group = (children: FilterGroup['children'], join: 'and' | 'or' = 'and'): FilterGroup => ({
    kind: 'group',
    join,
    children
})

describe('the advanced filter feature', () => {
    it('ignores a condition that has no value yet, the way the free grid does', () => {
        const grid = createGrid()
        const state = getAdvancedFilter(grid)!

        state.setModel(group([{ kind: 'condition', columnId: 'region', op: 'equals', value: '' }]))
        expect(ids(grid)).toEqual(['1', '2', '3', '4'])
        expect(state.conditionCount).toBe(1)
        expect(state.activeCount).toBe(0)

        state.setModel(
            group([{ kind: 'condition', columnId: 'region', op: 'equals', value: 'South' }])
        )
        expect(ids(grid)).toEqual(['3', '4'])
        expect(state.activeCount).toBe(1)
    })

    it('waits for both ends of a between, and for a list to hold something', () => {
        const grid = createGrid()
        const state = getAdvancedFilter(grid)!

        state.setModel(group([{ kind: 'condition', columnId: 'total', op: 'between', value: 100 }]))
        expect(ids(grid)).toEqual(['1', '2', '3', '4'])

        state.setModel(
            group([{ kind: 'condition', columnId: 'total', op: 'between', value: 100, to: 200 }])
        )
        expect(ids(grid)).toEqual(['1'])

        state.setModel(group([{ kind: 'condition', columnId: 'rep', op: 'in', values: [] }]))
        expect(ids(grid)).toEqual(['1', '2', '3', '4'])
    })

    it('still tests presence with no value, because that is what blank means', () => {
        const grid = createGrid()
        getAdvancedFilter(grid)!.setModel(
            group([{ kind: 'condition', columnId: 'region', op: 'notBlank' }])
        )
        expect(ids(grid)).toEqual(['1', '2', '3', '4'])

        getAdvancedFilter(grid)!.setModel(
            group([{ kind: 'condition', columnId: 'region', op: 'blank' }])
        )
        expect(ids(grid)).toEqual([])
    })

    it('keeps every row until it holds a condition', () => {
        const grid = createGrid()
        expect(ids(grid)).toEqual(['1', '2', '3', '4'])
        expect(getAdvancedFilter(grid)!.isActive).toBe(false)
    })

    it('filters on a tree the per-column model could not express', () => {
        const grid = createGrid()
        getAdvancedFilter(grid)!.setModel(
            group(
                [
                    group([
                        { kind: 'condition', columnId: 'region', op: 'equals', value: 'North' },
                        { kind: 'condition', columnId: 'total', op: 'gte', value: 100 }
                    ]),
                    { kind: 'condition', columnId: 'rep', op: 'equals', value: 'Chi' }
                ],
                'or'
            )
        )

        expect(ids(grid)).toEqual(['1', '4'])
    })

    it('starts from the model an app hands it, and reports how many conditions it holds', () => {
        const grid = createGrid({
            model: group([{ kind: 'condition', columnId: 'total', op: 'gt', value: 100 }])
        })

        expect(ids(grid)).toEqual(['1', '3'])
        expect(getAdvancedFilter(grid)!.conditionCount).toBe(1)
    })

    it('tells an app every time the tree changes', () => {
        const onChange = vi.fn()
        const grid = createGrid({ onChange })

        getAdvancedFilter(grid)!.setModel(
            group([{ kind: 'condition', columnId: 'region', op: 'equals', value: 'South' }])
        )
        getAdvancedFilter(grid)!.clear()

        expect(onChange).toHaveBeenCalledTimes(2)
        expect(ids(grid)).toEqual(['1', '2', '3', '4'])
    })

    it('drives from the api the same way', () => {
        const grid = createGrid()
        const setAdvancedFilter = grid.api.setAdvancedFilter as (model: unknown) => void
        const clearAdvancedFilter = grid.api.clearAdvancedFilter as () => void

        setAdvancedFilter(
            group([{ kind: 'condition', columnId: 'rep', op: 'equals', value: 'Alice' }])
        )
        expect(ids(grid)).toEqual(['1', '3'])

        clearAdvancedFilter()
        expect(ids(grid)).toEqual(['1', '2', '3', '4'])
    })

    it('narrows what the quick filter already narrowed, rather than replacing it', () => {
        const grid = createGrid()
        const setQuickFilter = grid.api.setQuickFilter as (text: string) => void

        setQuickFilter('Alice')
        expect(ids(grid)).toEqual(['1', '3'])

        getAdvancedFilter(grid)!.setModel(
            group([{ kind: 'condition', columnId: 'total', op: 'gt', value: 200 }])
        )
        expect(ids(grid)).toEqual(['3'])
    })

    it('runs before grouping, so the groups count what survived', () => {
        const grid = createDataGrid<Sale>({
            columns,
            data,
            getRowId: (row) => String(row.id),
            features: [
                sorting(),
                advancedFilter<Sale>({
                    model: group([{ kind: 'condition', columnId: 'total', op: 'gte', value: 100 }])
                }),
                grouping<Sale>({ by: ['region'], expandedByDefault: false })
            ]
        })

        expect(grid.nodes.map((node) => node.row as unknown as Record<string, unknown>)).toEqual([
            expect.objectContaining({ region: 'North (1)' }),
            expect.objectContaining({ region: 'South (1)' })
        ])
    })

    it('keeps a row the app insists on, whatever the tree says', () => {
        const grid = createGrid({
            model: group([{ kind: 'condition', columnId: 'total', op: 'gt', value: 1_000 }]),
            alwaysKeep: (node) => node.id === '2'
        })

        expect(ids(grid)).toEqual(['2'])
    })

    it('refuses to filter a server grid, and says so once', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = createDataGrid<Sale>({
            columns,
            data,
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                sorting(),
                advancedFilter<Sale>({
                    model: group([{ kind: 'condition', columnId: 'total', op: 'gt', value: 100 }])
                })
            ]
        })

        expect(ids(grid)).toEqual(['1', '2', '3', '4'])
        expect(getAdvancedFilter(grid)!.isActive).toBe(true)
        expect(getAdvancedFilter(grid)!.isApplied).toBe(false)
        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn.mock.calls[0]?.[0]).toContain('does not filter a grid on rowModel')
        warn.mockRestore()
    })

    it('still holds and serializes the tree on a server grid, for the app to send onward', () => {
        const grid = createDataGrid<Sale>({
            columns,
            data,
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [sorting(), advancedFilter<Sale>()]
        })
        const model = group([{ kind: 'condition', columnId: 'rep', op: 'equals', value: 'Chi' }])

        getAdvancedFilter(grid)!.setModel(model)
        expect((grid.api.getAdvancedFilter as () => unknown)()).toEqual(model)
        expect(JSON.stringify(grid.getState())).toContain('"columnId":"rep"')
    })

    it('reports applied on a client grid, so a panel can say which it is', () => {
        const grid = createGrid({
            model: group([{ kind: 'condition', columnId: 'total', op: 'gt', value: 100 }])
        })
        expect(getAdvancedFilter(grid)!.isApplied).toBe(true)
        expect((grid.api.isAdvancedFilterApplied as () => boolean)()).toBe(true)
    })

    it('does not warn twice on a server row model', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = createDataGrid<Sale>({
            columns,
            data,
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                sorting(),
                advancedFilter<Sale>({
                    model: group([{ kind: 'condition', columnId: 'total', op: 'gt', value: 100 }])
                })
            ]
        })

        void grid.nodes.length
        getAdvancedFilter(grid)!.setModel(
            group([{ kind: 'condition', columnId: 'total', op: 'gt', value: 50 }])
        )
        void grid.nodes.length

        expect(warn).toHaveBeenCalledTimes(1)
        warn.mockRestore()
    })

    it('never drops a row that is still loading, so scrolling keeps working', () => {
        const grid = createGrid({
            model: group([{ kind: 'condition', columnId: 'total', op: 'gt', value: 1_000 }])
        })
        const loading = { __dgLoading: true, id: 9, region: '', rep: '', total: 0 }

        expect(
            getAdvancedFilter(grid)!.matches({
                id: '9',
                row: loading as unknown as Sale,
                index: 8
            })
        ).toBe(true)
    })

    it('round-trips through the grid snapshot', () => {
        const grid = createGrid()
        getAdvancedFilter(grid)!.setModel(
            group([{ kind: 'condition', columnId: 'region', op: 'equals', value: 'South' }])
        )
        expect(ids(grid)).toEqual(['3', '4'])

        const snapshot = grid.getState()
        getAdvancedFilter(grid)!.clear()
        expect(ids(grid)).toEqual(['1', '2', '3', '4'])

        grid.setState(snapshot)
        expect(ids(grid)).toEqual(['3', '4'])
    })

    it('saves the empty tree too, so restoring a view without one clears the filter', () => {
        const grid = createGrid()
        const empty = grid.getState()

        getAdvancedFilter(grid)!.setModel(
            group([{ kind: 'condition', columnId: 'region', op: 'equals', value: 'South' }])
        )
        expect(ids(grid)).toEqual(['3', '4'])

        grid.setState(empty)
        expect(ids(grid)).toEqual(['1', '2', '3', '4'])
    })

    it('restores without telling the app its own filter changed', () => {
        const onChange = vi.fn()
        const grid = createGrid({ onChange })
        const snapshot = grid.getState()

        grid.setState(snapshot)
        expect(onChange).not.toHaveBeenCalled()
    })

    it('refuses a tree that is not one, rather than throwing inside the pipeline', () => {
        const grid = createGrid()
        const setAdvancedFilter = grid.api.setAdvancedFilter as (model: unknown) => void

        for (const rubbish of [42, null, { kind: 'group' }, { kind: 'group', children: {} }]) {
            setAdvancedFilter(rubbish)
            expect(ids(grid)).toEqual(['1', '2', '3', '4'])
        }
    })

    it('keeps the conditions it can read out of a half-broken tree', () => {
        const grid = createGrid()
        const setAdvancedFilter = grid.api.setAdvancedFilter as (model: unknown) => void

        setAdvancedFilter({
            kind: 'group',
            join: 'and',
            children: [
                { kind: 'condition', columnId: 'region', op: 'equals', value: 'South' },
                { kind: 'condition', columnId: 'total', op: 'nonsense', value: 1 },
                'not a node'
            ]
        })

        expect(ids(grid)).toEqual(['3', '4'])
        expect(getAdvancedFilter(grid)!.conditionCount).toBe(1)
    })
})
