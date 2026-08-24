import axe from 'axe-core'
import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import GroupsDemo from '../routes/groups/+page.svelte'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    sorting,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'
// Not public: a rail is the grid's own column, and nothing an app mounts.
import { railColumnId } from '$lib/core/types/index.js'

interface Row {
    id: number
    q1: number
    q2: number
    plan: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Row>>
const RAIL = railColumnId('revenue')

const rows: Row[] = Array.from({ length: 60 }, (_, i) => ({
    id: i + 1,
    q1: i,
    q2: i * 2,
    plan: i * 3
}))

/** A group that folds to a strip rather than to a summary column. */
function railColumns(): ColumnDef<Row>[] {
    return [
        { id: 'id', header: '#', width: 80 },
        {
            id: 'revenue',
            header: 'Doanh thu',
            collapseMode: 'rail',
            children: [
                { id: 'q1', header: 'Q1', width: 100 },
                { id: 'q2', header: 'Q2', width: 100 }
            ]
        },
        { id: 'plan', header: 'Chỉ tiêu', width: 120 }
    ]
}

function makeGrid(extra: 'virtual' | 'plain' = 'plain'): GridState<Row> {
    return createDataGrid<Row>({
        columns: railColumns(),
        data: rows,
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            columnOps(),
            ...(extra === 'virtual' ? [virtualization<Row>({ rowHeight: 40 })] : [])
        ]
    })
}

const headers = (container: Element) =>
    [...container.querySelectorAll('[data-dg-cell^="-1:"]')].map(
        (cell) => cell.textContent?.trim().split(/\s+/)[0] ?? ''
    )

const strip = (container: Element) => container.querySelector<HTMLElement>('[data-dg-rail]')
const head = (container: Element) => container.querySelector<HTMLElement>('[data-dg-rail-head]')
const label = (container: Element) =>
    container.querySelector<HTMLElement>('[data-dg-rail-head] [data-dg-truncate]')

async function renderGrid(grid: GridState<Row>, className?: string) {
    const screen = await render(TypedDataGrid, { grid, class: className })
    await expect.element(page.getByRole('grid')).toBeVisible()
    return screen
}

describe('a group folded to a rail', () => {
    it('takes its columns and their cells, and leaves a strip in their place', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        expect(headers(screen.container)).toEqual(['#', 'Q1', 'Q2', 'Chỉ'])

        await page.getByRole('button', { name: 'Collapse Doanh thu' }).click()

        // One narrow column where two stood, and no data in it.
        await expect
            .poll(() => grid.columns.visible.map((column) => column.id))
            .toEqual(['id', RAIL, 'plan'])
        const cells = [...screen.container.querySelectorAll('[data-dg-row-id]')[0]!.children]
        expect(cells.map((cell) => cell.textContent?.trim())).toEqual(['1', '', '0'])
    })

    it('runs the group name down the drawer, turned to read up it', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        await page.getByRole('button', { name: 'Collapse Doanh thu' }).click()
        await expect.poll(() => strip(screen.container)).not.toBeNull()

        const name = label(screen.container)!
        expect(name.textContent?.trim()).toBe('Doanh thu')
        expect(getComputedStyle(name).writingMode).toBe('vertical-rl')

        // It starts at the top of the drawer, which is the top of the grid,
        // and it is only as long as its own text.
        const box = name.getBoundingClientRect()
        const drawer = head(screen.container)!.getBoundingClientRect()
        expect(box.top - drawer.top).toBeLessThan(40)
        const whole = strip(screen.container)!.getBoundingClientRect().bottom - drawer.top
        expect(whole).toBeGreaterThan(box.height * 3)
    })

    it('says the name once, not once in the header and once down the strip', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        await page.getByRole('button', { name: 'Collapse Doanh thu' }).click()
        await expect.poll(() => strip(screen.container)).not.toBeNull()

        // The group's own cell keeps the control and nothing else: 44px of
        // header would clip the name, and the strip already carries it.
        const groupCell = screen.container.querySelector('[role="columnheader"][aria-expanded]')!
        expect(groupCell.querySelector('[data-dg-truncate]')).toBeNull()
        // The column is still named for a reader, out of sight.
        const railHeader = screen.container.querySelector('[data-dg-cell="-1:1"]')!
        expect(railHeader.querySelector('.sr-only')?.textContent).toBe('Doanh thu')
    })

    it('runs as one band, from the top of the header down to the last row', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        await page.getByRole('button', { name: 'Collapse Doanh thu' }).click()
        await expect.poll(() => strip(screen.container)).not.toBeNull()

        // A drawer that starts at the first row reads as a hole in the header
        // above it, so the header carries the head of the same band.
        const drawer = strip(screen.container)!.getBoundingClientRect()
        const top = head(screen.container)!.getBoundingClientRect()
        const header = screen.container.querySelector('[role="rowgroup"]')!.getBoundingClientRect()
        expect(getComputedStyle(head(screen.container)!).backgroundColor).toBe(
            getComputedStyle(strip(screen.container)!).backgroundColor
        )
        expect(top.top).toBeCloseTo(header.top, 0)
        expect(top.bottom).toBeCloseTo(drawer.top, 0)
        expect(top.left).toBeCloseTo(drawer.left, 0)
        expect(top.width).toBeCloseTo(drawer.width, 0)

        // And nothing of the header's own is drawn across it: the rule under
        // each level of headers, and the one along the header's foot, both
        // stop at the drawer rather than striking through it. The rules are
        // pseudo-elements, which no hit test can see, so what is measured is
        // the order they paint in.
        const headZ = Number(getComputedStyle(head(screen.container)!).zIndex)
        for (const row of screen.container.querySelectorAll('[role="rowgroup"] [role="row"]')) {
            const ruleZ = Number(getComputedStyle(row, '::after').zIndex)
            if (Number.isFinite(ruleZ)) expect(headZ).toBeGreaterThan(ruleZ)
        }
        const middle = top.left + top.width / 2
        const levelRule = screen.container
            .querySelector('[data-dg-header-cell="0:1"]')!
            .getBoundingClientRect().bottom
        for (const y of [levelRule - 0.5, header.bottom - 0.5]) {
            expect(head(screen.container)!.contains(document.elementFromPoint(middle, y))).toBe(
                true
            )
        }
    })

    it('shows the caret on the whole drawer, and only from the keyboard', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        await page.getByRole('button', { name: 'Collapse Doanh thu' }).click()
        await expect.poll(() => head(screen.container)).not.toBeNull()

        // The head covers the cell the caret stands on, so the drawer shows
        // the caret for it. A pointer gets none of it.
        const marks = () =>
            [head(screen.container)!, strip(screen.container)!].map(
                (piece) => getComputedStyle(piece).boxShadow
            )
        expect(marks()).toEqual(['none', 'none'])

        const leaf = screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:1"]')!
        grid.focus.focusCell({ row: -1, col: 1 })
        leaf.focus()
        await userEvent.keyboard('{ArrowUp}')

        // Both pieces, or the caret would land on a drawer cut in half.
        await expect.poll(() => marks()[0]).not.toBe('none')
        const [top, length] = marks()
        expect(length).toBe(top)
    })

    it('leaves one line along the bottom of the grid, not two', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        await page.getByRole('button', { name: 'Collapse Doanh thu' }).click()
        await expect.poll(() => strip(screen.container)).not.toBeNull()

        // The last row hides its own separator because the grid's border is
        // already that line, and the rule for it reads `:last-child`. Drawing
        // the strip after the rows takes that away and the two lines stack.
        const all = [...screen.container.querySelectorAll('[data-dg-row-id]')]
        const last = all[all.length - 1]!
        expect(getComputedStyle(last, '::after').display).toBe('none')
        expect(last.getBoundingClientRect().bottom).toBeCloseTo(
            strip(screen.container)!.getBoundingClientRect().bottom,
            0
        )
    })

    it('keeps the label in view however far the rows scroll', async () => {
        const grid = makeGrid('virtual')
        const screen = await renderGrid(grid, 'h-64')
        await page.getByRole('button', { name: 'Collapse Doanh thu' }).click()
        await expect.poll(() => strip(screen.container)).not.toBeNull()

        const viewport = screen.container.querySelector<HTMLElement>('[role="grid"]')!
        const offset = () =>
            label(screen.container)!.getBoundingClientRect().top -
            viewport.getBoundingClientRect().top

        // The name rides in the header, which is what holds it in view: the
        // rows go by under it and it does not move at all.
        const before = offset()
        viewport.scrollTop = 900
        await new Promise((resolve) => requestAnimationFrame(resolve))
        expect(offset()).toBeCloseTo(before, 0)
        expect(offset()).toBeLessThan(40)
    })

    it('folds without any column asking it to, and unfolds from the strip', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        // No child declares `columnGroupShow`; a summary fold would refuse.
        await page.getByRole('button', { name: 'Collapse Doanh thu' }).click()
        await expect.poll(() => headers(screen.container)).toEqual(['#', 'Doanh', 'Chỉ'])

        // No toggle in the header to unfold it with: the drawer is the
        // control now, over its whole length.
        expect(screen.container.querySelector('[data-dg-header-cell="0:1"] button')).toBeNull()
        strip(screen.container)!.click()
        await expect.poll(() => headers(screen.container)).toEqual(['#', 'Q1', 'Q2', 'Chỉ'])
        expect(strip(screen.container)).toBeNull()
    })

    it('folds from the keyboard, over the group cell above the strip', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        grid.focus.focusCell({ row: -1, col: 1 })
        screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:1"]')!.focus()
        await userEvent.keyboard('{ArrowUp}')
        await expect.poll(() => grid.focus.active).toEqual({ row: 0, col: 1, section: 'header' })

        await userEvent.keyboard('{Enter}')
        await expect.poll(() => grid.columns.isCollapsed('revenue')).toBe(true)

        // The group still has a cell over the strip, so Enter brings it back.
        await userEvent.keyboard('{Enter}')
        await expect.poll(() => grid.columns.isCollapsed('revenue')).toBe(false)
    })

    it('keeps the strip out of what leaves the grid', async () => {
        const grid = makeGrid()
        await renderGrid(grid)
        grid.columns.toggleGroup('revenue')

        // A rail holds no data, so it is not a column an export writes.
        const { rowsToMatrix } = await import('$lib/index.js')
        const matrix = rowsToMatrix(grid.nodes.slice(0, 1), grid.columns.visible)
        expect(matrix[0]).toEqual(['1', '0'])
    })

    it('reads as a closed drawer rather than as a gap', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        await page.getByRole('button', { name: 'Collapse Doanh thu' }).click()
        await expect.poll(() => strip(screen.container)).not.toBeNull()

        const el = strip(screen.container)!
        const style = getComputedStyle(el)
        // A surface of its own, and warm to the pointer.
        expect(style.cursor).toBe('pointer')
        expect(style.backgroundColor).not.toBe('rgba(0, 0, 0, 0)')

        // One line down its leading edge, not two. The column before it
        // already draws that edge, so a border of the strip's own lands on
        // the same pixel and reads as a thick smudge.
        const lines = (edge: 'Left' | 'Right', ...cells: Element[]) =>
            cells.filter((cell) => getComputedStyle(cell)[`border${edge}Width`] !== '0px').length
        const before = screen.container.querySelector('[data-dg-cell="-1:0"]')!
        const railHeader = screen.container.querySelector('[data-dg-cell="-1:1"]')!
        expect(lines('Right', before) + lines('Left', railHeader, el)).toBe(1)

        // The way back is drawn, not only implied: an arrow over the name.
        const inner = head(screen.container)!.firstElementChild!
        expect(inner.children).toHaveLength(2)
        // The name starts clear of the grid's own edge rather than on it.
        const name = label(screen.container)!.getBoundingClientRect()
        expect(name.top - head(screen.container)!.getBoundingClientRect().top).toBeGreaterThan(8)
    })

    it('opens again from anywhere down the drawer, not just the small arrow', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        await page.getByRole('button', { name: 'Collapse Doanh thu' }).click()
        await expect.poll(() => strip(screen.container)).not.toBeNull()

        strip(screen.container)!.click()

        await expect.poll(() => grid.columns.isCollapsed('revenue')).toBe(false)
        expect(strip(screen.container)).toBeNull()
    })

    it('is axe-clean folded to a strip', async () => {
        const screen = await renderGrid(makeGrid())
        await page.getByRole('button', { name: 'Collapse Doanh thu' }).click()
        await expect.poll(() => strip(screen.container)).not.toBeNull()

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(
            results.violations.flatMap((violation) =>
                violation.nodes.map((node) => `${violation.id}: ${node.html.slice(0, 120)}`)
            )
        ).toEqual([])
    })
})

describe('the header groups demo', () => {
    it('folds the plan group to a labelled strip, beside a summary fold', async () => {
        const screen = await render(GroupsDemo as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        const leafHeaders = () =>
            [...screen.container.querySelectorAll('[data-dg-cell^="-1:"]')].map(
                (cell) => cell.textContent?.trim().split(/\s+/)[0] ?? ''
            )
        expect(leafHeaders()).toContain('Chỉ')

        await page.getByRole('button', { name: 'Collapse Kế hoạch' }).click()

        // Both its columns are gone, and one strip stands where they were.
        await expect.poll(() => leafHeaders()).not.toContain('Chỉ')
        expect(leafHeaders()).not.toContain('Chênh')
        const name = label(screen.container)!
        expect(name.textContent?.trim()).toBe('Kế hoạch')
        expect(getComputedStyle(name).writingMode).toBe('vertical-rl')

        // The revenue group beside it still folds the other way, to a column.
        await page.getByRole('button', { name: 'Collapse Doanh thu' }).click()
        await expect.poll(() => leafHeaders()).toContain('Cả')
    })
})
