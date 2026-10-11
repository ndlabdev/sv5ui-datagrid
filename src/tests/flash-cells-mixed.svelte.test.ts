import { type Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    editing,
    filtering,
    flashCells,
    getFlashCells,
    getPivot,
    isPivotColumn,
    grouping,
    pagination,
    pivot,
    rowPinning,
    sorting,
    tree,
    virtualization,
    type ColumnDef,
    type ColumnState,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Tick {
    id: number
    desk: string
    symbol: string
    price: number
    size: number
}

const Typed = DataGrid as unknown as Component<DataGridProps<Tick>>

const seed = (): Tick[] =>
    Array.from({ length: 80 }, (_, at) => ({
        id: at + 1,
        desk: at % 2 === 0 ? 'A' : 'B',
        symbol: `S${at + 1}`,
        price: 100 + at,
        size: 10
    }))

const columns: ColumnDef<Tick>[] = [
    { id: 'symbol' },
    { id: 'desk' },
    { id: 'price', type: 'number' },
    { id: 'size', type: 'number' }
]

const make = (extra: unknown[] = [], duration = 60_000): GridState<Tick> =>
    createDataGrid<Tick>({
        data: seed(),
        columns,
        getRowId: (row) => String(row.id),
        features: [flashCells<Tick>({ duration }), ...(extra as never[])]
    })

const open = async (grid: GridState<Tick>, klass = 'h-[320px]') => {
    const screen = await render(Typed, { grid, class: klass })
    await expect
        .poll(() => screen.container.querySelector('[role="grid"], [role="treegrid"]'))
        .not.toBeNull()
    return screen
}

const marked = (screen: { container: Element }) =>
    Array.from(screen.container.querySelectorAll<HTMLElement>('[data-dg-cell]')).filter((cell) =>
        cell.style.outline.includes('solid')
    )

const settle = () => new Promise((resolve) => setTimeout(resolve, 150))

const change = async (grid: GridState<Tick>, ids: number[], by = 5) => {
    grid.data = grid.data.map((row) =>
        ids.includes(row.id) ? { ...row, price: row.price + by } : row
    )
    await settle()
}

const scroll = async (screen: { container: Element }, top: number) => {
    const viewport = screen.container.querySelector(
        '[role="grid"], [role="treegrid"]'
    ) as HTMLElement
    viewport.scrollTop = top
    viewport.dispatchEvent(new Event('scroll'))
    await settle()
}

describe('it stays quiet when only the view moved', () => {
    it('says nothing when the reader scrolls new rows into sight', async () => {
        const screen = await open(make([virtualization<Tick>({ rowHeight: 40 })]))
        await scroll(screen, 1200)

        expect(marked(screen)).toEqual([])
    })

    it('says nothing about a row that changed while it was out of sight', async () => {
        const grid = make([virtualization<Tick>({ rowHeight: 40 })])
        const screen = await open(grid)

        await change(grid, [70])
        expect(marked(screen)).toEqual([])

        await scroll(screen, 2400)
        expect(marked(screen)).toEqual([])
    })

    it('does not mark a row again when it comes back unchanged', async () => {
        const grid = make([virtualization<Tick>({ rowHeight: 40 })], 200)
        const screen = await open(grid)

        await change(grid, [1])
        await expect.poll(() => marked(screen).length).toBe(1)
        await expect.poll(() => marked(screen).length, { timeout: 3000 }).toBe(0)

        await scroll(screen, 2400)
        await scroll(screen, 0)

        expect(marked(screen)).toEqual([])
    })

    it('says nothing when a sort reorders the rows under it', async () => {
        const grid = make([sorting<Tick>(), virtualization<Tick>({ rowHeight: 40 })])
        const screen = await open(grid)

        grid.api.setSort?.([{ columnId: 'price', direction: 'desc' }])
        await settle()

        expect(marked(screen)).toEqual([])
    })

    it('says nothing when a filter changes which rows are on screen', async () => {
        const grid = make([filtering<Tick>(), virtualization<Tick>({ rowHeight: 40 })])
        const screen = await open(grid)

        grid.api.setQuickFilter?.('S7')
        await settle()

        expect(marked(screen)).toEqual([])
    })

    it('says nothing when a page turn brings a different set of rows', async () => {
        const grid = make([pagination<Tick>({ pageSize: 10 })])
        const screen = await open(grid)

        grid.api.setPage?.(3)
        await settle()

        expect(marked(screen)).toEqual([])
    })

    it('says nothing when a column is hidden and brought back', async () => {
        const grid = make([columnOps<Tick>()])
        const screen = await open(grid)

        grid.columns.setHidden('price', true)
        await settle()
        grid.columns.setHidden('price', false)
        await settle()

        expect(marked(screen)).toEqual([])
    })

    it('says nothing when a group is collapsed and opened again', async () => {
        const grid = make([grouping<Tick>({ by: ['desk'] })])
        const screen = await open(grid)

        const head = grid.preWindowNodes.find((node) => node.meta?.level === 0)!
        grid.expansion.collapse(head.id)
        await settle()
        grid.expansion.expand(head.id)
        await settle()

        expect(marked(screen)).toEqual([])
    })
})

describe('it keeps up with a stream rather than freezing marks', () => {
    it('lets an earlier batch go while a later one is still marked', async () => {
        const grid = make([], 400)
        const screen = await open(grid)

        await change(grid, [1])
        const first = marked(screen).map((cell) => cell.textContent?.trim())
        expect(first).toHaveLength(1)

        await change(grid, [2])
        await change(grid, [2])
        const later = marked(screen).map((cell) => cell.textContent?.trim())

        expect(later).not.toContain(first[0])
        expect(later).toHaveLength(1)

        await expect.poll(() => marked(screen).length, { timeout: 3000 }).toBe(0)
    })

    it('holds a batch together, every cell of it keeping the same clock', async () => {
        const grid = make([], 400)
        const screen = await open(grid)

        await change(grid, [1, 2, 3])
        expect(marked(screen)).toHaveLength(3)

        await expect.poll(() => marked(screen).length, { timeout: 3000 }).toBe(0)
    })

    it('marks a cell again when it changes a second time', async () => {
        const grid = make([], 200)
        const screen = await open(grid)

        await change(grid, [1])
        await expect.poll(() => marked(screen).length).toBe(1)
        await expect.poll(() => marked(screen).length, { timeout: 3000 }).toBe(0)

        await change(grid, [1])
        await expect.poll(() => marked(screen).length).toBe(1)
    })

    it('turns a long run of changes into marks that all let go', async () => {
        const grid = make([], 150)
        const screen = await open(grid)

        for (const id of [1, 2, 3, 4, 5]) {
            await change(grid, [id])
        }

        await expect.poll(() => marked(screen).length, { timeout: 4000 }).toBe(0)
    })
})

describe('beside the features that reshape the rows', () => {
    it('marks the crossing a change lands in', async () => {
        const grid = createDataGrid<Tick>({
            data: seed(),
            columns,
            getRowId: (row) => String(row.id),
            features: [
                flashCells<Tick>({ duration: 60_000 }),
                pivot<Tick>({
                    rows: ['desk'],
                    columns: ['size'],
                    values: [{ field: 'price', agg: 'sum' }]
                })
            ]
        })
        const screen = await open(grid)

        await change(grid, [1], 1000)

        await expect.poll(() => marked(screen).length).toBeGreaterThan(0)
    })

    it('marks the child that changed once its branch is open', async () => {
        interface Node {
            id: number
            parent: number | null
            name: string
            size: number
        }
        const TypedTree = DataGrid as unknown as Component<DataGridProps<Node>>
        const rows: Node[] = [
            { id: 1, parent: null, name: 'root', size: 0 },
            ...Array.from({ length: 6 }, (_, at) => ({
                id: 10 + at,
                parent: 1,
                name: `leaf ${at}`,
                size: at + 1
            }))
        ]
        const grid = createDataGrid<Node>({
            data: rows,
            columns: [{ id: 'name' }, { id: 'size', type: 'number' }] as ColumnDef<Node>[],
            getRowId: (row) => String(row.id),
            features: [
                flashCells<Node>({ duration: 60_000 }),
                tree<Node>({
                    getParentId: (row) => (row.parent === null ? null : String(row.parent))
                })
            ]
        })
        const screen = await render(TypedTree, { grid, class: 'h-[320px]' })
        await expect.poll(() => screen.container.querySelector('[role="treegrid"]')).not.toBeNull()

        for (const node of grid.preWindowNodes) {
            if (node.meta?.expandable) grid.expansion.expand(node.id)
        }
        await expect.poll(() => grid.preWindowNodes.length).toBeGreaterThan(1)
        await settle()

        grid.data = grid.data.map((row) => (row.id === 10 ? { ...row, size: 900 } : row))
        await settle()

        await expect.poll(() => marked(screen).length).toBe(1)
        expect(marked(screen)[0]?.textContent?.trim()).toContain('900')
    })

    it('marks a cell the reader edited, confirming the value took', async () => {
        const grid = createDataGrid<Tick>({
            data: seed(),
            columns: [
                { id: 'symbol' },
                { id: 'desk' },
                { id: 'price', type: 'number', editable: true },
                { id: 'size', type: 'number' }
            ],
            getRowId: (row) => String(row.id),
            features: [flashCells<Tick>({ duration: 60_000 }), editing<Tick>()]
        })
        const screen = await open(grid)

        await grid.api.applyEdits?.([{ rowId: '1', changes: { price: 4242 } }])
        await settle()

        await expect.poll(() => marked(screen).length).toBe(1)
        expect(marked(screen)[0]?.textContent?.trim()).toContain('4,242')
    })

    it('says nothing about a row pinned out of the body', async () => {
        const grid = make([
            rowPinning<Tick>({ isRowPinned: (row) => (row.id === 1 ? 'top' : null) })
        ])
        const screen = await open(grid)

        await change(grid, [1])
        await settle()

        const pinned = screen.container.querySelector('[role="rowgroup"].sticky.z-\\[9\\]')
        expect(pinned, 'the pinned row group').not.toBeNull()
        expect(
            Array.from(pinned!.querySelectorAll<HTMLElement>('[data-dg-pinned-cell]')).filter(
                (cell) => cell.style.outline.includes('solid')
            )
        ).toEqual([])
    })
})

describe('with the whole stack switched on', () => {
    it('marks only what changed, and lets go of all of it', async () => {
        const grid = createDataGrid<Tick>({
            data: seed(),
            columns: [
                { id: 'symbol', pinned: 'left' },
                { id: 'desk' },
                { id: 'price', type: 'number', editable: true },
                { id: 'size', type: 'number' }
            ],
            getRowId: (row) => String(row.id),
            stickyGroups: true,
            headerHeight: 52,
            features: [
                flashCells<Tick>({ duration: 200 }),
                virtualization<Tick>({ rowHeight: 40 }),
                grouping<Tick>({ by: ['desk'], aggregations: { price: 'sum' } }),
                sorting<Tick>(),
                filtering<Tick>({ floatingRow: true }),
                columnOps<Tick>(),
                editing<Tick>(),
                rowPinning<Tick>({ isRowPinned: () => null })
            ]
        })
        const screen = await open(grid, 'h-[380px]')

        await change(grid, [1, 3])
        await expect.poll(() => marked(screen).length).toBeGreaterThan(0)

        await expect.poll(() => marked(screen).length, { timeout: 3000 }).toBe(0)
        expect(getFlashCells(grid)).toBeDefined()
    })
})

describe('watching columns a crossing invented', () => {
    it('watches every crossing cell through a predicate, which a list cannot name', async () => {
        const grid = createDataGrid<Tick>({
            data: seed(),
            columns,
            getRowId: (row) => String(row.id),
            features: [
                flashCells<Tick>({
                    duration: 60_000,
                    columns: (column) => isPivotColumn(column.id)
                }),
                pivot<Tick>({
                    rows: ['desk'],
                    columns: ['size'],
                    values: [{ field: 'price', agg: 'sum' }]
                })
            ]
        })
        const screen = await open(grid)

        await change(grid, [1], 1000)

        await expect.poll(() => marked(screen).length).toBeGreaterThan(0)
        expect(marked(screen).every((cell) => /\d/.test(cell.textContent ?? ''))).toBe(true)
    })

    it('narrows to one measure of a crossing, which is what the ids hide', async () => {
        const grid = createDataGrid<Tick>({
            data: seed(),
            columns,
            getRowId: (row) => String(row.id),
            features: [
                flashCells<Tick>({
                    duration: 60_000,
                    columns: (column: ColumnState<Tick>): boolean =>
                        getPivot(grid)?.crossingMeasure(column.id) === 1
                }),
                pivot<Tick>({
                    rows: ['desk'],
                    columns: ['size'],
                    values: [
                        { field: 'price', agg: 'sum' },
                        { field: 'price', agg: 'avg', header: 'Mean' }
                    ]
                })
            ]
        })
        const screen = await open(grid)

        await change(grid, [1], 1000)

        const onlyMeasureOne = marked(screen).every(
            (cell) =>
                getPivot(grid)!.crossingMeasure(
                    grid.columns.visible[Number(cell.getAttribute('data-dg-cell')?.split(':')[1])]!
                        .id
                ) === 1
        )
        await expect.poll(() => marked(screen).length).toBeGreaterThan(0)
        expect(onlyMeasureOne).toBe(true)
    })

    it('still takes a plain list of declared ids', async () => {
        const grid = make([], 60_000)
        const screen = await open(grid)
        expect(marked(screen)).toEqual([])

        const narrowed = createDataGrid<Tick>({
            data: seed(),
            columns,
            getRowId: (row) => String(row.id),
            features: [flashCells<Tick>({ duration: 60_000, columns: ['price'] })]
        })
        const second = await open(narrowed)
        await change(narrowed, [1])

        await expect.poll(() => marked(second).length).toBe(1)
    })
})

describe('what a batch costs', () => {
    const countTimersOver = (floor: number) => {
        const real = window.setTimeout
        const state = { hung: 0 }
        window.setTimeout = ((handler: TimerHandler, ms?: number, ...rest: unknown[]) => {
            if (typeof ms === 'number' && ms > floor) state.hung += 1
            return (real as typeof window.setTimeout)(handler, ms, ...(rest as []))
        }) as typeof window.setTimeout
        return { state, undo: () => (window.setTimeout = real) }
    }

    it('spends one timer on a batch, however many cells it marks', async () => {
        const grid = make([], 60_000)
        const screen = await open(grid)
        const { state, undo } = countTimersOver(1000)

        try {
            await change(grid, [1, 2, 3, 4, 5, 6])

            expect(marked(screen).length).toBeGreaterThan(1)
            expect(state.hung).toBe(1)
        } finally {
            undo()
        }
    })

    it('hangs no timer where a sweep found nothing to mark', async () => {
        const grid = make([], 60_000)
        const screen = await open(grid)
        const { state, undo } = countTimersOver(1000)

        try {
            grid.data = grid.data.map((row) => ({ ...row }))
            await settle()

            expect(marked(screen)).toEqual([])
            expect(state.hung).toBe(0)
        } finally {
            undo()
        }
    })

    it('stops hanging timers once the last mark has let go', async () => {
        const grid = make([], 600)
        const screen = await open(grid)
        const { state, undo } = countTimersOver(500)

        try {
            await change(grid, [1])
            expect(marked(screen)).toHaveLength(1)

            await expect.poll(() => marked(screen).length, { timeout: 2000 }).toBe(0)
            const settled = state.hung
            for (let slice = 0; slice < 14; slice++) {
                await new Promise((resolve) => setTimeout(resolve, 100))
            }

            expect(state.hung).toBe(settled)
        } finally {
            undo()
        }
    })

    it('reads a column nobody watches fewer times than one it does', async () => {
        const tally = { narrow: 0, wide: 0 }
        const countingColumns = (into: 'narrow' | 'wide'): ColumnDef<Tick>[] => [
            { id: 'symbol' },
            { id: 'price', type: 'number' },
            {
                id: 'desk',
                accessor: (row) => {
                    tally[into] += 1
                    return row.desk
                }
            }
        ]
        const gridOf = (into: 'narrow' | 'wide', watch?: string[]) =>
            createDataGrid<Tick>({
                data: seed(),
                columns: countingColumns(into),
                getRowId: (row) => String(row.id),
                features: [
                    flashCells<Tick>({
                        duration: 60_000,
                        ...(watch ? { columns: watch } : {})
                    })
                ]
            })

        const narrow = gridOf('narrow', ['price'])
        const wide = gridOf('wide')
        await open(narrow)
        await open(wide)

        const from = { ...tally }
        narrow.data = narrow.data.map((row) => (row.id === 1 ? { ...row, price: 999 } : row))
        wide.data = wide.data.map((row) => (row.id === 1 ? { ...row, price: 999 } : row))
        await settle()

        expect(tally.narrow - from.narrow).toBeLessThan(tally.wide - from.wide)
    })
})
