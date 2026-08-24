import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import CasesDemo from '../routes/groups/cases/+page.svelte'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    rowPinning,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Row {
    id: number
    a: number
    b: number
    c: number
    d: number
    e: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Row>>

function makeRows(count: number): Row[] {
    return Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        a: i,
        b: i * 2,
        c: i * 3,
        d: i * 4,
        e: i * 5
    }))
}

const rows = makeRows(20)

function gridOf(columns: ColumnDef<Row>[], data = rows, extra: unknown[] = []): GridState<Row> {
    return createDataGrid<Row>({
        data,
        columns,
        getRowId: (row) => String(row.id),
        features: [columnOps(), ...(extra as never[])]
    })
}

async function renderGrid(grid: GridState<Row>, className?: string) {
    const screen = await render(TypedDataGrid, { grid, class: className })
    await expect.element(page.getByRole('grid')).toBeVisible()
    return screen
}

const heads = (container: Element) => [
    ...container.querySelectorAll<HTMLElement>('[data-dg-rail-head]')
]
const strips = (container: Element) => [
    ...container.querySelectorAll<HTMLElement>('[data-dg-rail]')
]
/**
 * Clicked where it stands. The locator scrolls what it clicks into view
 * first, and under column virtualization that scroll rebuilds the header the
 * button is in, so the click lands on an element that has been replaced.
 */
function clickToggle(container: Element, name: string): void {
    const button = [...container.querySelectorAll('button')].find((candidate) =>
        (candidate.textContent ?? '').includes(name)
    )
    expect(button, `no ${name} toggle`).toBeTruthy()
    button!.click()
}

const left = (el: Element, of: Element) =>
    Math.round(el.getBoundingClientRect().left - of.getBoundingClientRect().left)

/** A group pinned to one side, wide columns between, so the grid must scroll. */
function pinnedColumns(side: 'left' | 'right'): ColumnDef<Row>[] {
    const railed: ColumnDef<Row> = {
        id: 'plan',
        header: 'Kế hoạch',
        collapseMode: 'rail',
        children: [
            { id: 'a', header: 'A', width: 120, pinned: side },
            { id: 'b', header: 'B', width: 120, pinned: side }
        ]
    }
    const wide: ColumnDef<Row>[] = [
        { id: 'c', header: 'C', width: 320 },
        { id: 'd', header: 'D', width: 320 },
        { id: 'e', header: 'E', width: 320 }
    ]
    return side === 'left'
        ? [{ id: 'id', header: '#', width: 80, pinned: 'left' }, railed, ...wide]
        : [{ id: 'id', header: '#', width: 80 }, ...wide, railed]
}

describe('a drawer over a pinned group', () => {
    for (const side of ['left', 'right'] as const) {
        it(`stays with its column, pinned ${side}, however far the rest scrolls`, async () => {
            const grid = gridOf(pinnedColumns(side))
            const screen = await renderGrid(grid, 'w-[520px]')
            await page.getByRole('button', { name: 'Collapse Kế hoạch' }).click()
            await expect.poll(() => strips(screen.container).length).toBe(1)

            const viewport = screen.container.querySelector<HTMLElement>('[role="grid"]')!
            const railIndex = grid.columns.visible.findIndex((column) => column.id.includes('rail'))
            const cell = () =>
                screen.container.querySelector(`[data-dg-cell="0:${railIndex}"]`) ??
                [...screen.container.querySelector('[data-dg-row-id]')!.children][railIndex]!

            // The cells hold their place with `sticky`; the drawer is one
            // element over every row, which cannot be sticky, so it has to be
            // told where the pin is.
            const before = left(cell(), viewport)
            expect(left(heads(screen.container)[0], viewport)).toBe(before)
            expect(left(strips(screen.container)[0], viewport)).toBe(before)

            viewport.scrollLeft = 400
            await new Promise((resolve) => requestAnimationFrame(resolve))
            const after = left(cell(), viewport)
            expect(after).toBe(before)
            expect(left(heads(screen.container)[0], viewport)).toBe(after)
            expect(left(strips(screen.container)[0], viewport)).toBe(after)
        })
    }
})

describe('a drawer among other things', () => {
    it('frames itself on both sides, even in the middle of a group', async () => {
        const grid = gridOf([
            { id: 'id', header: '#', width: 80 },
            {
                id: 'block',
                header: 'Khối',
                children: [
                    { id: 'c', header: 'C', width: 140 },
                    {
                        id: 'plan',
                        header: 'Kế hoạch',
                        collapseMode: 'rail',
                        children: [{ id: 'a', header: 'A', width: 80 }]
                    }
                ]
            },
            { id: 'd', header: 'D', width: 100 }
        ])
        const screen = await renderGrid(grid)
        clickToggle(screen.container, 'Collapse Kế hoạch')
        await expect.poll(() => strips(screen.container).length).toBe(1)

        // Standing inside a group, nothing beside it draws a line: the grid
        // only draws them where a group ends. So the drawer draws its own,
        // and the cell before it gives up the one it would have drawn, or
        // the two land on neighbouring pixels and read as one thick line.
        const drawer = [heads(screen.container)[0], strips(screen.container)[0]]
        for (const piece of drawer) {
            const style = getComputedStyle(piece)
            expect(style.borderLeftWidth).toBe('1px')
            expect(style.borderRightWidth).toBe('1px')
        }
        const before = screen.container.querySelector('[data-dg-cell="-1:1"]')!
        expect(getComputedStyle(before).borderRightWidth).toBe('0px')
    })

    it('is not painted over by the cells it stands on, pinned and scrolling', async () => {
        const grid = gridOf([
            { id: 'id', header: '#', width: 60 },
            { id: 'c', header: 'C', width: 500 },
            {
                id: 'plan',
                header: 'Nửa sau',
                collapseMode: 'rail',
                children: [
                    { id: 'a', header: 'A', width: 120, pinned: 'right' },
                    { id: 'b', header: 'B', width: 120, pinned: 'right' }
                ]
            }
        ])
        const screen = await renderGrid(grid, 'w-[400px]')
        clickToggle(screen.container, 'Collapse Nửa sau')
        await expect.poll(() => strips(screen.container).length).toBe(1)

        // A pinned cell is raised over the separator and the spans so it
        // draws what it covers. A drawer's own cells carry nothing to draw,
        // and raised they cover the drawer itself: the surface survives,
        // being the same colour, but the edge down its leading side does not.
        const strip = strips(screen.container)[0]
        const railIndex = grid.columns.visible.findIndex((column) => column.id.includes('rail'))
        const cell = [...screen.container.querySelector('[data-dg-row-id]')!.children].find(
            (child) => child.getAttribute('data-dg-cell')?.endsWith(`:${railIndex}`)
        )!
        expect(Number(getComputedStyle(cell).zIndex)).toBeLessThan(
            Number(getComputedStyle(strip).zIndex)
        )
        const box = cell.getBoundingClientRect()
        expect(document.elementFromPoint(box.left + 0.5, box.top + box.height / 2)).toBe(strip)
        expect(getComputedStyle(strip).borderLeftWidth).toBe('1px')
    })

    it('closes its outer side too, when the columns come up short of the grid', async () => {
        const columns: ColumnDef<Row>[] = [
            { id: 'id', header: '#', width: 60 },
            { id: 'c', header: 'C', width: 120 },
            {
                id: 'plan',
                header: 'Kế hoạch',
                collapseMode: 'rail',
                children: [{ id: 'a', header: 'A', width: 100 }]
            }
        ]
        const wide = await renderGrid(gridOf(columns), 'w-[700px]')
        clickToggle(wide.container, 'Collapse Kế hoạch')
        await expect.poll(() => strips(wide.container).length).toBe(1)

        // The grid's own border is the trailing edge of the last column, but
        // only when the columns reach it. Here they stop 400px short, and a
        // drawer left open on that side is a drawer with one side.
        for (const piece of [heads(wide.container)[0], strips(wide.container)[0]]) {
            const style = getComputedStyle(piece)
            expect(style.borderLeftWidth).toBe('1px')
            expect(style.borderRightWidth).toBe('1px')
        }
    })

    it('leaves the outer edge to the grid when the columns do reach it', async () => {
        const screen = await renderGrid(
            gridOf([
                { id: 'id', header: '#', width: 60 },
                { id: 'c', header: 'C', flex: 1, minWidth: 80 },
                {
                    id: 'plan',
                    header: 'Kế hoạch',
                    collapseMode: 'rail',
                    children: [{ id: 'a', header: 'A', width: 100 }]
                }
            ])
        )
        clickToggle(screen.container, 'Collapse Kế hoạch')
        await expect.poll(() => strips(screen.container).length).toBe(1)

        // Drawn there it would stand one pixel inside a line the grid has
        // already drawn, which is the thick smudge in another place.
        await expect
            .poll(() => getComputedStyle(strips(screen.container)[0]).borderRightWidth)
            .toBe('0px')
        expect(getComputedStyle(heads(screen.container)[0]).borderRightWidth).toBe('0px')
        expect(getComputedStyle(strips(screen.container)[0]).borderLeftWidth).toBe('1px')
    })

    it('folds a group that lives inside another group, and leaves the parent standing', async () => {
        const grid = gridOf([
            { id: 'id', header: '#', width: 80 },
            {
                id: 'block',
                header: 'Khối',
                children: [
                    { id: 'c', header: 'C', width: 120 },
                    {
                        id: 'plan',
                        header: 'Kế hoạch',
                        collapseMode: 'rail',
                        children: [
                            { id: 'a', header: 'A', width: 120 },
                            { id: 'b', header: 'B', width: 120 }
                        ]
                    }
                ]
            }
        ])
        const screen = await renderGrid(grid)
        const parent = () =>
            screen.container
                .querySelector('[data-dg-header-cell="0:1"]')!
                .getAttribute('aria-colspan')
        expect(parent()).toBe('3')

        await page.getByRole('button', { name: 'Collapse Kế hoạch' }).click()
        await expect.poll(() => strips(screen.container).length).toBe(1)

        // The parent keeps its header and shrinks to what is left of it.
        await expect.poll(parent).toBe('2')
        // And the drawer runs past the parent's own level, not from under it.
        const head = heads(screen.container)[0].getBoundingClientRect()
        const header = screen.container.querySelector('[role="rowgroup"]')!.getBoundingClientRect()
        expect(head.top).toBeCloseTo(header.top, 0)
    })

    it('draws one line the whole way down between two drawers', async () => {
        const grid = gridOf([
            { id: 'id', header: '#', width: 80 },
            {
                id: 'plan',
                header: 'Kế hoạch',
                collapseMode: 'rail',
                children: [{ id: 'a', header: 'A', width: 120 }]
            },
            {
                id: 'half',
                header: 'Nửa đầu',
                collapseMode: 'rail',
                children: [{ id: 'b', header: 'B', width: 120 }]
            },
            { id: 'c', header: 'C', width: 120 }
        ])
        const screen = await renderGrid(grid)
        clickToggle(screen.container, 'Collapse Kế hoạch')
        clickToggle(screen.container, 'Collapse Nửa đầu')
        await expect.poll(() => strips(screen.container).length).toBe(2)

        // One line between them, drawn once and by one side only, and it
        // runs the whole height rather than stopping where the header does.
        const [firstHead, secondHead] = heads(screen.container)
        const [firstStrip, secondStrip] = strips(screen.container)
        const edge = (el: Element, side: 'Left' | 'Right') =>
            getComputedStyle(el)[`border${side}Width`]
        expect(edge(secondHead, 'Left')).toBe('1px')
        expect(edge(secondStrip, 'Left')).toBe('1px')
        expect(edge(firstHead, 'Right')).toBe('0px')
        expect(edge(firstStrip, 'Right')).toBe('0px')
        // Both are framed on their leading side, so neither reads as open.
        expect(edge(firstHead, 'Left')).toBe('1px')
        expect(edge(firstStrip, 'Left')).toBe('1px')

        // The two pieces of that line meet, and reach the last row.
        expect(secondHead.getBoundingClientRect().bottom).toBeCloseTo(
            secondStrip.getBoundingClientRect().top,
            0
        )
        const last = [...screen.container.querySelectorAll('[data-dg-row-id]')].at(-1)!
        expect(secondStrip.getBoundingClientRect().bottom).toBeCloseTo(
            last.getBoundingClientRect().bottom,
            0
        )
    })

    it('stands in its own track when the grid has nothing to scroll', async () => {
        const grid = gridOf([
            { id: 'id', header: '#', width: 56 },
            { id: 'c', header: 'C', width: 120 },
            {
                id: 'plan',
                header: 'Nửa sau',
                collapseMode: 'rail',
                children: [
                    { id: 'a', header: 'A', width: 100, pinned: 'right' },
                    { id: 'b', header: 'B', width: 100, pinned: 'right' }
                ]
            }
        ])
        const screen = await renderGrid(grid, 'w-[700px]')
        clickToggle(screen.container, 'Collapse Nửa sau')
        await expect.poll(() => strips(screen.container).length).toBe(1)

        // A pinned cell travels no further than it has to, and with nothing
        // to scroll it does not travel at all. The drawer has to say the same
        // thing, or it sits at the far edge with its column left behind.
        const viewport = screen.container.querySelector<HTMLElement>('[role="grid"]')!
        expect(viewport.scrollWidth).toBeLessThanOrEqual(viewport.clientWidth + 1)
        const cell = [...screen.container.querySelector('[data-dg-row-id]')!.children].at(-1)!
        expect(left(strips(screen.container)[0], viewport)).toBe(left(cell, viewport))
        expect(left(heads(screen.container)[0], viewport)).toBe(left(cell, viewport))
    })

    it('keeps a folded group cell inside its own column, to a pixel', async () => {
        const grid = gridOf([
            { id: 'id', header: '#', width: 56 },
            {
                id: 'block',
                header: 'Khối',
                children: [
                    { id: 'c', header: 'C', flex: 2, minWidth: 120 },
                    {
                        id: 'plan',
                        header: 'Kế hoạch',
                        collapseMode: 'rail',
                        children: [
                            { id: 'a', header: 'A', minWidth: 70 },
                            { id: 'b', header: 'B', minWidth: 70 }
                        ]
                    }
                ]
            },
            { id: 'd', header: 'D', minWidth: 70 }
        ])
        const screen = await renderGrid(grid)
        clickToggle(screen.container, 'Collapse Kế hoạch')
        await expect.poll(() => strips(screen.container).length).toBe(1)

        // The room a group cell keeps for its toggle is padding, and padding
        // is a floor no width can go under. A drawer is 44px wide, so a cell
        // still holding that room stands a pixel wider than the column and
        // lays a second line beside the drawer's own.
        const covered = screen.container.querySelector<HTMLElement>(
            '[role="columnheader"][aria-expanded="false"]'
        )!
        const drawer = heads(screen.container)[0]
        // Polled: until the grid has been measured the drawer stands on
        // estimated widths, which a flex column only matches once measured.
        await expect
            .poll(() =>
                Math.abs(
                    covered.getBoundingClientRect().right - drawer.getBoundingClientRect().right
                )
            )
            .toBeLessThan(1)
        expect(covered.offsetWidth).toBe(drawer.offsetWidth)
    })

    it('keeps two drawers apart, each opening its own group', async () => {
        const grid = gridOf([
            { id: 'id', header: '#', width: 80 },
            {
                id: 'plan',
                header: 'Kế hoạch',
                collapseMode: 'rail',
                children: [{ id: 'a', header: 'A', width: 120 }]
            },
            {
                id: 'half',
                header: 'Nửa đầu',
                collapseMode: 'rail',
                children: [{ id: 'b', header: 'B', width: 120 }]
            },
            { id: 'c', header: 'C', width: 120 }
        ])
        const screen = await renderGrid(grid)
        await page.getByRole('button', { name: 'Collapse Kế hoạch' }).click()
        await page.getByRole('button', { name: 'Collapse Nửa đầu' }).click()
        await expect.poll(() => strips(screen.container).length).toBe(2)

        const [first, second] = strips(screen.container)
        expect(first.getBoundingClientRect().right).toBeLessThanOrEqual(
            second.getBoundingClientRect().left
        )

        second.click()
        await expect.poll(() => grid.columns.isCollapsed('half')).toBe(false)
        // The one beside it did not go with it.
        expect(grid.columns.isCollapsed('plan')).toBe(true)
    })

    it('carries the drawer through the rows pinned above and below', async () => {
        const grid = gridOf(
            [
                { id: 'id', header: '#', width: 80 },
                {
                    id: 'plan',
                    header: 'Kế hoạch',
                    collapseMode: 'rail',
                    children: [
                        { id: 'a', header: 'A', width: 120 },
                        { id: 'b', header: 'B', width: 120 }
                    ]
                },
                { id: 'c', header: 'C', width: 120 }
            ],
            rows,
            [
                rowPinning<Row>({
                    isRowPinned: (row) => (row.id === 1 ? 'top' : row.id === 3 ? 'bottom' : null)
                })
            ]
        )
        const screen = await renderGrid(grid, 'h-64')
        await page.getByRole('button', { name: 'Collapse Kế hoạch' }).click()
        await expect.poll(() => strips(screen.container).length).toBe(1)

        // The strip covers the rows it folded away, but a pinned row group
        // stands outside it, so those cells wear the surface themselves.
        const surface = getComputedStyle(strips(screen.container)[0]).backgroundColor
        const pinned = [...screen.container.querySelectorAll('[data-dg-pinned-cell]')].filter(
            (cell) => cell.getAttribute('data-dg-pinned-cell')?.endsWith(':1')
        )
        expect(pinned.length).toBeGreaterThan(0)
        const edges = getComputedStyle(strips(screen.container)[0])
        for (const cell of pinned) {
            const style = getComputedStyle(cell)
            expect(style.backgroundColor).toBe(surface)
            expect(cell.textContent?.trim()).toBe('')
            // And the lines down its sides, or the drawer is cut in two
            // wherever a pinned row crosses it.
            expect(style.borderLeftWidth).toBe(edges.borderLeftWidth)
            expect(style.borderRightWidth).toBe(edges.borderRightWidth)
        }
    })

    it('holds the drawer over its column while the columns are windowed', async () => {
        const grid = gridOf(
            [
                { id: 'id', header: '#', width: 160 },
                { id: 'c', header: 'C', width: 200 },
                {
                    id: 'plan',
                    header: 'Kế hoạch',
                    collapseMode: 'rail',
                    children: [
                        { id: 'a', header: 'A', width: 200 },
                        { id: 'b', header: 'B', width: 200 }
                    ]
                },
                { id: 'd', header: 'D', width: 200 },
                { id: 'e', header: 'E', width: 200 }
            ],
            makeRows(300),
            [virtualization<Row>({ rowHeight: 40, columns: true })]
        )
        const screen = await renderGrid(grid, 'h-64 w-[400px]')
        clickToggle(screen.container, 'Collapse Kế hoạch')
        await expect.poll(() => strips(screen.container).length).toBe(1)

        const viewport = screen.container.querySelector<HTMLElement>('[role="grid"]')!
        const railIndex = grid.columns.visible.findIndex((column) => column.id.includes('rail'))
        viewport.scrollLeft = 150
        viewport.scrollTop = 600
        await expect.poll(() => Math.round(viewport.scrollTop)).toBe(600)
        await new Promise((resolve) => requestAnimationFrame(resolve))

        const cell = [...screen.container.querySelector('[data-dg-row-id]')!.children].find(
            (child) => child.getAttribute('data-dg-cell')?.endsWith(`:${railIndex}`)
        )!
        expect(left(strips(screen.container)[0], viewport)).toBe(left(cell, viewport))
        // The name rides in the header, so 600px of rows change nothing.
        const name = screen.container.querySelector('[data-dg-rail-head] [data-dg-truncate]')!
        expect(
            name.getBoundingClientRect().top - viewport.getBoundingClientRect().top
        ).toBeLessThan(60)
    })

    it('opens folded, when the columns said so, and comes back to that after a round trip', async () => {
        const grid = gridOf([
            { id: 'id', header: '#', width: 80 },
            {
                id: 'plan',
                header: 'Kế hoạch',
                collapseMode: 'rail',
                collapsed: true,
                children: [{ id: 'a', header: 'A', width: 120 }]
            },
            { id: 'c', header: 'C', width: 120 }
        ])
        const screen = await renderGrid(grid)
        expect(strips(screen.container)).toHaveLength(1)

        const saved = grid.getState()
        strips(screen.container)[0].click()
        await expect.poll(() => grid.columns.isCollapsed('plan')).toBe(false)

        grid.setState(saved)
        await expect.poll(() => grid.columns.isCollapsed('plan')).toBe(true)
        await expect.poll(() => strips(screen.container).length).toBe(1)
    })

    it('stands over its own column when the grid reads the other way', async () => {
        const grid = gridOf([
            { id: 'id', header: '#', width: 80 },
            {
                id: 'plan',
                header: 'Kế hoạch',
                collapseMode: 'rail',
                children: [
                    { id: 'a', header: 'A', width: 120 },
                    { id: 'b', header: 'B', width: 120 }
                ]
            },
            { id: 'c', header: 'C', width: 120 }
        ])
        const screen = await render(TypedDataGrid, { grid })
        const wrapper = screen.container.querySelector('div')!
        wrapper.setAttribute('dir', 'rtl')
        await expect.element(page.getByRole('grid')).toBeVisible()
        await page.getByRole('button', { name: 'Collapse Kế hoạch' }).click()
        await expect.poll(() => strips(screen.container).length).toBe(1)

        const railIndex = grid.columns.visible.findIndex((column) => column.id.includes('rail'))
        const cell = [...screen.container.querySelector('[data-dg-row-id]')!.children].find(
            (child) => child.getAttribute('data-dg-cell')?.endsWith(`:${railIndex}`)
        )!
        const drawer = strips(screen.container)[0].getBoundingClientRect()
        expect(Math.round(drawer.left)).toBe(Math.round(cell.getBoundingClientRect().left))
        expect(Math.round(drawer.width)).toBe(Math.round(cell.getBoundingClientRect().width))
    })
})

describe('the cases demo', () => {
    it('mounts every case, and each one says what it is doing', async () => {
        const screen = await render(CasesDemo as never)
        await expect.element(page.getByRole('grid').first()).toBeVisible()
        expect(screen.container.querySelectorAll('[role="grid"]')).toHaveLength(10)

        // Two of them open folded, by declaration, and say so.
        expect(screen.container.textContent).toContain('đang gập: rev, planning')
        expect(strips(screen.container).length).toBeGreaterThan(0)
    })
})
