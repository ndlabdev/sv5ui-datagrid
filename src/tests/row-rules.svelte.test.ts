import { type Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import {
    createDataGrid,
    DataGrid,
    filtering,
    grouping,
    pivot,
    rowPinning,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Sale {
    id: number
    desk: string
    product: string
    amount: number
}

const Typed = DataGrid as unknown as Component<DataGridProps<Sale>>

const sales: Sale[] = ['A', 'B'].flatMap((desk, d) =>
    ['Widget', 'Gadget'].flatMap((product, p) =>
        Array.from({ length: 4 }, (_, at) => ({
            id: d * 100 + p * 10 + at,
            desk,
            product,
            amount: at + 1
        }))
    )
)

const columns: ColumnDef<Sale>[] = [
    { id: 'desk' },
    { id: 'product' },
    { id: 'amount', type: 'number' }
]

const open = async (grid: GridState<Sale>) => {
    const screen = await render(Typed, { grid })
    await expect
        .poll(() => screen.container.querySelector('[role="grid"], [role="treegrid"]'))
        .not.toBeNull()
    return screen
}

const hairline = (el: Element): string | null => {
    const after = getComputedStyle(el, '::after')
    if (after.height !== '1px' || after.bottom !== '0px') return null
    return after.backgroundColor
}

const topRuleOf = (row: Element): string | null => {
    for (const cell of row.querySelectorAll('[role="gridcell"]')) {
        const style = getComputedStyle(cell)
        if (style.borderTopWidth !== '0px') return style.borderTopColor
    }
    return null
}

const doubledRules = (screen: { container: Element }): string[] => {
    const rows = Array.from(screen.container.querySelectorAll('[role="row"][data-dg-row-id]'))
    const doubled: string[] = []

    for (let at = 1; at < rows.length; at++) {
        const above = hairline(rows[at - 1]!)
        const own = topRuleOf(rows[at]!)
        if (above && own && above === own) {
            doubled.push(rows[at]!.getAttribute('data-dg-row-id') ?? '?')
        }
    }

    return doubled
}

describe('one rule between two rows, never two of the same colour', () => {
    it('holds on a grouped grid closed by a grand total', async () => {
        const screen = await open(
            createDataGrid<Sale>({
                data: sales,
                columns,
                getRowId: (row) => String(row.id),
                features: [
                    grouping<Sale>({
                        by: ['desk'],
                        grandTotal: true,
                        grandTotalLabel: () => 'All',
                        footerLabel: (key) => `${key} total`
                    })
                ]
            })
        )

        expect(doubledRules(screen)).toEqual([])
    })

    it('holds on a crossing closed by a total row', async () => {
        const screen = await open(
            createDataGrid<Sale>({
                data: sales,
                columns,
                getRowId: (row) => String(row.id),
                features: [
                    pivot<Sale>({
                        rows: ['desk'],
                        columns: ['product'],
                        values: [{ field: 'amount', agg: 'sum' }],
                        totalRow: 'All',
                        totalColumn: 'Sum'
                    })
                ]
            })
        )

        expect(doubledRules(screen)).toEqual([])
    })

    it('holds with a filter row and a pinned row in the way', async () => {
        const screen = await open(
            createDataGrid<Sale>({
                data: sales,
                columns,
                getRowId: (row) => String(row.id),
                features: [
                    filtering<Sale>({ floatingRow: true }),
                    grouping<Sale>({
                        by: ['desk'],
                        grandTotal: true,
                        grandTotalLabel: () => 'All'
                    }),
                    rowPinning<Sale>({ isRowPinned: (row) => (row.id === 0 ? 'top' : null) })
                ]
            })
        )

        expect(doubledRules(screen)).toEqual([])
    })

    it('still marks the grand total apart, by weight and tint', async () => {
        const screen = await open(
            createDataGrid<Sale>({
                data: sales,
                columns,
                getRowId: (row) => String(row.id),
                features: [
                    grouping<Sale>({ by: ['desk'], grandTotal: true, grandTotalLabel: () => 'All' })
                ]
            })
        )

        const total = screen.container.querySelector('[data-dg-row-id="total:grand"]')
        expect(total, 'the grand total row').not.toBeNull()

        const cell = total!.querySelector('[role="gridcell"]')!
        const style = getComputedStyle(cell)
        expect(Number(style.fontWeight)).toBeGreaterThan(500)
        expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')
    })
})

describe('a pinned cell on a total row stays opaque, whatever tints the row', () => {
    const pinnedColumns: ColumnDef<Sale>[] = [
        { id: 'desk', pinned: 'left', width: 120 },
        { id: 'product', width: 160 },
        { id: 'amount', type: 'number', width: 140 }
    ]

    const opacityOf = (cell: Element): number => {
        const found = /\/\s*([\d.]+)\s*\)/.exec(getComputedStyle(cell).backgroundColor)
        return found ? Number(found[1]) : 1
    }

    it('holds on a grouped grid closed by a grand total', async () => {
        const screen = await open(
            createDataGrid<Sale>({
                data: sales,
                columns: pinnedColumns,
                getRowId: (row) => String(row.id),
                features: [
                    grouping<Sale>({ by: ['desk'], grandTotal: true, grandTotalLabel: () => 'All' })
                ]
            })
        )

        const total = screen.container.querySelector('[data-dg-row-id="total:grand"]')!
        const pinned = total.querySelector('[role="gridcell"].sticky')

        expect(pinned, 'the pinned cell of the grand total').not.toBeNull()
        expect(opacityOf(pinned!)).toBe(1)
    })

    it('holds on a crossing closed by a total row', async () => {
        const screen = await open(
            createDataGrid<Sale>({
                data: sales,
                columns: pinnedColumns,
                getRowId: (row) => String(row.id),
                features: [
                    pivot<Sale>({
                        rows: ['desk'],
                        columns: ['product'],
                        values: [{ field: 'amount', agg: 'sum' }],
                        totalRow: 'All'
                    })
                ]
            })
        )

        const total = screen.container.querySelector('[data-dg-row-id="total:grand"]')!
        const pinned = total.querySelector('[role="gridcell"].sticky')

        expect(pinned, 'the pinned cell of the total row').not.toBeNull()
        expect(opacityOf(pinned!)).toBe(1)
    })

    it('tints it the same colour a row with nothing pinned gets', async () => {
        const screen = await open(
            createDataGrid<Sale>({
                data: sales,
                columns: pinnedColumns,
                getRowId: (row) => String(row.id),
                features: [
                    grouping<Sale>({ by: ['desk'], grandTotal: true, grandTotalLabel: () => 'All' })
                ]
            })
        )

        const total = screen.container.querySelector('[data-dg-row-id="total:grand"]')!
        const cells = Array.from(total.querySelectorAll<HTMLElement>('[role="gridcell"]'))
        const tints = new Set(cells.map((cell) => getComputedStyle(cell).backgroundColor))

        expect(cells.length).toBeGreaterThan(1)
        expect(tints.size).toBe(1)
    })
})
