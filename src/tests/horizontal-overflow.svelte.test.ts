import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import {
    createDataGrid,
    DataGrid,
    rowPinning,
    sorting,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Cell {
    id: number
    region: string
    q1: number
    q2: number
    q3: number
    q4: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Cell>>

/** 160 + 4x140 = 720px of columns, rendered into a 320px viewport. */
const columns: ColumnDef<Cell>[] = [
    { id: 'region', header: 'Region', flex: 1, minWidth: 160 },
    { id: 'q1', header: 'Q1', width: 140 },
    { id: 'q2', header: 'Q2', width: 140 },
    { id: 'q3', header: 'Q3', width: 140 },
    { id: 'q4', header: 'Q4', width: 140 }
]

const data: Cell[] = [
    { id: 1, region: 'North', q1: 1, q2: 2, q3: 3, q4: 4 },
    { id: 2, region: 'South', q1: 5, q2: 6, q3: 7, q4: 8 },
    { id: 3, region: 'East', q1: 9, q2: 10, q3: 11, q4: 12 }
]

const VIEWPORT_WIDTH = 320
const CONTENT_WIDTH = 720

function makeGrid(pinFirstRow = false): GridState<Cell> {
    return createDataGrid<Cell>({
        columns,
        data,
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            rowPinning({ isRowPinned: (row) => (pinFirstRow && row.id === 1 ? 'top' : null) })
        ]
    })
}

async function renderNarrow(grid: GridState<Cell>) {
    const screen = await render(TypedDataGrid, { grid })
    screen.container.style.width = `${VIEWPORT_WIDTH}px`
    await expect.element(screen.getByRole('grid')).toBeVisible()
    return screen
}

function viewportOf(container: Element): HTMLElement {
    return container.querySelector<HTMLElement>('[role="grid"]')!
}

/** Header first, then pinned rows, then the body. */
function rowgroupsOf(container: Element): HTMLElement[] {
    return [...container.querySelectorAll<HTMLElement>('[role="rowgroup"]')]
}

describe('rows narrower than their columns', () => {
    it('scrolls horizontally rather than squashing the columns', async () => {
        const screen = await renderNarrow(makeGrid())
        const viewport = viewportOf(screen.container)

        expect(viewport.clientWidth).toBeLessThan(CONTENT_WIDTH)
        await expect.poll(() => viewport.scrollWidth).toBe(CONTENT_WIDTH)
    })

    it('paints every row across the full scroll width, not just the visible part', async () => {
        const screen = await renderNarrow(makeGrid())
        const viewport = viewportOf(screen.container)

        const rows = [...screen.container.querySelectorAll<HTMLElement>('[data-dg-row-id]')]
        expect(rows.length).toBeGreaterThan(0)
        for (const row of rows) {
            await expect
                .poll(() => Math.round(row.getBoundingClientRect().width))
                .toBe(viewport.scrollWidth)
        }
    })

    it('paints the header across the full scroll width', async () => {
        const screen = await renderNarrow(makeGrid())
        const viewport = viewportOf(screen.container)
        const header = rowgroupsOf(screen.container)[0]

        await expect
            .poll(() => Math.round(header.getBoundingClientRect().width))
            .toBe(viewport.scrollWidth)
    })

    it('paints pinned rows across the full scroll width', async () => {
        const screen = await renderNarrow(makeGrid(true))
        const viewport = viewportOf(screen.container)
        const pinned = rowgroupsOf(screen.container)[1]

        await expect
            .poll(() => Math.round(pinned.getBoundingClientRect().width))
            .toBe(viewport.scrollWidth)
    })

    it('still lets flex columns fill a wide viewport', async () => {
        const screen = await render(TypedDataGrid, { grid: makeGrid() })
        screen.container.style.width = '1200px'
        await expect.element(screen.getByRole('grid')).toBeVisible()
        const viewport = viewportOf(screen.container)

        await expect.poll(() => viewport.scrollWidth).toBe(viewport.clientWidth)
        const row = screen.container.querySelector<HTMLElement>('[data-dg-row-id]')!
        expect(Math.round(row.getBoundingClientRect().width)).toBe(viewport.clientWidth)
    })
})
