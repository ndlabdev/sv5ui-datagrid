import {
    createDataGrid,
    DataGrid,
    filtering,
    pagination,
    sorting,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridState,
    type SortState
} from '$lib/index.js'
import axe from 'axe-core'
import type { Component } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { isLoadingRow } from '../lib/core/grid/index.js'
import { InGrid } from './fixtures/in-root.js'
import {
    getServerRowModel,
    serverRowModel
} from '../lib/features/server-row-model/server-row-model.svelte.js'
import type {
    DataSource,
    GetRowsRequest
} from '../lib/features/server-row-model/server-row-model.types.js'

interface Row {
    id: number
    name: string
    region: string
    level?: number
}

const TOTAL = 350

const columns: ColumnDef<Row>[] = [
    { id: 'name', header: 'Name', sortable: true, width: 200, filter: 'text' },
    { id: 'region', header: 'Region', sortable: true, width: 160 }
]

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Row>>
const TypedProGrid = DataGrid as unknown as Component<DataGridProps<Row>>
const TypedRoot = InGrid

function makeRow(index: number): Row {
    return { id: index + 1, name: `Row ${index + 1}`, region: `R${index % 4}` }
}

function makeSource(): DataSource<Row> & { calls: GetRowsRequest[] } {
    const calls: GetRowsRequest[] = []
    return {
        calls,
        async getRows(request) {
            calls.push(request)
            const rows: Row[] = []
            for (let i = request.startRow; i < Math.min(request.endRow, TOTAL); i++) {
                rows.push(makeRow(i))
            }
            return { rows, rowCount: TOTAL }
        }
    }
}

function pagedGrid(source: DataSource<Row>): GridState<Row> {
    return createDataGrid<Row>({
        columns,
        data: [],
        getRowId: (row) => String(row.id),
        rowModel: 'server',
        features: [
            sorting(),
            filtering(),
            pagination({ pageSize: 25 }),
            serverRowModel(source, { mode: 'paged' })
        ]
    })
}

function infiniteGrid(source: DataSource<Row>): GridState<Row> {
    return createDataGrid<Row>({
        columns,
        data: [],
        getRowId: (row) => String(row.id),
        rowModel: 'server',
        features: [
            sorting(),
            virtualization({ rowHeight: 40 }),
            serverRowModel(source, {
                mode: 'infinite',
                blockSize: 100,
                placeholder: (index) => ({ id: -(index + 1) }) as Row
            })
        ]
    })
}

async function mount(grid: GridState<Row>) {
    const screen = await render(TypedRoot, { props: { grid } })
    return screen
}

describe('paged mode', () => {
    it('fetches the first page and reports the server total', async () => {
        const source = makeSource()
        const grid = pagedGrid(source)
        await mount(grid)

        await expect.poll(() => grid.data.length).toBe(25)
        expect(source.calls[0]).toMatchObject({ startRow: 0, endRow: 25 })
        expect(getServerRowModel(grid)!.rowCount).toBe(TOTAL)
        expect(grid.api.getState).toBeTypeOf('function')
    })

    it('refetches with the new window when the page changes', async () => {
        const source = makeSource()
        const grid = pagedGrid(source)
        await mount(grid)
        await expect.poll(() => grid.data.length).toBe(25)

        ;(grid.api.setPage as (page: number) => void)(3)
        await expect.poll(() => source.calls.length).toBeGreaterThan(1)
        expect(source.calls.at(-1)).toMatchObject({ startRow: 50, endRow: 75 })
        await expect.poll(() => grid.data[0]!.id).toBe(51)
    })

    it('sends the sort and filter model rather than sorting locally', async () => {
        const source = makeSource()
        const grid = pagedGrid(source)
        await mount(grid)
        await expect.poll(() => grid.data.length).toBe(25)

        ;(grid.api.setSort as (sort: SortState[]) => void)([
            { columnId: 'name', direction: 'desc' }
        ])
        await expect.poll(() => source.calls.length).toBeGreaterThan(1)
        expect(source.calls.at(-1)!.sortModel).toEqual([{ columnId: 'name', direction: 'desc' }])

        ;(grid.api.setQuickFilter as (query: string) => void)('row 4')
        await expect.poll(() => source.calls.at(-1)!.filterModel.quick).toBe('row 4')

        await expect
            .poll(() => grid.nodes.map((node) => node.row.id))
            .toEqual(grid.data.map((row) => row.id))
    })

    it('normalizes every column filter to conditions + join on the wire', async () => {
        const source = makeSource()
        const grid = pagedGrid(source)
        await mount(grid)
        await expect.poll(() => grid.data.length).toBe(25)

        const setColumnFilter = grid.api.setColumnFilter as (
            columnId: string,
            filter: unknown
        ) => void

        setColumnFilter('name', { kind: 'text', op: 'contains', value: 'row 1' })
        await expect
            .poll(() => source.calls.at(-1)!.filterModel.columns.name)
            .toEqual({
                join: 'and',
                conditions: [{ kind: 'text', op: 'contains', value: 'row 1' }]
            })

        setColumnFilter('name', {
            kind: 'group',
            join: 'or',
            conditions: [
                { kind: 'text', op: 'contains', value: 'row 1' },
                { kind: 'text', op: 'contains', value: 'row 2' }
            ]
        })
        await expect.poll(() => source!.calls.at(-1)!.filterModel.columns.name!.join).toBe('or')
        expect(source!.calls.at(-1)!.filterModel.columns.name!.conditions).toHaveLength(2)
    })

    it('surfaces a rejection instead of hanging on loading', async () => {
        const onError = vi.fn()
        const failing: DataSource<Row> = {
            getRows: () => Promise.reject(new Error('gateway timeout'))
        }
        const grid = createDataGrid<Row>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [pagination({ pageSize: 25 }), serverRowModel(failing, { onError })]
        })
        await mount(grid)

        const model = getServerRowModel(grid)!
        await expect.poll(() => model.error).toBe('gateway timeout')
        expect(model.loading).toBe(false)
        expect(onError).toHaveBeenCalled()
    })
})

describe('infinite mode', () => {
    it('loads the first block and pads the rest with placeholders', async () => {
        const source = makeSource()
        const grid = infiniteGrid(source)
        await mount(grid)

        await expect.poll(() => grid.data.length).toBe(TOTAL)
        expect(source.calls[0]).toMatchObject({ startRow: 0, endRow: 100 })
        expect(isLoadingRow(grid.data[0])).toBe(false)
        expect(isLoadingRow(grid.data[300])).toBe(true)
    })

    it('fetches the blocks a scrolled range needs, once each', async () => {
        const source = makeSource()
        const grid = infiniteGrid(source)
        await mount(grid)
        await expect.poll(() => grid.data.length).toBe(TOTAL)

        const model = getServerRowModel(grid)!
        model.ensureRange(250, 320)
        await expect.poll(() => isLoadingRow(grid.data[260])).toBe(false)

        model.ensureRange(250, 320)
        const starts = source.calls.map((call) => call.startRow)
        expect(starts).toEqual([...new Set(starts)])
        expect(starts).toContain(200)
        expect(starts).toContain(300)
    })

    it('returns evicted blocks to placeholders instead of keeping their rows', async () => {
        const source = makeSource()
        const grid = createDataGrid<Row>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                virtualization({ rowHeight: 40 }),
                serverRowModel(source, {
                    mode: 'infinite',
                    blockSize: 100,
                    maxBlocks: 2,
                    placeholder: (index) => ({ id: -(index + 1) }) as Row
                })
            ]
        })
        await mount(grid)
        await expect.poll(() => grid.data.length).toBe(TOTAL)
        expect(isLoadingRow(grid.data[0])).toBe(false)

        const model = getServerRowModel(grid)!
        model.ensureRange(250, 320)
        await expect.poll(() => isLoadingRow(grid.data[260])).toBe(false)

        model.ensureRange(250, 320)
        expect(isLoadingRow(grid.data[0])).toBe(true)
    })

    it('starts over when the sort changes so pages cannot interleave', async () => {
        const source = makeSource()
        const grid = infiniteGrid(source)
        await mount(grid)
        await expect.poll(() => grid.data.length).toBe(TOTAL)

        getServerRowModel(grid)!.ensureRange(250, 320)
        await expect.poll(() => isLoadingRow(grid.data[260])).toBe(false)

        ;(grid.api.setSort as (sort: SortState[]) => void)([{ columnId: 'name', direction: 'asc' }])
        await expect.poll(() => source.calls.at(-1)!.startRow).toBe(0)
        await expect.poll(() => isLoadingRow(grid.data[260])).toBe(true)
    })
})

describe('infinite mode setup', () => {
    it('refuses to run without a placeholder, which would collide every row id', () => {
        expect(() =>
            createDataGrid<Row>({
                columns,
                data: [],
                getRowId: (row) => String(row.id),
                rowModel: 'server',
                features: [serverRowModel(makeSource(), { mode: 'infinite' })]
            })
        ).toThrow(/placeholder/)
    })

    it('refuses to run on a client-model grid, which would re-filter the page', () => {
        expect(() =>
            createDataGrid<Row>({
                columns,
                data: [],
                getRowId: (row) => String(row.id),
                features: [sorting(), filtering(), serverRowModel(makeSource())]
            })
        ).toThrow(/rowModel/)
    })

    it('announces the total, which paged mode gets from pagination and this does not', async () => {
        const totals: number[] = []
        const grid = createDataGrid<Row>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                virtualization(),
                serverRowModel(makeSource(), {
                    mode: 'infinite',
                    blockSize: 50,
                    placeholder: (index) => ({ id: -index - 1, name: '', region: '' })
                })
            ]
        })
        grid.events.on('rowCountChanged', ({ total }) => totals.push(total))

        const model = getServerRowModel<Row>(grid)!
        model.refresh()
        await expect.poll(() => totals).toEqual([TOTAL])

        model.ensureRange(50, 150)
        await expect.poll(() => grid.data[60]?.name).toBe('Row 61')
        expect(totals).toEqual([TOTAL])
    })
})

describe('stale replies', () => {
    it('discards a reply for a query the user has moved on from', async () => {
        let release: (() => void) | null = null
        const slow: DataSource<Row> = {
            getRows: (request) =>
                new Promise((resolve) => {
                    const finish = () =>
                        resolve({
                            rows: [
                                { id: 999, name: `stale ${request.sortModel.length}`, region: 'X' }
                            ],
                            rowCount: 1
                        })
                    if (release === null) release = finish
                    else finish()
                })
        }

        const grid = createDataGrid<Row>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [sorting(), pagination({ pageSize: 25 }), serverRowModel(slow)]
        })
        await mount(grid)
        await expect.poll(() => release !== null).toBe(true)

        ;(grid.api.setSort as (sort: SortState[]) => void)([
            { columnId: 'name', direction: 'desc' }
        ])
        release!()

        await expect.poll(() => grid.data.length).toBe(1)
        expect(grid.data[0]!.name).toBe('stale 1')
    })

    it('discards a slow reply from a page the user has already left', async () => {
        let releasePageTwo: (() => void) | null = null
        const source: DataSource<Row> = {
            getRows: (request) =>
                new Promise((resolve) => {
                    const finish = () => {
                        const rows: Row[] = []
                        for (let i = request.startRow; i < request.endRow; i++) {
                            rows.push(makeRow(i))
                        }
                        resolve({ rows, rowCount: TOTAL })
                    }
                    if (request.startRow === 25) releasePageTwo = finish
                    else finish()
                })
        }

        const grid = pagedGrid(source)
        await mount(grid)
        await expect.poll(() => grid.data[0]?.id).toBe(1)

        ;(grid.api.setPage as (page: number) => void)(2)
        await expect.poll(() => releasePageTwo !== null).toBe(true)
        ;(grid.api.setPage as (page: number) => void)(3)
        await expect.poll(() => grid.data[0]?.id).toBe(51)
        releasePageTwo!()

        await new Promise((resolve) => setTimeout(resolve, 0))
        expect(grid.data[0]!.id).toBe(51)
    })
})

describe('server-side group expand', () => {
    it('asks for children with the group key and splices them below the group', async () => {
        const groups: Row[] = [
            { id: 1, name: 'North', region: 'North', level: 0 },
            { id: 2, name: 'South', region: 'South', level: 0 }
        ]
        const calls: GetRowsRequest[] = []
        const source: DataSource<Row> = {
            async getRows(request) {
                calls.push(request)
                if (request.groupKeys.length === 0) return { rows: groups, rowCount: 2 }
                const key = String(request.groupKeys[0])
                return {
                    rows: [
                        { id: 10, name: `${key} child A`, region: key, level: 1 },
                        { id: 11, name: `${key} child B`, region: key, level: 1 }
                    ]
                }
            }
        }

        const grid = createDataGrid<Row>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                serverRowModel(source, {
                    groupBy: ['region'],
                    getRowMeta: (row) =>
                        row.level === 0 ? { level: 0, expandable: true } : { level: 1 },
                    groupKeysOf: (node) => [node.row.region],
                    isChildOf: () => (row) => row.level === 1
                })
            ]
        })

        await render(TypedRoot, { props: { grid } })
        await expect.poll(() => grid.data.length).toBe(2)

        grid.expansion.expand('1')
        await expect.poll(() => grid.data.length).toBe(4)
        expect(calls.at(-1)).toMatchObject({ groupKeys: ['North'], groupBy: ['region'] })
        expect(grid.data.map((row) => row.name)).toEqual([
            'North',
            'North child A',
            'North child B',
            'South'
        ])

        grid.expansion.collapse('1')
        await expect.poll(() => grid.data.length).toBe(2)
        expect(grid.data.map((row) => row.name)).toEqual(['North', 'South'])
    })
})

describe('rendering', () => {
    it('renders the server page through the grid', async () => {
        const source = makeSource()
        const grid = pagedGrid(source)
        const screen = await render(TypedDataGrid, { grid })

        await expect.element(screen.getByRole('grid')).toBeVisible()
        await expect.poll(() => grid.data.length).toBe(25)
        await expect
            .poll(() => screen.container.querySelector('[data-dg-cell="0:0"]')?.textContent?.trim())
            .toBe('Row 1')
    })
})

describe('a11y', () => {
    it('is axe-clean on a server page', async () => {
        const grid = pagedGrid(makeSource())
        const screen = await render(TypedDataGrid, { grid })
        await expect.poll(() => grid.data.length).toBe(25)

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })

    it('is axe-clean while placeholder rows are on screen', async () => {
        let release: (() => void) | null = null
        const slow: DataSource<Row> = {
            getRows: (request) =>
                new Promise((resolve) => {
                    release = () =>
                        resolve({
                            rows: Array.from(
                                { length: request.endRow - request.startRow },
                                (_, i) => makeRow(request.startRow + i)
                            ),
                            rowCount: TOTAL
                        })
                })
        }

        const grid = infiniteGrid(slow)
        const screen = await render(TypedDataGrid, { grid })

        await expect.poll(() => release !== null).toBe(true)
        release!()
        await expect.poll(() => grid.data.length).toBe(TOTAL)

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })
})

describe('what a server grid shows before its first answer', () => {
    it('does not tell the user there is no data while there is no answer yet', async () => {
        let release: (() => void) | undefined
        const held = new Promise<void>((resolve) => {
            release = resolve
        })

        const grid = createDataGrid<Row>({
            columns,
            data: [],
            rowModel: 'server',
            getRowId: (row) => String(row.id),
            features: [
                virtualization({ rowHeight: 40 }),
                serverRowModel<Row>(
                    {
                        async getRows(request) {
                            await held
                            const answer: Row[] = []
                            for (
                                let i = request.startRow;
                                i < Math.min(request.endRow, TOTAL);
                                i++
                            ) {
                                answer.push(makeRow(i))
                            }
                            return { rows: answer, rowCount: TOTAL }
                        }
                    },
                    {
                        mode: 'infinite',
                        blockSize: 10,
                        placeholder: (index) => ({ id: -(index + 1) }) as Row
                    }
                )
            ]
        })

        const screen = await render(TypedProGrid, { grid, class: 'h-[300px]' })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        expect(screen.container.textContent).not.toContain('No data')

        getServerRowModel(grid)!.start()
        expect(screen.container.textContent).not.toContain('No data')

        release!()
        await vi.waitFor(() => expect(getServerRowModel(grid)!.answered).toBe(true))
        expect(screen.container.textContent).not.toContain('No data')
    })

    it('still says so when the source really answers with nothing', async () => {
        const grid = createDataGrid<Row>({
            columns,
            data: [],
            rowModel: 'server',
            getRowId: (row) => String(row.id),
            features: [
                virtualization({ rowHeight: 40 }),
                serverRowModel<Row>(
                    {
                        async getRows() {
                            return { rows: [], rowCount: 0 }
                        }
                    },
                    {
                        mode: 'infinite',
                        blockSize: 10,
                        placeholder: (index) => ({ id: -(index + 1) }) as Row
                    }
                )
            ]
        })

        const screen = await render(TypedProGrid, { grid, class: 'h-[300px]' })
        getServerRowModel(grid)!.start()

        await vi.waitFor(() => expect(screen.container.textContent).toContain('No data'))
    })
})
