import {
    createDataGrid,
    filtering,
    virtualization,
    type ColumnDef,
    type GridFeature,
    type GridState
} from '$lib/index.js'
import { describe, expect, it, vi } from 'vitest'
import { advancedFilter, getAdvancedFilter } from '../lib/features/advanced-filter/index.js'
import { commandPalette, getCommandPalette } from '../lib/features/command-palette/index.js'
import { formula } from '../lib/features/formula/index.js'
import { isDetailNode, masterDetail } from '../lib/features/master-detail/index.js'
import { getSavedViews, savedViews } from '../lib/features/saved-views/index.js'
import {
    getServerRowModel,
    serverRowModel,
    type GetRowsRequest
} from '../lib/features/server-row-model/index.js'
import { getTree, tree } from '../lib/features/tree/index.js'

interface Row {
    id: number
    parentId: number | null
    name: string
    unit: number
    qty: number
    total?: number
}

const columns: ColumnDef<Row>[] = [
    { id: 'name', header: 'Name' },
    { id: 'unit', header: 'Unit' },
    { id: 'qty', header: 'Qty' },
    { id: 'total', header: 'Total' }
]

const TOTAL = 40
const BLOCK = 10

const table: Row[] = Array.from({ length: TOTAL }, (_, i) => ({
    id: i + 1,
    parentId: i % 4 === 0 ? null : i,
    name: `row ${i + 1}`,
    unit: (i + 1) * 10,
    qty: 2
}))

function serverGrid(extra: GridFeature<Row>[], served = BLOCK): GridState<Row> {
    return createDataGrid<Row>({
        columns,
        data: [],
        getRowId: (row) => String(row.id),
        rowModel: 'server',
        features: [
            virtualization(),
            serverRowModel<Row>(
                {
                    getRows: async ({ startRow, endRow }) => ({
                        rows: table.slice(startRow, Math.min(endRow, served)),
                        rowCount: TOTAL
                    })
                },
                {
                    mode: 'infinite',
                    blockSize: BLOCK,
                    placeholder: (index) => ({
                        id: -index - 1,
                        parentId: null,
                        name: '',
                        unit: 0,
                        qty: 0
                    })
                }
            ),
            ...extra
        ]
    })
}

async function loaded(grid: GridState<Row>): Promise<GridState<Row>> {
    grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
    await expect.poll(() => grid.data.length).toBe(TOTAL)
    return grid
}

const isPlaceholder = (row: unknown) => Number((row as Row).id) < 0

describe('formula on a server row model', () => {
    it('computes a loaded row and invents nothing for a row still on its way', async () => {
        const grid = await loaded(serverGrid([formula<Row>({ columns: { total: 'unit * qty' } })]))

        const first = grid.preWindowNodes[0]!.row as unknown as Record<string, unknown>
        expect(first.total).toBe(20)

        const waiting = grid.preWindowNodes.find((node) => isPlaceholder(node.row))!
        expect((waiting.row as unknown as Record<string, unknown>).total).toBeUndefined()
        expect(grid.data[0]!.total).toBeUndefined()
    })

    it('reads one row at a time, so nothing it shows depends on what else is loaded', async () => {
        const half = await loaded(
            serverGrid([formula<Row>({ columns: { total: 'unit * qty' } })], 5)
        )
        const all = await loaded(serverGrid([formula<Row>({ columns: { total: 'unit * qty' } })]))

        const totalOf = (grid: GridState<Row>) =>
            (grid.preWindowNodes[0]!.row as unknown as Record<string, unknown>).total

        expect(totalOf(half)).toBe(totalOf(all))
    })
})

describe('master detail on a server row model', () => {
    it('opens a panel under a loaded row', async () => {
        const grid = await loaded(serverGrid([masterDetail<Row>({})]))
        const before = grid.preWindowNodes.length

        grid.expansion.expand('1')
        await expect.poll(() => grid.preWindowNodes.length).toBe(before + 1)

        const panel = grid.preWindowNodes.find((node) => isDetailNode(node.id))
        expect(panel).toBeDefined()
    })

    it('offers no panel on a row that has not arrived', async () => {
        const grid = await loaded(
            serverGrid([masterDetail<Row>({ hasDetail: (row) => Number(row.id) > 0 })])
        )

        const waiting = grid.preWindowNodes.find((node) => isPlaceholder(node.row))!
        expect(waiting.meta?.expandable).not.toBe(true)
    })
})

describe('tree on a server row model', () => {
    it('never loses a loaded row: what is missing is collapsed, not gone', async () => {
        const grid = await loaded(
            serverGrid([
                tree<Row>({
                    getParentId: (row) => (row.parentId === null ? null : String(row.parentId))
                })
            ])
        )

        const collapsed = grid.preWindowNodes.length
        getTree(grid)!.expandAll()
        await expect.poll(() => grid.preWindowNodes.length).toBeGreaterThan(collapsed)

        const shown = new Set(grid.preWindowNodes.map((node) => node.id))
        const loadedIds = grid.data.filter((row) => row.id > 0).map((row) => String(row.id))
        expect(loadedIds.filter((id) => !shown.has(id))).toEqual([])
    })

    it('keeps a row whose parent has not arrived, at the root', async () => {
        const orphans: Row[] = table.map((row) => ({ ...row, parentId: 999 }))
        const grid = createDataGrid<Row>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                virtualization(),
                serverRowModel<Row>(
                    {
                        getRows: async ({ startRow, endRow }) => ({
                            rows: orphans.slice(startRow, Math.min(endRow, BLOCK)),
                            rowCount: TOTAL
                        })
                    },
                    {
                        mode: 'infinite',
                        blockSize: BLOCK,
                        placeholder: (index) => ({
                            id: -index - 1,
                            parentId: null,
                            name: '',
                            unit: 0,
                            qty: 0
                        })
                    }
                ),
                tree<Row>({ getParentId: (row) => String(row.parentId) })
            ]
        })
        await loaded(grid)

        const first = grid.preWindowNodes.find((node) => node.id === '1')
        expect(first, 'an orphan is a root, not a dropped row').toBeDefined()
        expect(first!.meta?.level ?? 0).toBe(0)
    })
})

describe('features that never read a row', () => {
    it('saved views round-trip on a server grid', async () => {
        const grid = await loaded(serverGrid([savedViews<Row>({ storage: null })]))
        const views = getSavedViews(grid)!

        views.save('one')
        expect(views.views.map((view) => view.name)).toEqual(['one'])

        views.apply(views.views[0]!.id)
        expect(grid.data.length).toBe(TOTAL)
    })

    it('the command palette lists column commands whatever the row model is', async () => {
        const grid = await loaded(serverGrid([commandPalette<Row>()]))
        const palette = getCommandPalette(grid)!

        palette.show()
        expect(palette.commands.length).toBeGreaterThan(0)
    })
})

describe('what the request tells a backend', () => {
    it('names the columns a quick filter meant, and carries the advanced tree', async () => {
        const seen: GetRowsRequest[] = []
        const grid = createDataGrid<Row>({
            columns,
            data: [],
            rowModel: 'server',
            getRowId: (row) => String(row.id),
            features: [
                filtering(),
                advancedFilter<Row>(),
                virtualization({ rowHeight: 40 }),
                serverRowModel<Row>(
                    {
                        async getRows(request) {
                            seen.push(request)
                            return {
                                rows: table.slice(request.startRow, request.endRow),
                                rowCount: TOTAL
                            }
                        }
                    },
                    {
                        mode: 'infinite',
                        blockSize: BLOCK,
                        placeholder: (index) => ({ id: -(index + 1) }) as Row
                    }
                )
            ]
        })

        getServerRowModel(grid)!.start()
        await vi.waitFor(() => expect(seen.length).toBeGreaterThan(0))
        expect(seen[0]!.filterModel.quickFields).toEqual(['name', 'unit', 'qty', 'total'])
        expect(seen[0]!.advancedFilter).toBeUndefined()

        getAdvancedFilter(grid)!.setModel({
            kind: 'group',
            join: 'and',
            children: [{ kind: 'condition', columnId: 'name', op: 'contains', value: 'row 1' }]
        })

        await vi.waitFor(() => expect(seen.length).toBeGreaterThan(1))
        expect(seen.at(-1)!.advancedFilter?.children).toHaveLength(1)
    })
})
