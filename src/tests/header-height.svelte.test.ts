import { type Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    filtering,
    pivot,
    rowPinning,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Sale {
    id: number
    region: string
    quarter: string
    product: string
    amount: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Sale>>

const sales: Sale[] = [
    { id: 1, region: 'North', quarter: 'Q1', product: 'Widget', amount: 100 },
    { id: 2, region: 'North', quarter: 'Q2', product: 'Gadget', amount: 150 },
    { id: 3, region: 'South', quarter: 'Q1', product: 'Widget', amount: 200 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'quarter' },
    { id: 'product' },
    { id: 'amount', type: 'number' }
]

const getRowId = (row: Sale) => String(row.id)

const crossed = (options: { headerHeight?: number; groupHeaderHeight?: number }): GridState<Sale> =>
    createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId,
        ...options,
        features: [
            columnOps<Sale>(),
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter', 'product'],
                values: [{ field: 'amount', agg: 'sum' }]
            })
        ]
    })

const heightOf = (selector: string): number => {
    const element = document.querySelector(selector)
    expect(element, selector).not.toBeNull()
    return Math.round(element!.getBoundingClientRect().height)
}

const leafHeader = '[role="columnheader"]:not([aria-expanded]):not([data-dg-header-cell])'
const tier = '[data-dg-header-cell]'

const grouped = (options: { headerHeight?: number; groupHeaderHeight?: number }): GridState<Sale> =>
    createDataGrid<Sale>({
        data: sales,
        columns: [
            { id: 'region' },
            {
                id: 'money',
                header: 'Money',
                children: [
                    { id: 'amount', type: 'number', columnGroupShow: 'closed' },
                    { id: 'quarter', columnGroupShow: 'open' },
                    { id: 'product', columnGroupShow: 'open' }
                ]
            }
        ] as ColumnDef<Sale>[],
        getRowId,
        ...options,
        features: [columnOps<Sale>()]
    })

const tiersAt = (): number[] =>
    Array.from(document.querySelectorAll(tier)).map((cell) =>
        Math.round(cell.getBoundingClientRect().height)
    )

describe('the height of a header row', () => {
    it('follows the row height when neither height is given', async () => {
        render(TypedDataGrid, { grid: crossed({}) })
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        const row = heightOf('[role="row"][data-dg-row-id] [role="gridcell"]')
        expect(heightOf(leafHeader)).toBe(row)
        expect(heightOf(tier)).toBe(row)
    })

    it('takes the leaf header on its own, leaving the tiers alone', async () => {
        render(TypedDataGrid, { grid: crossed({ headerHeight: 64 }) })
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        expect(heightOf(leafHeader)).toBe(64)
        expect(heightOf(tier)).not.toBe(64)
    })

    it('takes each group tier on its own, leaving the leaf header alone', async () => {
        render(TypedDataGrid, { grid: crossed({ groupHeaderHeight: 20 }) })
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        expect(heightOf(tier)).toBe(20)
        expect(heightOf(leafHeader)).not.toBe(20)
    })

    it('counts the group height per tier, so a deeper crossing is taller', async () => {
        const grid = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId,
            groupHeaderHeight: 24,
            features: [
                columnOps<Sale>(),
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter', 'product'],
                    values: [
                        { field: 'amount', agg: 'sum' },
                        { field: 'amount', agg: 'avg', header: 'Mean' }
                    ]
                })
            ]
        })
        render(TypedDataGrid, { grid })
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        const tiers = Array.from(document.querySelectorAll(tier))
        const levels = new Set(
            tiers.map((cell) => (cell.getAttribute('data-dg-header-cell') ?? '').split(':')[0])
        )
        expect(levels.size).toBeGreaterThan(1)

        for (const cell of tiers) {
            expect(Math.round(cell.getBoundingClientRect().height)).toBe(24)
        }
    })

    it('gives a plain grid the same two knobs, with no crossing involved', async () => {
        const grid = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId,
            headerHeight: 48
        })
        render(TypedDataGrid, { grid })
        await expect.element(page.getByRole('grid')).toBeVisible()

        expect(heightOf(leafHeader)).toBe(48)
    })
})

describe('the two heights stand apart from each other', () => {
    it('takes both at once, each on its own row', async () => {
        render(TypedDataGrid, { grid: crossed({ headerHeight: 56, groupHeaderHeight: 18 }) })
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        expect(heightOf(leafHeader)).toBe(56)
        expect(tiersAt().every((height) => height === 18)).toBe(true)
    })

    it('leaves the body row where it was', async () => {
        const grid = crossed({})
        render(TypedDataGrid, { grid })
        await expect.element(page.getByRole('treegrid')).toBeVisible()
        const plain = heightOf('[role="row"][data-dg-row-id] [role="gridcell"]')

        grid.headerHeight = 56
        grid.groupHeaderHeight = 18
        await expect.poll(() => heightOf(leafHeader)).toBe(56)

        expect(heightOf('[role="row"][data-dg-row-id] [role="gridcell"]')).toBe(plain)
    })

    it('leaves the filter row on the row height, not the header height', async () => {
        const grid = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId,
            headerHeight: 70,
            features: [filtering<Sale>({ floatingRow: true })]
        })
        render(TypedDataGrid, { grid })
        await expect.element(page.getByRole('grid')).toBeVisible()

        const filterCell = document.querySelector('[data-dg-cell^="-2:"]')
        expect(filterCell).not.toBeNull()

        const height = Math.round(filterCell!.getBoundingClientRect().height)
        expect(heightOf(leafHeader)).toBe(70)
        expect(height).not.toBe(70)
    })
})

describe('a header group that nobody generated', () => {
    it('takes the group height too, with no crossing in the grid', async () => {
        render(TypedDataGrid, { grid: grouped({ groupHeaderHeight: 26 }) })
        await expect.element(page.getByRole('grid')).toBeVisible()

        const tiers = tiersAt()
        expect(tiers.length).toBeGreaterThan(0)
        expect(tiers.every((height) => height === 26)).toBe(true)
    })

    it('keeps the fold control reachable at a short tier', async () => {
        render(TypedDataGrid, { grid: grouped({ groupHeaderHeight: 20 }) })
        await expect.element(page.getByRole('grid')).toBeVisible()

        const group = document.querySelector(`${tier}[aria-expanded]`)
        expect(group).not.toBeNull()

        const fold = group!.querySelector('button')
        expect(fold).not.toBeNull()

        const box = fold!.getBoundingClientRect()
        expect(box.width).toBeGreaterThan(0)
        expect(box.height).toBeGreaterThan(0)
    })

    it('still folds, and the leaf header keeps its own height', async () => {
        render(TypedDataGrid, { grid: grouped({ headerHeight: 44, groupHeaderHeight: 20 }) })
        await expect.element(page.getByRole('grid')).toBeVisible()

        const leaves = () => document.querySelectorAll(leafHeader).length
        const opened = leaves()

        const fold = document.querySelector(`${tier}[aria-expanded="true"] button`)
        expect(fold).not.toBeNull()
        ;(fold as HTMLElement).click()

        await expect.poll(leaves).toBeLessThan(opened)
        expect(heightOf(leafHeader)).toBe(44)
    })
})

describe('the heights move while the grid is open', () => {
    it('redraws the header when a height is set after the first paint', async () => {
        const grid = crossed({})
        render(TypedDataGrid, { grid })
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        const started = heightOf(leafHeader)
        grid.headerHeight = 60

        await expect.poll(() => heightOf(leafHeader)).toBe(60)
        expect(started).not.toBe(60)

        grid.groupHeaderHeight = 19
        await expect.poll(() => tiersAt()[0]).toBe(19)
    })

    it('goes back to the row height when a height is taken away again', async () => {
        const grid = crossed({ headerHeight: 60 })
        render(TypedDataGrid, { grid })
        await expect.element(page.getByRole('treegrid')).toBeVisible()
        expect(heightOf(leafHeader)).toBe(60)

        grid.headerHeight = undefined

        const row = heightOf('[role="row"][data-dg-row-id] [role="gridcell"]')
        await expect.poll(() => heightOf(leafHeader)).toBe(row)
    })
})

describe('what the heights do and do not take part in', () => {
    it('follows density while unset, and ignores it once set', async () => {
        const loose = crossed({})
        render(TypedDataGrid, { grid: loose })
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        const atStandard = heightOf(leafHeader)
        loose.density = 'compact'
        await expect.poll(() => heightOf(leafHeader)).toBeLessThan(atStandard)

        loose.headerHeight = 50
        await expect.poll(() => heightOf(leafHeader)).toBe(50)
        loose.density = 'comfortable'
        await expect.poll(() => heightOf(leafHeader)).toBe(50)
    })

    it('stays out of a saved view, being layout rather than arrangement', async () => {
        const grid = crossed({ headerHeight: 64, groupHeaderHeight: 20 })
        const snapshot = JSON.stringify(grid.api.getState!())

        expect(snapshot).not.toContain('headerHeight')
        expect(snapshot).not.toContain('groupHeaderHeight')
    })
})

describe('a row pinned to the top sticks under the header, not behind it', () => {
    const tall = (options: {
        headerHeight?: number
        groupHeaderHeight?: number
        withFilterRow?: boolean
        withTiers?: boolean
    }) =>
        createDataGrid<Sale>({
            data: Array.from({ length: 200 }, (_, at) => ({
                id: at + 1,
                region: at % 2 === 0 ? 'North' : 'South',
                quarter: 'Q1',
                product: 'Widget',
                amount: at
            })),
            columns: options.withTiers
                ? ([
                      { id: 'region' },
                      {
                          id: 'money',
                          header: 'Money',
                          children: [{ id: 'amount', type: 'number' }, { id: 'quarter' }]
                      }
                  ] as ColumnDef<Sale>[])
                : columns,
            getRowId,
            ...(options.headerHeight === undefined ? {} : { headerHeight: options.headerHeight }),
            ...(options.groupHeaderHeight === undefined
                ? {}
                : { groupHeaderHeight: options.groupHeaderHeight }),
            features: [
                virtualization<Sale>({ rowHeight: 40 }),
                ...(options.withFilterRow ? [filtering<Sale>({ floatingRow: true })] : []),
                rowPinning<Sale>({ isRowPinned: (row) => (row.id === 1 ? 'top' : null) })
            ]
        })

    const settle = async (container: Element) => {
        const viewport = container.querySelector('[role="grid"]') as HTMLElement
        viewport.scrollTop = 2000
        viewport.dispatchEvent(new Event('scroll'))
        await new Promise((resolve) => setTimeout(resolve, 150))
        return viewport
    }

    const gap = async (grid: GridState<Sale>): Promise<number> => {
        const screen = await render(TypedDataGrid, { grid, class: 'h-[400px]' })
        await expect.element(screen.getByRole('grid')).toBeVisible()
        await settle(screen.container)

        const header = screen.container.querySelector('.sticky.top-0')
        const pinned = screen.container.querySelector('[role="rowgroup"].sticky.z-\\[9\\]')
        expect(header, 'header').not.toBeNull()
        expect(pinned, 'pinned row group').not.toBeNull()

        return Math.round(
            pinned!.getBoundingClientRect().top - header!.getBoundingClientRect().bottom
        )
    }

    const HAIRLINE = 2

    const flushWithinTheHairlineBorders = async (grid: GridState<Sale>) => {
        const found = await gap(grid)
        expect(found).toBeLessThanOrEqual(0)
        expect(found).toBeGreaterThanOrEqual(-HAIRLINE)
    }

    it('sits flush under a header of the default height', async () => {
        await flushWithinTheHairlineBorders(tall({}))
    })

    it('sits flush under a header that was given its own height', async () => {
        await flushWithinTheHairlineBorders(tall({ headerHeight: 80 }))
    })

    it('sits flush under a header whose tiers were cut', async () => {
        await flushWithinTheHairlineBorders(tall({ withTiers: true, groupHeaderHeight: 20 }))
    })

    it('counts the filter row in the offset as well', async () => {
        await flushWithinTheHairlineBorders(tall({ headerHeight: 64, withFilterRow: true }))
    })

    it('counts a tall leaf and short tiers together', async () => {
        await flushWithinTheHairlineBorders(
            tall({ withTiers: true, headerHeight: 72, groupHeaderHeight: 18 })
        )
    })
})
