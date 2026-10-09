import { type Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    grouping,
    pivot,
    rowPinning,
    tree,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Sale {
    id: number
    region: string
    product: string
    amount: number
}

const Typed = DataGrid as unknown as Component<DataGridProps<Sale>>

const REGIONS = ['North', 'South', 'East']
const PRODUCTS = ['Widget', 'Gadget']

const sales: Sale[] = REGIONS.flatMap((region, r) =>
    PRODUCTS.flatMap((product, p) =>
        Array.from({ length: 30 }, (_, at) => ({
            id: r * 100 + p * 30 + at,
            region,
            product,
            amount: at + 1
        }))
    )
)

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'product' },
    { id: 'amount', type: 'number' }
]

const build = (options: {
    by?: string[]
    sticky?: boolean
    virtual?: boolean
    pinned?: boolean
}): GridState<Sale> =>
    createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: (row) => String(row.id),
        stickyGroups: options.sticky ?? true,
        features: [
            ...(options.virtual === false ? [] : [virtualization<Sale>({ rowHeight: 40 })]),
            grouping<Sale>({ by: options.by ?? ['region'] }),
            ...(options.pinned
                ? [rowPinning<Sale>({ isRowPinned: (row) => (row.id === 0 ? 'top' : null) })]
                : [])
        ]
    })

const open = async (grid: GridState<Sale>) => {
    const screen = await render(Typed, { grid, class: 'h-[400px]' })
    await expect
        .poll(() => screen.container.querySelector('[role="grid"], [role="treegrid"]'))
        .not.toBeNull()
    return screen
}

const scrollTo = async (screen: { container: Element }, top: number) => {
    const viewport = screen.container.querySelector(
        '[role="grid"], [role="treegrid"]'
    ) as HTMLElement
    viewport.scrollTop = top
    viewport.dispatchEvent(new Event('scroll'))
    await new Promise((resolve) => setTimeout(resolve, 150))
    return viewport
}

const layer = (screen: { container: Element }) =>
    screen.container.querySelector('[data-dg-sticky-groups]')

const stuckLabels = (screen: { container: Element }): string[] =>
    Array.from(layer(screen)?.children ?? []).map(
        (row) => row.textContent?.replace(/\s+/g, ' ').trim() ?? ''
    )

describe('the group a reader is inside stays under the header', () => {
    it('shows nothing before the first group row has scrolled away', async () => {
        const screen = await open(build({}))
        expect(layer(screen)).toBeNull()
    })

    it('pins the group once its own row is above the fold', async () => {
        const screen = await open(build({}))
        await scrollTo(screen, 600)

        await expect.poll(() => layer(screen)).not.toBeNull()
        expect(stuckLabels(screen)[0]).toContain('North')
    })

    it('swaps to the next group when the reader scrolls into it', async () => {
        const screen = await open(build({}))
        await scrollTo(screen, 600)
        await expect.poll(() => stuckLabels(screen)[0] ?? '').toContain('North')

        await scrollTo(screen, 3200)
        await expect.poll(() => stuckLabels(screen)[0] ?? '').toContain('South')
    })

    it('stacks a line per level, outermost first', async () => {
        const screen = await open(build({ by: ['region', 'product'] }))
        await scrollTo(screen, 900)

        await expect.poll(() => stuckLabels(screen).length).toBe(2)
        const [outer, inner] = stuckLabels(screen)
        expect(outer).toContain('North')
        expect(inner).toContain('Widget')
    })

    it('goes away again when the reader scrolls back to the top', async () => {
        const screen = await open(build({}))
        await scrollTo(screen, 900)
        await expect.poll(() => layer(screen)).not.toBeNull()

        await scrollTo(screen, 0)
        await expect.poll(() => layer(screen)).toBeNull()
    })
})

describe('what the pinned lines are and are not', () => {
    it('is a signpost, so it adds no tab stop and no second announcement', async () => {
        const screen = await open(build({}))
        await scrollTo(screen, 600)
        await expect.poll(() => layer(screen)).not.toBeNull()

        const block = layer(screen)!
        expect(block.hasAttribute('inert')).toBe(true)
        expect(block.getAttribute('aria-hidden')).toBe('true')
        expect(block.querySelectorAll('[role="row"]').length).toBe(0)
        expect(block.querySelectorAll('[tabindex="0"]').length).toBe(0)
    })

    it('leaves the real group row in the grid, counted once', async () => {
        const screen = await open(build({}))
        await scrollTo(screen, 600)
        await expect.poll(() => layer(screen)).not.toBeNull()

        const ids = Array.from(
            screen.container.querySelectorAll('[role="row"][data-dg-row-id]')
        ).map((row) => row.getAttribute('data-dg-row-id'))

        expect(new Set(ids).size).toBe(ids.length)
    })

    it('sits under a row pinned to the top, not over it', async () => {
        const screen = await open(build({ pinned: true }))
        await scrollTo(screen, 900)
        await expect.poll(() => layer(screen)).not.toBeNull()

        const pinned = screen.container.querySelector('[role="rowgroup"].sticky.z-\\[9\\]')!
        const stuck = layer(screen)!

        expect(Math.round(stuck.getBoundingClientRect().top)).toBeGreaterThanOrEqual(
            Math.round(pinned.getBoundingClientRect().bottom) - 2
        )
    })
})

describe('when it does nothing at all', () => {
    it('stays out of the way when it was not asked for', async () => {
        const screen = await open(build({ sticky: false }))
        await scrollTo(screen, 900)

        expect(layer(screen)).toBeNull()
    })

    it('stays out of the way with nothing to be inside of', async () => {
        const grid = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (row) => String(row.id),
            stickyGroups: true,
            features: [virtualization<Sale>({ rowHeight: 40 })]
        })
        const screen = await open(grid)
        await scrollTo(screen, 900)

        expect(layer(screen)).toBeNull()
    })

    it('stays out of the way with no virtualization to say where the rows are', async () => {
        const screen = await open(build({ virtual: false }))
        await scrollTo(screen, 900)

        expect(layer(screen)).toBeNull()
    })
})

const openEveryBranch = <T>(grid: GridState<T>) => {
    for (let pass = 0; pass < 4; pass++) {
        for (const node of grid.preWindowNodes) {
            if (node.meta?.expandable) grid.expansion.expand(node.id)
        }
    }
}

describe('anything that gives a row a level gets the same signpost', () => {
    interface Node {
        id: number
        parent: number | null
        name: string
    }

    const TypedTree = DataGrid as unknown as Component<DataGridProps<Node>>

    it('pins the branch a reader is inside of, in tree data', async () => {
        const rows: Node[] = [
            { id: 1, parent: null, name: 'Root one' },
            ...Array.from({ length: 40 }, (_, at) => ({
                id: 100 + at,
                parent: 1,
                name: `leaf ${at}`
            })),
            { id: 2, parent: null, name: 'Root two' },
            ...Array.from({ length: 40 }, (_, at) => ({
                id: 200 + at,
                parent: 2,
                name: `other ${at}`
            }))
        ]

        const grid = createDataGrid<Node>({
            data: rows,
            columns: [{ id: 'name' }] as ColumnDef<Node>[],
            getRowId: (row) => String(row.id),
            stickyGroups: true,
            features: [
                virtualization<Node>({ rowHeight: 40 }),
                tree<Node>({
                    getParentId: (row) => (row.parent === null ? null : String(row.parent))
                })
            ]
        })

        const screen = await render(TypedTree, { grid, class: 'h-[400px]' })
        await expect
            .poll(() => screen.container.querySelector('[role="grid"], [role="treegrid"]'))
            .not.toBeNull()

        openEveryBranch(grid)
        await expect.poll(() => grid.preWindowNodes.length).toBeGreaterThan(40)

        const viewport = screen.container.querySelector(
            '[role="grid"], [role="treegrid"]'
        ) as HTMLElement
        viewport.scrollTop = 600
        viewport.dispatchEvent(new Event('scroll'))

        await expect
            .poll(() => screen.container.querySelector('[data-dg-sticky-groups]'))
            .not.toBeNull()
        expect(screen.container.querySelector('[data-dg-sticky-groups]')?.textContent).toContain(
            'Root one'
        )
    })

    it('pins the row field of a crossing, which is a group like any other', async () => {
        const grid = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (row) => String(row.id),
            stickyGroups: true,
            features: [
                virtualization<Sale>({ rowHeight: 40 }),
                pivot<Sale>({
                    rows: ['region', 'amount'],
                    columns: ['product'],
                    values: [{ field: 'amount', agg: 'sum' }]
                })
            ]
        })

        const screen = await open(grid)
        openEveryBranch(grid)
        await expect.poll(() => grid.preWindowNodes.length).toBeGreaterThan(30)

        const viewport = screen.container.querySelector(
            '[role="grid"], [role="treegrid"]'
        ) as HTMLElement
        viewport.scrollTop = 400
        viewport.dispatchEvent(new Event('scroll'))

        await expect.poll(() => layer(screen)).not.toBeNull()
        expect(stuckLabels(screen).length).toBeGreaterThan(0)
    })
})

describe('the demo page', () => {
    it('sticks on each of its three grids, and the switch turns it off', async () => {
        const { default: StickyDemo } = await import('../routes/sticky/+page.svelte')
        const screen = await render(StickyDemo as never)
        await expect
            .poll(() => screen.container.querySelectorAll('[role="treegrid"]').length)
            .toBe(3)

        const viewports = Array.from(
            screen.container.querySelectorAll<HTMLElement>('[role="treegrid"]')
        )
        for (const viewport of viewports) {
            viewport.scrollTop = 700
            viewport.dispatchEvent(new Event('scroll'))
        }

        await expect
            .poll(() => screen.container.querySelectorAll('[data-dg-sticky-groups]').length)
            .toBe(3)

        const twoLevels = screen.container.querySelectorAll('[data-dg-sticky-groups]')[1]
        expect(Number(twoLevels?.getAttribute('data-dg-sticky-groups'))).toBe(2)

        await page.getByRole('button', { name: 'Đang bật', exact: true }).click()
        await expect
            .poll(() => screen.container.querySelectorAll('[data-dg-sticky-groups]').length)
            .toBe(0)
    })
})
