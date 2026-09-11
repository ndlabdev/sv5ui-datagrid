import { describe, expect, it, vi } from 'vitest'
import {
    createDataGrid,
    filtering,
    getFiltering,
    getSorting,
    serverRowModel,
    sorting,
    type ColumnDef,
    type GridState
} from '$lib/index.js'

interface Row {
    id: number
    name: string
    team: string
    salary: number
}

const columns: ColumnDef<Row>[] = [
    { id: 'name', sortable: true, filter: 'text' },
    { id: 'team', filter: 'text' },
    { id: 'salary' }
]

describe('applying a snapshot asks the server once', () => {
    it('does not fetch again for every slice it hydrates', async () => {
        const getRows = vi.fn(async () => ({ rows: [] as Row[], rowCount: 0 }))
        const grid: GridState<Row> = createDataGrid<Row>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [filtering(), sorting(), serverRowModel<Row>({ getRows }, { mode: 'paged' })]
        })
        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await vi.waitFor(() => expect(getRows.mock.calls.length).toBeGreaterThan(0))

        getFiltering(grid)!.setColumnFilter('team', {
            kind: 'text',
            op: 'contains',
            value: 'core'
        })
        getSorting(grid)!.setSort([{ columnId: 'name', direction: 'asc' }])
        await new Promise((resolve) => setTimeout(resolve, 300))

        const view = grid.api.getState()
        getFiltering(grid)!.clearColumnFilters()
        getSorting(grid)!.setSort([])
        await new Promise((resolve) => setTimeout(resolve, 300))

        const before = getRows.mock.calls.length
        grid.api.setState(view)
        await new Promise((resolve) => setTimeout(resolve, 300))

        expect(getRows.mock.calls.length - before).toBe(1)
    })
})
