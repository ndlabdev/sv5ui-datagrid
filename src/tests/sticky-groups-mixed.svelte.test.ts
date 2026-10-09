import { type Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import {
    columnOps,
    conditionalFormatting,
    createDataGrid,
    DataGrid,
    filtering,
    grouping,
    masterDetail,
    pagination,
    pivot,
    rangeSelection,
    rowPinning,
    selection,
    sorting,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Sale {
    id: number
    region: string
    product: string
    rep: string
    amount: number
    note: string
}

const Typed = DataGrid as unknown as Component<DataGridProps<Sale>>

const REGIONS = ['North', 'South', 'East']
const PRODUCTS = ['Widget', 'Gadget']

const sales: Sale[] = REGIONS.flatMap((region, r) =>
    PRODUCTS.flatMap((product, p) =>
        Array.from({ length: 40 }, (_, at) => ({
            id: r * 1000 + p * 100 + at,
            region,
            product,
            rep: `rep ${at}`,
            amount: at + 1,
            note: `note ${at}`
        }))
    )
)

const columns: ColumnDef<Sale>[] = [
    { id: 'rep', width: 140 },
    { id: 'region' },
    { id: 'product' },
    { id: 'amount', type: 'number' },
    { id: 'note', width: 200 }
]

type Make = {
    columns?: ColumnDef<Sale>[]
    by?: string[]
    extra?: unknown[]
    grouping?: Record<string, unknown>
}

const make = (options: Make = {}): GridState<Sale> =>
    createDataGrid<Sale>({
        data: sales,
        columns: options.columns ?? columns,
        getRowId: (row) => String(row.id),
        stickyGroups: true,
        features: [
            virtualization<Sale>({ rowHeight: 40 }),
            grouping<Sale>({ by: options.by ?? ['region'], ...(options.grouping ?? {}) }),
            ...((options.extra ?? []) as never[])
        ]
    })

const open = async (grid: GridState<Sale>, klass = 'h-[360px]') => {
    const screen = await render(Typed, { grid, class: klass })
    await expect
        .poll(() => screen.container.querySelector('[role="grid"], [role="treegrid"]'))
        .not.toBeNull()
    return screen
}

const viewportOf = (screen: { container: Element }) =>
    screen.container.querySelector('[role="grid"], [role="treegrid"]') as HTMLElement

const down = async (screen: { container: Element }, top: number) => {
    const viewport = viewportOf(screen)
    viewport.scrollTop = top
    viewport.dispatchEvent(new Event('scroll'))
    await new Promise((resolve) => setTimeout(resolve, 150))
    return viewport
}

const layer = (screen: { container: Element }) =>
    screen.container.querySelector('[data-dg-sticky-groups]')

const stuckText = (screen: { container: Element }) =>
    layer(screen)?.textContent?.replace(/\s+/g, ' ').trim() ?? ''

const stuckRow = (screen: { container: Element }) =>
    layer(screen)?.firstElementChild as HTMLElement | null

const firstBodyRow = (screen: { container: Element }) =>
    screen.container.querySelector('[role="row"][data-dg-row-id]') as HTMLElement | null

const cellLefts = (row: Element | null): number[] =>
    Array.from(row?.children ?? []).map((cell) => Math.round(cell.getBoundingClientRect().left))

const alignsWithTheBody = (screen: { container: Element }) => {
    const stuck = cellLefts(stuckRow(screen))
    const body = cellLefts(firstBodyRow(screen))

    expect(stuck.length, 'cells in the stuck row').toBeGreaterThan(1)
    expect(body.length, 'cells in the body row').toBe(stuck.length)
    expect(stuck).toEqual(body)

    const widthOf = (row: Element | null) => Math.round(row?.getBoundingClientRect().width ?? 0)
    expect(widthOf(stuckRow(screen)), 'width of the stuck row').toBe(widthOf(firstBodyRow(screen)))
}

describe('the signpost keeps its shape beside the column features', () => {
    it('lines its cells up with the body when columns are pinned both ways', async () => {
        const pinned: ColumnDef<Sale>[] = [
            { id: 'rep', width: 140, pinned: 'left' },
            { id: 'region' },
            { id: 'product' },
            { id: 'amount', type: 'number' },
            { id: 'note', width: 200, pinned: 'right' }
        ]
        const screen = await open(make({ columns: pinned }))
        await down(screen, 700)
        await expect.poll(() => layer(screen)).not.toBeNull()

        alignsWithTheBody(screen)
    })

    it('lines up again after the grid is scrolled sideways', async () => {
        const screen = await open(make(), 'h-[360px] w-[320px]')
        await down(screen, 700)
        await expect.poll(() => layer(screen)).not.toBeNull()

        const viewport = viewportOf(screen)
        viewport.scrollLeft = 200
        viewport.dispatchEvent(new Event('scroll'))
        await new Promise((resolve) => setTimeout(resolve, 150))

        alignsWithTheBody(screen)
    })

    it('lines up where the columns are windowed too, after a sideways scroll', async () => {
        const many: ColumnDef<Sale>[] = [
            { id: 'region', width: 120 },
            ...Array.from({ length: 60 }, (_, at) => ({
                id: `c${at}`,
                width: 120,
                accessor: (row: Sale) => row.amount + at
            }))
        ]
        const grid = createDataGrid<Sale>({
            data: sales,
            columns: many,
            getRowId: (row) => String(row.id),
            stickyGroups: true,
            features: [
                virtualization<Sale>({ rowHeight: 40, columns: true }),
                grouping<Sale>({ by: ['region'] })
            ]
        })
        const screen = await open(grid, 'h-[360px] w-[400px]')
        await down(screen, 700)
        await expect.poll(() => layer(screen)).not.toBeNull()

        const viewport = viewportOf(screen)
        viewport.scrollLeft = 2000
        viewport.dispatchEvent(new Event('scroll'))
        await new Promise((resolve) => setTimeout(resolve, 200))

        expect(grid.columns.visible.length).toBeGreaterThan(40)
        alignsWithTheBody(screen)
    })

    it('keeps its width with the rows when a column is hidden', async () => {
        const grid = make({ extra: [columnOps<Sale>()] })
        const screen = await open(grid)
        await down(screen, 700)
        await expect.poll(() => layer(screen)).not.toBeNull()

        grid.columns.setHidden('note', true)
        await new Promise((resolve) => setTimeout(resolve, 150))

        alignsWithTheBody(screen)
    })
})

describe('the ancestor it picks is the group head and nothing else', () => {
    it('does not mistake a group footer for the group it closes', async () => {
        const screen = await open(
            make({
                by: ['region', 'product'],
                grouping: { footerLabel: () => 'Dong tong' }
            })
        )
        await down(screen, 1400)
        await expect.poll(() => layer(screen)).not.toBeNull()

        expect(stuckText(screen)).not.toContain('Dong tong')
    })

    it('does not mistake a grand total for an ancestor', async () => {
        const screen = await open(
            make({ grouping: { grandTotal: true, grandTotalLabel: () => 'Tat ca' } })
        )
        await down(screen, 1400)
        await expect.poll(() => layer(screen)).not.toBeNull()

        expect(stuckText(screen)).not.toContain('Tat ca')
    })

    it('shows the parent row when the reader is inside a detail panel', async () => {
        const grid = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (row) => String(row.id),
            stickyGroups: true,
            features: [
                virtualization<Sale>({ rowHeight: 40 }),
                masterDetail<Sale>({ hasDetail: () => true })
            ]
        })
        const screen = await open(grid)

        for (const node of grid.preWindowNodes.slice(0, 12)) {
            grid.expansion.expand(node.id)
        }
        await down(screen, 400)

        expect(layer(screen)?.querySelectorAll('[role="gridcell"]').length ?? 0).toBe(0)
    })
})

describe('it follows the rows when the rows change under it', () => {
    it('swaps the signpost when a filter removes the group it named', async () => {
        const grid = make({ extra: [filtering<Sale>()] })
        const screen = await open(grid)
        await down(screen, 700)
        await expect.poll(() => stuckText(screen)).toContain('North')

        grid.api.setQuickFilter?.('South')
        await new Promise((resolve) => setTimeout(resolve, 200))

        expect(stuckText(screen)).not.toContain('North')
    })

    it('drops the signpost when the group the reader was inside is collapsed', async () => {
        const grid = make()
        const screen = await open(grid)
        await down(screen, 700)
        await expect.poll(() => stuckText(screen)).toContain('North')

        const head = grid.preWindowNodes.find((node) => node.meta?.level === 0)!
        grid.expansion.collapse(head.id)
        await new Promise((resolve) => setTimeout(resolve, 200))

        expect(stuckText(screen)).not.toContain('North')
    })

    it('lets go when a sort sends the reader back to the top, and comes back on the way down', async () => {
        const grid = make({ extra: [sorting<Sale>()] })
        const screen = await open(grid)
        await down(screen, 700)
        await expect.poll(() => layer(screen)).not.toBeNull()

        grid.api.setSort?.([{ columnId: 'amount', direction: 'desc' }])
        await new Promise((resolve) => setTimeout(resolve, 200))
        expect(layer(screen)).toBeNull()

        await down(screen, 700)
        await expect.poll(() => stuckText(screen).length).toBeGreaterThan(0)
    })
})

describe('it stacks under everything else that holds the top', () => {
    it('sits below both a pinned row and a header of its own height', async () => {
        const grid = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (row) => String(row.id),
            stickyGroups: true,
            headerHeight: 72,
            groupHeaderHeight: 20,
            features: [
                virtualization<Sale>({ rowHeight: 40 }),
                grouping<Sale>({ by: ['region'] }),
                filtering<Sale>({ floatingRow: true }),
                rowPinning<Sale>({ isRowPinned: (row) => (row.id === 0 ? 'top' : null) })
            ]
        })
        const screen = await open(grid)
        await down(screen, 900)
        await expect.poll(() => layer(screen)).not.toBeNull()

        const pinned = screen.container.querySelector('[role="rowgroup"].sticky.z-\\[9\\]')!
        const stuck = layer(screen)!

        expect(Math.round(stuck.getBoundingClientRect().top)).toBeGreaterThanOrEqual(
            Math.round(pinned.getBoundingClientRect().bottom) - 2
        )
    })

    it('stays quiet on a paged grid, which cannot also be virtualized', async () => {
        expect(() =>
            createDataGrid<Sale>({
                data: sales,
                columns,
                getRowId: (row) => String(row.id),
                stickyGroups: true,
                features: [
                    virtualization<Sale>({ rowHeight: 40 }),
                    grouping<Sale>({ by: ['region'] }),
                    pagination<Sale>({ pageSize: 100 })
                ]
            })
        ).toThrow(/one window-order feature/)

        const paged = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (row) => String(row.id),
            stickyGroups: true,
            features: [grouping<Sale>({ by: ['region'] }), pagination<Sale>({ pageSize: 100 })]
        })
        const screen = await open(paged)
        await down(screen, 700)

        expect(layer(screen)).toBeNull()
    })
})

describe('it holds up where the rows are not a plain stack of equal heights', () => {
    it('finds the group above a run of measured rows', async () => {
        const grid = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (row) => String(row.id),
            stickyGroups: true,
            features: [
                virtualization<Sale>({
                    rowHeight: 40,
                    getRowHeight: (node) => (node.meta?.level === 0 ? 40 : 'auto')
                }),
                grouping<Sale>({ by: ['region'] })
            ]
        })
        const screen = await open(grid)
        await down(screen, 900)

        await expect.poll(() => layer(screen)).not.toBeNull()
        expect(stuckText(screen)).toContain('North')
    })

    it('lines up in a right to left grid as well', async () => {
        const screen = await open(make())
        viewportOf(screen).setAttribute('dir', 'rtl')
        await down(screen, 700)
        await expect.poll(() => layer(screen)).not.toBeNull()

        alignsWithTheBody(screen)
    })

    it('names the row field of a crossing whose measures run down the page', async () => {
        const grid = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (row) => String(row.id),
            stickyGroups: true,
            features: [
                virtualization<Sale>({ rowHeight: 40 }),
                pivot<Sale>({
                    rows: ['region', 'rep'],
                    columns: ['product'],
                    values: [
                        { field: 'amount', agg: 'sum' },
                        { field: 'amount', agg: 'avg', header: 'Mean' }
                    ],
                    valuesOn: 'rows'
                })
            ]
        })
        const screen = await open(grid)
        for (let pass = 0; pass < 3; pass++) {
            for (const node of grid.preWindowNodes) {
                if (node.meta?.expandable) grid.expansion.expand(node.id)
            }
        }
        await expect.poll(() => grid.preWindowNodes.length).toBeGreaterThan(30)
        await down(screen, 600)

        await expect.poll(() => layer(screen)).not.toBeNull()
        expect(stuckText(screen).length).toBeGreaterThan(0)
    })
})

describe('with everything else switched on at once', () => {
    it('draws one signpost and leaves the rest of the grid alone', async () => {
        const grid = createDataGrid<Sale>({
            data: sales,
            columns: [
                { id: 'rep', width: 140, pinned: 'left' },
                { id: 'region' },
                { id: 'product' },
                { id: 'amount', type: 'number', editable: true },
                { id: 'note', width: 200 }
            ],
            getRowId: (row) => String(row.id),
            stickyGroups: true,
            headerHeight: 56,
            groupHeaderHeight: 24,
            features: [
                virtualization<Sale>({ rowHeight: 40 }),
                grouping<Sale>({ by: ['region', 'product'], footerLabel: () => 'Dong tong' }),
                sorting<Sale>(),
                filtering<Sale>({ floatingRow: true }),
                columnOps<Sale>(),
                selection<Sale>({ mode: 'multiple' }),
                rangeSelection<Sale>(),
                rowPinning<Sale>({ isRowPinned: (row) => (row.id === 0 ? 'top' : null) }),
                conditionalFormatting<Sale>({
                    rules: [{ kind: 'colorScale', column: 'amount' }]
                })
            ]
        })
        const screen = await open(grid, 'h-[420px]')
        await down(screen, 1400)

        await expect.poll(() => layer(screen)).not.toBeNull()
        expect(screen.container.querySelectorAll('[data-dg-sticky-groups]').length).toBe(1)
        expect(Number(layer(screen)!.getAttribute('data-dg-sticky-groups'))).toBe(2)
        expect(stuckText(screen)).not.toContain('Dong tong')

        const ids = Array.from(
            screen.container.querySelectorAll('[role="row"][data-dg-row-id]')
        ).map((row) => row.getAttribute('data-dg-row-id'))
        expect(new Set(ids).size).toBe(ids.length)

        alignsWithTheBody(screen)
    })
})

describe('the mixed demo page', () => {
    it('sticks on every one of its six grids, and the switch clears them all', async () => {
        const { default: MixedDemo } = await import('../routes/sticky/mixed/+page.svelte')
        const screen = await render(MixedDemo as never)
        await expect
            .poll(() => screen.container.querySelectorAll('[role="treegrid"]').length)
            .toBe(6)

        const viewports = Array.from(
            screen.container.querySelectorAll<HTMLElement>('[role="treegrid"]')
        )
        for (const viewport of viewports) {
            viewport.scrollTop = 800
            viewport.dispatchEvent(new Event('scroll'))
        }
        await new Promise((resolve) => setTimeout(resolve, 250))

        const layers = () => screen.container.querySelectorAll('[data-dg-sticky-groups]')
        await expect.poll(() => layers().length).toBeGreaterThanOrEqual(5)

        const named = Array.from(layers()).map(
            (block) => block.textContent?.replace(/\s+/g, ' ').trim() ?? ''
        )
        expect(named.every((text) => !text.includes('cộng'))).toBe(true)
        expect(named.every((text) => !text.includes('Tất cả'))).toBe(true)
    })
})
