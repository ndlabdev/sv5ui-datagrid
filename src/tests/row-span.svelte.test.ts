import axe from 'axe-core'
import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    selection,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Entry {
    id: number
    region: string
    city: string
    revenue: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Entry>>

const regions = ['APAC', 'APAC', 'APAC', 'EMEA', 'EMEA', 'AMER']
const entries: Entry[] = Array.from({ length: 60 }, (_, i) => ({
    id: i + 1,
    region: regions[i % 6],
    city: `City ${i + 1}`,
    revenue: 1000 + i
}))

/** Length of the run of equal regions starting here; 1 inside a run. */
function regionRun(index: number): number {
    if (index > 0 && entries[index - 1].region === entries[index].region) return 1
    let n = 1
    while (index + n < entries.length && entries[index + n].region === entries[index].region) n++
    return n
}

const ROW_HEIGHT = 40

function makeGrid(options: { pinned?: boolean; virtual?: boolean } = {}): GridState<Entry> {
    const columns: ColumnDef<Entry>[] = [
        {
            id: 'region',
            header: 'Region',
            width: 140,
            pinned: options.pinned ? 'left' : undefined,
            rowSpan: (ctx) => regionRun(ctx.rowIndex)
        },
        { id: 'city', header: 'City', width: 400 },
        { id: 'revenue', header: 'Revenue', width: 400, align: 'right' }
    ]
    return createDataGrid<Entry>({
        columns,
        data: entries,
        getRowId: (entry) => String(entry.id),
        features: [
            selection<Entry>(),
            ...(options.virtual === false ? [] : [virtualization<Entry>({ rowHeight: ROW_HEIGHT })])
        ]
    })
}

const cell = (row: number, col: number) =>
    document.querySelector<HTMLElement>(`[data-dg-cell="${row}:${col}"]`)

/** The cell a point belongs to, so layering is read off the rendered page. */
function ownerAt(x: number, y: number): string {
    return (
        document.elementFromPoint(x, y)?.closest('[data-dg-cell]')?.getAttribute('data-dg-cell') ??
        'none'
    )
}

describe('rowSpan', () => {
    it('draws one cell for the run and none for the rows it covers', async () => {
        const screen = await render(TypedDataGrid, { grid: makeGrid() })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        // Rows 0-2 share a region, so only row 0 renders that column.
        expect(cell(0, 1)).not.toBeNull()
        expect(cell(1, 1)).toBeNull()
        expect(cell(2, 1)).toBeNull()
        // The next run starts its own cell.
        expect(cell(3, 1)).not.toBeNull()

        expect(cell(0, 1)!.getAttribute('aria-rowspan')).toBe('3')
        expect(cell(3, 1)!.getAttribute('aria-rowspan')).toBe('2')
        // A run of one carries no attribute at all.
        expect(cell(5, 1)!.getAttribute('aria-rowspan')).toBeNull()
    })

    it('sizes the cell to the rows it covers without stretching its neighbours', async () => {
        const screen = await render(TypedDataGrid, { grid: makeGrid() })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const fill = cell(0, 1)!.firstElementChild as HTMLElement
        expect(Math.round(fill.getBoundingClientRect().height)).toBe(3 * ROW_HEIGHT)

        // The cell itself keeps its row's height: growing it would grow the
        // row's grid track and stretch every sibling with it.
        expect(Math.round(cell(0, 1)!.getBoundingClientRect().height)).toBe(ROW_HEIGHT)
        expect(Math.round(cell(0, 2)!.getBoundingClientRect().height)).toBe(ROW_HEIGHT)
        expect(Math.round(cell(0, 0)!.getBoundingClientRect().height)).toBe(ROW_HEIGHT)
    })

    it('keeps every other cell in its own column', async () => {
        const screen = await render(TypedDataGrid, { grid: makeGrid() })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        // Row 1 has no region cell. Without explicit placement the city cell
        // would slide left into the hole the span left behind.
        const spanned = cell(1, 2)!.getBoundingClientRect()
        const normal = cell(0, 2)!.getBoundingClientRect()
        expect(Math.round(spanned.x)).toBe(Math.round(normal.x))
    })

    it('covers the row separators it crosses', async () => {
        const screen = await render(TypedDataGrid, { grid: makeGrid() })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const box = cell(0, 1)!.getBoundingClientRect()
        // The seam between the first two rows, inside the span: it must read as
        // the spanning cell, not as the separator painted over it.
        expect(ownerAt(box.x + 20, box.bottom)).toBe('0:1')
        expect(ownerAt(box.x + 20, box.bottom + ROW_HEIGHT)).toBe('0:1')
    })

    it('keeps the separator where one run ends and the next begins', async () => {
        const screen = await render(TypedDataGrid, { grid: makeGrid({ pinned: true }) })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        // The overhang covers every separator it crosses — including the one at
        // its own foot, which belongs to the next run and has to stay. It used
        // to swallow that line, leaving the runs welded together.
        const fill = cell(0, 1)!.firstElementChild as HTMLElement
        const edge = getComputedStyle(fill, '::after')
        expect(edge.display).not.toBe('none')
        expect(edge.height).toBe('1px')

        // Inside the run there is no line: the covered rows render no cell of
        // their own, and the overhang paints over the row's own separator.
        const box = cell(0, 1)!.getBoundingClientRect()
        expect(ownerAt(box.x + 20, box.bottom + ROW_HEIGHT)).toBe('0:1')
    })

    it('gives a spanning column vertical edges, unbroken down its runs', async () => {
        const screen = await render(TypedDataGrid, { grid: makeGrid() })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        // Merging rows takes the horizontal lines away; without a vertical one
        // the block has no edge left and reads as a hole in the table.
        const fill = cell(0, 1)!.firstElementChild as HTMLElement
        const spanning = getComputedStyle(fill)
        expect(spanning.borderInlineEndWidth).toBe('1px')
        // The column opens the spanning group, so it draws the near edge too.
        expect(spanning.borderInlineStartWidth).toBe('1px')

        // A run of one has no overhang, so its cell carries the same edges and
        // the line does not break where the runs are short.
        const single = getComputedStyle(cell(5, 1)!)
        expect(single.borderInlineEndWidth).toBe('1px')
        expect(single.borderInlineStartWidth).toBe('1px')

        // A column that spans nothing is left alone.
        expect(getComputedStyle(cell(0, 2)!).borderInlineEndWidth).toBe('0px')
    })

    it('draws no foot on a run that ends with the data', async () => {
        // A single row of its own, spanned to the end of a short list.
        const grid = createDataGrid<Entry>({
            columns: [
                { id: 'region', header: 'Region', width: 140, rowSpan: () => 3 },
                { id: 'city', header: 'City', width: 300 }
            ],
            data: entries.slice(0, 3),
            getRowId: (entry) => String(entry.id)
        })
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        // Nothing follows it, so the grid's own edge is the line.
        const fill = cell(0, 0)!.firstElementChild as HTMLElement
        expect(getComputedStyle(fill, '::after').display).toBe('none')
    })

    it('stays under a pinned column when the grid scrolls sideways', async () => {
        const screen = await render(TypedDataGrid, { grid: makeGrid({ pinned: true }) })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const viewport = screen.container.querySelector<HTMLElement>('[role="grid"]')!
        viewport.scrollLeft = 300
        viewport.dispatchEvent(new Event('scroll', { bubbles: true }))
        await expect.poll(() => Math.round(viewport.scrollLeft)).toBeGreaterThan(0)

        // The pinned column is sticky at the edge; a spanning cell scrolling
        // under it must not paint over it. Getting this wrong needs a cycle
        // broken — separator over pinned, span over separator, pinned over span.
        const pinned = cell(0, 1)!.getBoundingClientRect()
        await expect
            .poll(() => ownerAt(pinned.x + pinned.width / 2, pinned.top + ROW_HEIGHT / 2))
            .toBe('0:1')
    })

    it('draws a span whose owner is above the scrolled window', async () => {
        const grid = makeGrid()
        // A fixed height is what makes the viewport window its rows at all.
        const screen = await render(TypedDataGrid, { grid, class: 'h-[400px]' })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const viewport = screen.container.querySelector<HTMLElement>('[role="grid"]')!
        /** The lowest row index rendered in a column, -1 for none. */
        const firstRowOf = (col: number) =>
            Math.min(
                ...[...document.querySelectorAll(`[data-dg-cell$=":${col}"]`)]
                    .map((element) => Number(element.getAttribute('data-dg-cell')!.split(':')[0]))
                    .filter((row) => row >= 0)
            )
        // Read from the city column: it spans nothing, so its first cell is
        // where the window truly opens. Asking the spanning column would give
        // the owner's index instead, which is the very thing under test.
        const firstBodyRow = () => firstRowOf(2)

        // Overscan and the sticky header both move where the window opens,
        // so it is observed rather than predicted. Regions repeat every six
        // rows, putting the run heads at offsets 0, 3 and 5.
        const scrollTo = async (row: number) => {
            viewport.scrollTop = row * ROW_HEIGHT
            viewport.dispatchEvent(new Event('scroll', { bubbles: true }))
            await new Promise((resolve) => setTimeout(resolve, 120))
            return firstBodyRow()
        }

        let start = -1
        for (let row = 20; row < 50 && ![1, 2, 4].includes(start % 6); row++) {
            start = await scrollTo(row)
        }
        expect([1, 2, 4], 'never landed inside a run').toContain(start % 6)

        // Sampling straight down the column is what proves an owner above the
        // window was still drawn: a missing one leaves a gap.
        const box = viewport.getBoundingClientRect()
        const gaps: number[] = []
        for (let y = box.top + 60; y < box.bottom - 4; y += ROW_HEIGHT / 2) {
            if (ownerAt(box.x + 40, y) === 'none') gaps.push(Math.round(y - box.top))
        }
        expect(gaps).toEqual([])

        // The run's own cell is on screen even though its first row is not:
        // the spanning column reaches further up than any other.
        const head = firstRowOf(1)
        expect(head).toBeLessThan(start)

        const owner = cell(head, 1)
        expect(owner, `no cell for the run heading row ${start}`).not.toBeNull()
        const length = Number(owner!.getAttribute('aria-rowspan'))
        expect(length).toBeGreaterThan(1)

        const fill = owner!.firstElementChild as HTMLElement
        expect(Math.round(fill.getBoundingClientRect().height)).toBe(length * ROW_HEIGHT)
        expect(fill.getBoundingClientRect().top).toBeLessThan(
            owner!.getBoundingClientRect().top - 1
        )
    })

    it('makes the spanning cell the one tab stop for the rows it covers', async () => {
        const screen = await render(TypedDataGrid, { grid: makeGrid() })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        cell(0, 1)!.focus()
        expect(document.activeElement).toBe(cell(0, 1))

        // Down through the covered rows keeps the same cell focused — the
        // covered ones are not in the DOM to receive it.
        await userEvent.keyboard('{ArrowDown}{ArrowDown}')
        expect(document.activeElement).toBe(cell(0, 1))

        // Leaving the run moves on to the next spanning cell.
        await userEvent.keyboard('{ArrowDown}')
        await expect.poll(() => document.activeElement).toBe(cell(3, 1))
    })

    it('works without a virtualizer, sizing the span from the density variable', async () => {
        const screen = await render(TypedDataGrid, { grid: makeGrid({ virtual: false }) })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const fill = cell(0, 1)!.firstElementChild as HTMLElement
        const one = cell(0, 2)!.getBoundingClientRect().height
        expect(Math.round(fill.getBoundingClientRect().height)).toBe(Math.round(3 * one))
    })

    it('leaves a grid without rowSpan exactly as it was', async () => {
        const grid = createDataGrid<Entry>({
            columns: [
                { id: 'region', header: 'Region', width: 140, pinned: 'left' },
                { id: 'city', header: 'City', width: 400 }
            ],
            data: entries,
            getRowId: (entry) => String(entry.id)
        })
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        // No cell is skipped and none grows a spanning edge: the table keeps
        // the borders it has always drawn.
        expect(cell(1, 0)).not.toBeNull()
        expect(cell(0, 0)!.getAttribute('aria-rowspan')).toBeNull()
        expect(getComputedStyle(cell(0, 0)!).borderInlineEndWidth).toBe('0px')
        expect(getComputedStyle(cell(0, 1)!).borderInlineStartWidth).toBe('0px')
    })
})

describe('rowSpan accessibility', () => {
    it('is announced as a spanning cell, not as a missing one', async () => {
        const screen = await render(TypedDataGrid, { grid: makeGrid() })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const spanning = cell(0, 1)!
        expect(spanning.getAttribute('role')).toBe('gridcell')
        expect(spanning.getAttribute('aria-rowspan')).toBe('3')
        expect(spanning.getAttribute('aria-colindex')).toBe('2')
        await expect.element(page.getByRole('grid')).toHaveAttribute('aria-rowcount', '61')
    })

    it('passes axe with spans and a pinned column together', async () => {
        const screen = await render(TypedDataGrid, {
            grid: makeGrid({ pinned: true }),
            toolbar: true
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(
            results.violations.flatMap((violation) =>
                violation.nodes.map((node) => `${violation.id}: ${node.html.slice(0, 160)}`)
            )
        ).toEqual([])
    })
})
