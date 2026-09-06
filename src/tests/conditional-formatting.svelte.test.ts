import {
    createDataGrid,
    sorting,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'
import axe from 'axe-core'
import type { Component } from 'svelte'
import InRoot from './InRoot.svelte'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import DataGrid from '../lib/components/grid/DataGrid.svelte'
import {
    conditionalFormatting,
    getConditionalFormatting
} from '../lib/features/conditional-formatting/conditional-formatting.svelte.js'
import type { ConditionalFormattingOptions } from '../lib/features/conditional-formatting/conditional-formatting.types.js'
import { formula } from '../lib/features/formula/formula.svelte.js'
import { serverRowModel } from '../lib/features/server-row-model/server-row-model.svelte.js'
import type { DataSource } from '../lib/features/server-row-model/server-row-model.types.js'

interface Deal {
    id: number
    owner: string
    status: string
    unit: number
    qty: number
    total?: number
}

const deals: Deal[] = [
    { id: 1, owner: 'Ann', status: 'open', unit: 100, qty: 1 },
    { id: 2, owner: 'Bob', status: 'overdue', unit: 400, qty: 1 },
    { id: 3, owner: 'Ann', status: 'open', unit: 200, qty: 1 }
]

const columns: ColumnDef<Deal>[] = [
    { id: 'owner', header: 'Owner', width: 140 },
    { id: 'status', header: 'Status', width: 140 },
    { id: 'unit', header: 'Unit', width: 120, align: 'right' },
    { id: 'total', header: 'Total', width: 120, align: 'right' }
]

const TypedGrid = DataGrid as unknown as Component<DataGridProps<Deal>>
// `serverRowModel()` contributes its own component, so a root is enough.
const TypedServerRows = InRoot as unknown as Component<Record<string, unknown>>

const inRoot = (grid: GridState<Deal>) => ({ props: { grid } })

function makeGrid(options: ConditionalFormattingOptions): GridState<Deal> {
    return createDataGrid<Deal>({
        columns,
        data: deals,
        getRowId: (deal) => String(deal.id),
        features: [
            sorting(),
            formula<Deal>({ columns: { total: 'unit * qty' } }),
            conditionalFormatting<Deal>(options)
        ]
    })
}

async function renderGrid(grid: GridState<Deal>) {
    const screen = await render(TypedGrid, { grid })
    await expect.element(screen.getByRole('grid')).toBeVisible()
    return screen
}

function renderedRowIds(container: Element): string[] {
    return [...container.querySelectorAll('[role="row"][data-dg-row-id]')].map(
        (row) => row.getAttribute('data-dg-row-id') ?? ''
    )
}

function cellAt(container: Element, row: number, col: number): HTMLElement {
    return container.querySelector<HTMLElement>(`[data-dg-cell="${row}:${col}"]`)!
}

describe('conditional formatting paints the rendered grid', () => {
    it('writes the colour scale onto the cell it belongs to', async () => {
        const screen = await renderGrid(
            makeGrid({ rules: [{ kind: 'colorScale', column: 'unit' }] })
        )

        expect(cellAt(screen.container, 1, 2).style.backgroundColor).not.toBe('')
        expect(cellAt(screen.container, 1, 0).style.backgroundColor).toBe('')
    })

    it('paints a formula column, whose value exists only after the pipeline ran', async () => {
        const screen = await renderGrid(makeGrid({ rules: [{ kind: 'dataBar', column: 'total' }] }))

        expect(cellAt(screen.container, 1, 3).style.backgroundImage).toContain('linear-gradient')
    })

    it('repaints when a rule is added at runtime', async () => {
        const grid = makeGrid({})
        const screen = await renderGrid(grid)
        expect(cellAt(screen.container, 1, 1).className).not.toContain('bg-tertiary')

        grid.api.addFormatRule?.({
            kind: 'expression',
            id: 'overdue',
            when: 'status = "overdue"'
        })

        await expect.poll(() => cellAt(screen.container, 1, 1).className).toContain('bg-tertiary')
    })

    it('leaves the cell out of the accessibility tree changes it does not make', async () => {
        const screen = await renderGrid(
            makeGrid({ rules: [{ kind: 'colorScale', column: 'unit' }] })
        )

        expect(cellAt(screen.container, 0, 2).getAttribute('aria-selected')).toBeNull()
    })

    it('is axe-clean while painting', async () => {
        const screen = await renderGrid(
            makeGrid({
                rules: [
                    { kind: 'colorScale', column: 'unit' },
                    { kind: 'expression', when: 'status = "overdue"' }
                ]
            })
        )

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })
})

const SERVER_TOTAL = 120

function serverSource(): DataSource<Deal> {
    return {
        async getRows(request) {
            const rows: Deal[] = []
            for (let i = request.startRow; i < Math.min(request.endRow, SERVER_TOTAL); i++) {
                rows.push({
                    id: i + 1,
                    owner: `Owner ${i % 5}`,
                    status: i % 2 === 0 ? 'open' : 'overdue',
                    unit: (i + 1) * 10,
                    qty: 1
                })
            }
            return { rows, rowCount: SERVER_TOTAL }
        }
    }
}

describe('conditional formatting under virtualization and a server row model', () => {
    it('scales over every row the grid holds, not only the rendered window', async () => {
        const many: Deal[] = Array.from({ length: 200 }, (_, i) => ({
            id: i + 1,
            owner: `Owner ${i % 5}`,
            status: 'open',
            unit: i + 1,
            qty: 1
        }))
        const grid = createDataGrid<Deal>({
            columns,
            data: many,
            getRowId: (deal) => String(deal.id),
            features: [
                sorting(),
                virtualization({ rowHeight: 40 }),
                conditionalFormatting<Deal>({ rules: [{ kind: 'colorScale', column: 'unit' }] })
            ]
        })
        const screen = await render(TypedGrid, { grid, class: 'h-[400px]' })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        expect(renderedRowIds(screen.container).length).toBeLessThan(40)
        expect(cellAt(screen.container, 0, 2).style.backgroundColor).toContain('0%')
    })

    it('does not re-read the rows while the user scrolls', async () => {
        const many: Deal[] = Array.from({ length: 300 }, (_, i) => ({
            id: i + 1,
            owner: `Owner ${i % 5}`,
            status: 'open',
            unit: i + 1,
            qty: 1
        }))
        const grid = createDataGrid<Deal>({
            columns,
            data: many,
            getRowId: (deal) => String(deal.id),
            features: [
                sorting(),
                virtualization({ rowHeight: 40 }),
                conditionalFormatting<Deal>({ rules: [{ kind: 'colorScale', column: 'unit' }] })
            ]
        })
        const screen = await render(TypedGrid, { grid, class: 'h-[400px]' })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const viewport = screen.container.querySelector('[role="grid"]') as HTMLElement
        const before = grid.preWindowNodes
        const firstBefore = renderedRowIds(screen.container)[0]

        viewport.scrollTop = 4000
        viewport.dispatchEvent(new Event('scroll'))
        await expect.poll(() => renderedRowIds(screen.container)[0]).not.toBe(firstBefore)

        expect(grid.preWindowNodes).toBe(before)
        expect(renderedRowIds(screen.container).length).toBeLessThan(40)
    })

    it('paints nothing from a ranked rule on a server grid, placeholder or not', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = createDataGrid<Deal>({
            columns,
            data: [],
            getRowId: (deal) => String(deal.id),
            rowModel: 'server',
            features: [
                sorting(),
                virtualization({ rowHeight: 40 }),
                serverRowModel<Deal>(serverSource(), {
                    mode: 'infinite',
                    blockSize: 20,
                    placeholder: (index) => ({ id: -(index + 1) }) as Deal
                }),
                conditionalFormatting<Deal>({ rules: [{ kind: 'colorScale', column: 'unit' }] })
            ]
        })
        await render(TypedServerRows, inRoot(grid))
        const screen = await renderGrid(grid)

        await expect.poll(() => grid.data.length).toBeGreaterThan(0)
        await expect.poll(() => cellAt(screen.container, 0, 2).style.backgroundColor).toBe('')

        const state = getConditionalFormatting(grid)!
        const unit = grid.columns.visible.find((entry) => entry.id === 'unit')!
        const loading = grid.preWindowNodes.find((entry) => Number(entry.row.id) < 0)
        expect(loading, 'a block past the first should still be a placeholder').toBeDefined()
        expect(state.decoration(loading!, unit)).toBeUndefined()
        expect(state.skippedRules).toHaveLength(1)
        warn.mockRestore()
    })
})
