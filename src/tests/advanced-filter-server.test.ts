import { describe, expect, it, vi } from 'vitest'
import {
    advancedFilter,
    createDataGrid,
    getAdvancedFilter,
    serverRowModel,
    type ColumnDef,
    type GetRowsRequest,
    type GridState
} from '$lib/index.js'

interface Row {
    id: number
    name: string
    salary: number
}

const columns: ColumnDef<Row>[] = [{ id: 'name' }, { id: 'salary' }]

const tree = {
    kind: 'group' as const,
    join: 'and' as const,
    children: [{ kind: 'condition' as const, columnId: 'salary', op: 'gt' as const, value: 100000 }]
}

function serverGrid(withModel: boolean) {
    const seen: GetRowsRequest[] = []
    const grid: GridState<Row> = createDataGrid<Row>({
        columns,
        data: [],
        getRowId: (row) => String(row.id),
        rowModel: 'server',
        features: [
            advancedFilter<Row>(),
            ...(withModel
                ? [
                      serverRowModel<Row>(
                          {
                              getRows: async (request) => {
                                  seen.push(request)
                                  return { rows: [], rowCount: 0 }
                              }
                          },
                          { mode: 'paged' }
                      )
                  ]
                : [])
        ]
    })
    return { grid, seen }
}

describe('a tree the server answers counts as applied', () => {
    it('puts the tree on the request and reports itself applied', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { grid, seen } = serverGrid(true)
        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await vi.waitFor(() => expect(seen.length).toBeGreaterThan(0))

        getAdvancedFilter(grid)!.setModel(tree)
        await vi.waitFor(() => expect(seen.length).toBeGreaterThan(1))

        expect(seen.at(-1)!.advancedFilter).toBeDefined()
        expect(getAdvancedFilter(grid)!.isApplied).toBe(true)
        expect(warn).not.toHaveBeenCalled()
        warn.mockRestore()
    })

    it('still warns when nothing is there to send it', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const { grid } = serverGrid(false)

        getAdvancedFilter(grid)!.setModel(tree)
        void grid.preWindowNodes

        expect(getAdvancedFilter(grid)!.isApplied).toBe(false)
        expect(warn).toHaveBeenCalledTimes(1)
        expect(String(warn.mock.calls[0]![0])).toContain('request.advancedFilter')
        warn.mockRestore()
    })
})
