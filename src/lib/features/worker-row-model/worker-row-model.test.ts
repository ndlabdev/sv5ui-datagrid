import { createDataGrid, type GridState } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { filtering } from '../../features/filtering/index.js'
import { sorting } from '../../features/sorting/index.js'
import { virtualization } from '../../features/virtualization/index.js'
import { describe, expect, it, vi } from 'vitest'
import { advancedFilter, getAdvancedFilter } from '../advanced-filter/index.js'
import { getServerRowModel, serverRowModel } from '../server-row-model/index.js'
import { workerDataSource } from './worker-row-model.js'

interface Sale {
    id: number
    rep: string
    total: number
    closedAt: string
}

const rows: Sale[] = Array.from({ length: 250 }, (_, i) => ({
    id: i + 1,
    rep: ['An', 'Binh', 'Chi', 'Dung'][i % 4]!,
    total: (i * 37) % 1000,
    closedAt: `2026-${String((i % 12) + 1).padStart(2, '0')}-15`
}))

const columns: ColumnDef<Sale>[] = [
    { id: 'rep', header: 'Rep', filter: 'text' },
    { id: 'total', header: 'Total', type: 'currency', filter: 'number' },
    { id: 'closedAt', header: 'Closed', type: 'date', filter: 'date' }
]

function makeGrid(source: ReturnType<typeof workerDataSource<Sale>>): GridState<Sale> {
    return createDataGrid<Sale>({
        columns,
        data: [],
        rowModel: 'server',
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            filtering(),
            advancedFilter<Sale>(),
            virtualization({ rowHeight: 40 }),
            serverRowModel<Sale>(source, {
                mode: 'infinite',
                blockSize: 50,
                placeholder: (index) => ({ id: -(index + 1) }) as Sale
            })
        ]
    })
}

function started(source: ReturnType<typeof workerDataSource<Sale>>): GridState<Sale> {
    const grid = makeGrid(source)
    getServerRowModel(grid)!.start()
    return grid
}

function inlineSource() {
    return workerDataSource<Sale>(rows, { columns, inline: true })
}

describe('a worker data source standing in for a server', () => {
    it('answers the first block and the total', async () => {
        const grid = started(inlineSource())

        await vi.waitFor(() => expect(grid.data.length).toBeGreaterThan(0))
        const model = grid.state.serverRowModel as { rowCount: number | null }
        expect(model.rowCount).toBe(rows.length)
        expect(grid.data[0]!.id).toBe(1)
    })

    it('refetches when the advanced filter tree changes, and applies it', async () => {
        const grid = started(inlineSource())
        await vi.waitFor(() => expect(grid.data.length).toBeGreaterThan(0))

        getAdvancedFilter(grid)!.setModel({
            kind: 'group',
            join: 'and',
            children: [{ kind: 'condition', columnId: 'rep', op: 'equals', value: 'Chi' }]
        })

        const model = grid.state.serverRowModel as { rowCount: number | null }
        await vi.waitFor(() =>
            expect(model.rowCount).toBe(rows.filter((row) => row.rep === 'Chi').length)
        )
        const loaded = grid.data.filter((row) => row.id > 0)
        expect(loaded.length).toBeGreaterThan(0)
        expect(loaded.every((row) => row.rep === 'Chi')).toBe(true)
    })

    it('applies a quick filter typed into the grid', async () => {
        const grid = started(inlineSource())
        await vi.waitFor(() => expect(grid.data.length).toBeGreaterThan(0))

        grid.api.setQuickFilter!('Chi')

        const model = grid.state.serverRowModel as { rowCount: number | null }
        await vi.waitFor(() =>
            expect(model.rowCount).toBe(rows.filter((row) => row.rep === 'Chi').length)
        )
    })

    it('sorts through the source rather than on the client', async () => {
        const grid = started(inlineSource())
        await vi.waitFor(() => expect(grid.data.length).toBeGreaterThan(0))

        grid.api.setSort!([{ columnId: 'total', direction: 'desc' }])
        await vi.waitFor(() => expect(grid.data[0]?.total).toBe(999))
    })

    it('refuses to group until the app says what a group row looks like', async () => {
        const source = inlineSource()
        await expect(
            source.getRows({
                startRow: 0,
                endRow: 10,
                sortModel: [],
                filterModel: { quick: '', quickFields: [], columns: {} },
                groupKeys: [],
                groupBy: ['rep']
            })
        ).rejects.toThrow(/groupRow/)
    })

    it('counts the groups, and hands back the rows under one when it is expanded', async () => {
        const source = workerDataSource<Sale>(rows, {
            columns,
            inline: true,
            groupRow: (keys, count) =>
                ({ id: -1, rep: String(keys.at(-1)), total: count, closedAt: '' }) as Sale
        })

        const top = await source.getRows({
            startRow: 0,
            endRow: 10,
            sortModel: [],
            filterModel: { quick: '', quickFields: [], columns: {} },
            groupKeys: [],
            groupBy: ['rep']
        })

        expect(top.rowCount).toBe(4)
        expect(top.rows.map((row) => row.rep)).toEqual(['An', 'Binh', 'Chi', 'Dung'])
        expect(top.rows.reduce((sum, row) => sum + row.total, 0)).toBe(rows.length)

        const children = await source.getRows({
            startRow: 0,
            endRow: 5,
            sortModel: [],
            filterModel: { quick: '', quickFields: [], columns: {} },
            groupKeys: ['Chi'],
            groupBy: ['rep']
        })

        expect(children.rowCount).toBe(rows.filter((row) => row.rep === 'Chi').length)
        expect(children.rows.every((row) => row.rep === 'Chi')).toBe(true)
    })

    it('reads a column through its accessor rather than refusing it', async () => {
        const withAccessor: ColumnDef<Sale>[] = [
            ...columns,
            { id: 'initial', header: 'Initial', accessor: (row) => row.rep.slice(0, 1) }
        ]
        const source = workerDataSource<Sale>(rows, { columns: withAccessor, inline: true })

        const result = await source.getRows({
            startRow: 0,
            endRow: 500,
            sortModel: [],
            filterModel: {
                quick: '',
                quickFields: [],
                columns: {
                    initial: {
                        join: 'and',
                        conditions: [{ kind: 'text', op: 'equals', value: 'C' }]
                    }
                }
            },
            groupKeys: [],
            groupBy: []
        })

        expect(result.rowCount).toBe(rows.filter((row) => row.rep === 'Chi').length)
    })

    it('keeps a column sorting by its own comparator', async () => {
        const order = ['Dung', 'Chi', 'Binh', 'An']
        const withSortFn: ColumnDef<Sale>[] = columns.map((column) =>
            column.id === 'rep'
                ? {
                      ...column,
                      sortFn: (a: Sale, b: Sale) => order.indexOf(a.rep) - order.indexOf(b.rep)
                  }
                : column
        )
        const source = workerDataSource<Sale>(rows, { columns: withSortFn, inline: true })

        const result = await source.getRows({
            startRow: 0,
            endRow: 1,
            sortModel: [{ columnId: 'rep', direction: 'asc' }],
            filterModel: { quick: '', quickFields: [], columns: {} },
            groupKeys: [],
            groupBy: []
        })

        expect(result.rows[0]!.rep).toBe('Dung')
    })

    it('runs a column filter predicate the app wrote', async () => {
        const withPredicate: ColumnDef<Sale>[] = columns.map((column) =>
            column.id === 'total'
                ? {
                      ...column,
                      filter: {
                          type: 'number' as const,
                          predicate: (value: unknown) => Number(value) % 100 === 0
                      }
                  }
                : column
        )
        const source = workerDataSource<Sale>(rows, { columns: withPredicate, inline: true })

        const result = await source.getRows({
            startRow: 0,
            endRow: 500,
            sortModel: [],
            filterModel: {
                quick: '',
                quickFields: [],
                columns: {
                    total: { join: 'and', conditions: [{ kind: 'number', op: 'gt', value: 0 }] }
                }
            },
            groupKeys: [],
            groupBy: []
        })

        expect(result.rowCount).toBe(rows.filter((row) => row.total % 100 === 0).length)
    })

    it('searches the text an app says a column is drawn with', async () => {
        const source = workerDataSource<Sale>(rows, {
            columns,
            inline: true,
            searchText: (value, column) =>
                column.id === 'total' ? `$${Number(value).toLocaleString('en-US')}` : undefined
        })

        const result = await source.getRows({
            startRow: 0,
            endRow: 500,
            sortModel: [],
            filterModel: { quick: '$999', quickFields: ['total'], columns: {} },
            groupKeys: [],
            groupBy: []
        })

        expect(result.rowCount).toBe(rows.filter((row) => row.total === 999).length)
        expect(result.rowCount).toBeGreaterThan(0)
    })

    it('says plainly when it is not on a worker', () => {
        expect(inlineSource().usingWorker).toBe(false)
    })
})
