import { describe, expect, it, vi } from 'vitest'
import { createDataGrid, type GridState } from '../../core/grid/grid.svelte.js'
import type { ColumnDef } from '../../core/types.js'
import { filtering, getFiltering } from '../filtering/index.js'
import { getSorting, sorting } from '../sorting/index.js'
import { getRowPinning, rowPinning, type RowPinningOptions } from './index.js'

interface Metric {
    id: number
    name: string
    value: number
}

const metrics: Metric[] = [
    { id: 1, name: 'Total', value: 100 },
    { id: 2, name: 'Alpha', value: 30 },
    { id: 3, name: 'Beta', value: 20 },
    { id: 4, name: 'Gamma', value: 50 },
    { id: 5, name: 'Average', value: 25 }
]

const columns: ColumnDef<Metric>[] = [
    { id: 'name', sortable: true, filter: 'text' },
    { id: 'value', sortable: true }
]

function createGrid(options: RowPinningOptions<Metric> = {}): GridState<Metric> {
    return createDataGrid<Metric>({
        columns,
        data: metrics,
        getRowId: (metric) => String(metric.id),
        features: [filtering(), sorting(), rowPinning(options)]
    })
}

describe('rowPinning', () => {
    it('partitions initial pins out of the scrolling flow', () => {
        const grid = createGrid({
            isRowPinned: (metric) =>
                metric.name === 'Total' ? 'top' : metric.name === 'Average' ? 'bottom' : null
        })
        const state = getRowPinning(grid)!

        expect(state.topNodes.map((node) => node.row.name)).toEqual(['Total'])
        expect(state.bottomNodes.map((node) => node.row.name)).toEqual(['Average'])
        expect(grid.nodes.map((node) => node.row.name)).toEqual(['Alpha', 'Beta', 'Gamma'])
    })

    it('pinRow overrides isRowPinned and unpins back into the flow', () => {
        const grid = createGrid({ isRowPinned: (metric) => (metric.id === 1 ? 'top' : null) })
        const state = getRowPinning(grid)!
        const handler = vi.fn()
        grid.events.on('rowPinnedChanged', handler)

        state.pinRow('3', 'bottom')
        expect(handler).toHaveBeenCalledWith({ id: '3', side: 'bottom' })
        expect(grid.nodes.map((node) => node.row.name)).toEqual(['Alpha', 'Gamma', 'Average'])
        expect(grid.announcer.message).toBe('row pinned bottom')

        state.pinRow('1', null)
        expect(grid.nodes.map((node) => node.row.name)).toEqual([
            'Total',
            'Alpha',
            'Gamma',
            'Average'
        ])
        expect(grid.announcer.message).toBe('row unpinned')
        expect(state.getPinnedRows()).toMatchObject({ top: [], bottom: [{ name: 'Beta' }] })
    })

    it('pinned rows ignore filter and sort', () => {
        const grid = createGrid({ isRowPinned: (metric) => (metric.id === 1 ? 'top' : null) })
        const state = getRowPinning(grid)!

        getFiltering(grid)!.setQuickFilter('a')
        getSorting(grid)!.setSort([{ columnId: 'value', direction: 'asc' }])

        expect(state.topNodes.map((node) => node.row.name)).toEqual(['Total'])
        expect(grid.nodes.map((node) => node.row.name)).toEqual([
            'Beta',
            'Average',
            'Alpha',
            'Gamma'
        ])
    })

    it('contributes pin/unpin context-menu items per node', () => {
        const grid = createGrid()
        const feature = grid.features.find((entry) => entry.id === 'rowPinning')!
        const node = grid.sourceNodes[0]

        const items = feature.menuItems!({ grid, node })
        expect(items.map((item) => item.id)).toEqual(['pin-row-top', 'pin-row-bottom'])

        items[0].onSelect()
        expect(feature.menuItems!({ grid, node }).map((item) => item.id)).toEqual(['unpin-row'])
    })

    it('is a no-op passthrough with nothing pinned', () => {
        const grid = createGrid()
        expect(grid.nodes).toHaveLength(5)
        expect(getRowPinning(grid)!.pinnedCount).toBe(0)
    })
})
