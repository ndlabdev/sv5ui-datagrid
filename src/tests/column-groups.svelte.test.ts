import axe from 'axe-core'
import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import ColumnsDemo from '../routes/columns/+page.svelte'
import GroupsDemo from '../routes/groups/+page.svelte'
import GroupHeaderGrid from './GroupHeaderGrid.svelte'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    filtering,
    sorting,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Person {
    id: number
    name: string
    total: number
    base: number
    bonus: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

const people: Person[] = [
    { id: 1, name: 'Ada', total: 120, base: 100, bonus: 20 },
    { id: 2, name: 'Grace', total: 210, base: 200, bonus: 10 }
]

/** `Pay` folds down to its total; `#` and `Name` belong to no group. */
function payColumns(): ColumnDef<Person>[] {
    return [
        { id: 'id', header: '#', width: 70 },
        { id: 'name', header: 'Name', width: 160, filter: 'text' },
        {
            id: 'pay',
            header: 'Pay',
            children: [
                { id: 'total', header: 'Total', width: 110, columnGroupShow: 'closed' },
                { id: 'base', header: 'Base', width: 110, columnGroupShow: 'open' },
                { id: 'bonus', header: 'Bonus', width: 110, columnGroupShow: 'open' }
            ]
        }
    ]
}

function makeGrid(columns = payColumns(), extra = {}): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (row) => String(row.id),
        features: [sorting(), columnOps(), filtering()],
        ...extra
    })
}

/** The leaf row: one entry per column the grid is drawing. */
const headers = (container: Element) =>
    [...container.querySelectorAll('[data-dg-cell^="-1:"]')].map(
        (cell) => cell.querySelector('[data-dg-truncate]')?.textContent?.trim() ?? ''
    )

const groupCell = (container: Element) =>
    container.querySelector('[role="columnheader"][aria-expanded]')

async function renderGrid(grid: GridState<Person>) {
    const screen = await render(TypedDataGrid, { grid })
    await expect.element(page.getByRole('grid')).toBeVisible()
    return screen
}

describe('a collapsible header group', () => {
    it('folds to its summary column and back at a click', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        expect(headers(screen.container)).toEqual(['#', 'Name', 'Base', 'Bonus'])
        expect(groupCell(screen.container)?.getAttribute('aria-expanded')).toBe('true')

        await page.getByRole('button', { name: 'Collapse Pay' }).click()

        await expect.poll(() => headers(screen.container)).toEqual(['#', 'Name', 'Total'])
        expect(groupCell(screen.container)?.getAttribute('aria-expanded')).toBe('false')

        await page.getByRole('button', { name: 'Expand Pay' }).click()
        await expect.poll(() => headers(screen.container)).toEqual(['#', 'Name', 'Base', 'Bonus'])
    })

    it('offers no toggle to a group nothing asks to fold', async () => {
        const screen = await renderGrid(
            makeGrid([
                { id: 'id', header: '#', width: 70 },
                {
                    id: 'who',
                    header: 'Who',
                    children: [{ id: 'name', header: 'Name', width: 160 }]
                }
            ])
        )

        // The column menu trigger carries `aria-expanded` too, so the check
        // is for a header cell that does.
        expect(groupCell(screen.container)).toBeNull()
    })

    it('folds from the column menu, which is how the keyboard reaches it', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        await page.getByRole('button', { name: 'Base column menu' }).click()
        await page.getByRole('menuitem', { name: 'Collapse Pay' }).click()

        await expect.poll(() => headers(screen.container)).toEqual(['#', 'Name', 'Total'])

        // And the way back out, from the column that stayed.
        await page.getByRole('button', { name: 'Total column menu' }).click()
        await page.getByRole('menuitem', { name: 'Expand Pay' }).click()
        await expect.poll(() => headers(screen.container)).toEqual(['#', 'Name', 'Base', 'Bonus'])
    })

    it('says what happened, for a reader who cannot see it', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        await page.getByRole('button', { name: 'Collapse Pay' }).click()

        const live = screen.container.ownerDocument.querySelector('[aria-live]')!
        await expect.poll(() => live.textContent).toContain('Pay collapsed')
    })

    it('gives the room back to the columns that stayed', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const widthOf = (name: string) =>
            [...screen.container.querySelectorAll('[data-dg-cell^="-1:"]')]
                .find((cell) => cell.textContent?.trim().startsWith(name))!
                .getBoundingClientRect().width

        const before = widthOf('Name')
        await page.getByRole('button', { name: 'Collapse Pay' }).click()
        await expect.poll(() => headers(screen.container)).toHaveLength(3)

        // Fixed widths here, so the row narrows rather than the columns
        // stretching; what matters is that nothing was left behind.
        expect(widthOf('Name')).toBe(before)
        expect(screen.container.querySelectorAll('[role="gridcell"]').length).toBe(6)
    })

    it('pins the toggle to the end of its own block, out of the label', async () => {
        const screen = await renderGrid(makeGrid())
        const cell = groupCell(screen.container)!.getBoundingClientRect()
        const button = groupCell(screen.container)!.querySelector('button')!.getBoundingClientRect()

        // At the trailing edge of the group it belongs to, rather than in the
        // middle beside the label, where it reads as the seam between two
        // groups instead of a control of one.
        expect(cell.right - button.right).toBeLessThan(8)
        expect(button.left).toBeGreaterThan(cell.left + cell.width / 2)
    })

    it('keeps a long label clear of the toggle when the group is at its narrowest', async () => {
        const grid = makeGrid([
            { id: 'id', header: '#', width: 70 },
            {
                id: 'performance',
                header: 'Performance review',
                children: [
                    { id: 'total', header: 'YTD', width: 90, columnGroupShow: 'closed' },
                    { id: 'base', header: 'Q1', width: 90, columnGroupShow: 'open' },
                    { id: 'bonus', header: 'Q2', width: 90, columnGroupShow: 'open' }
                ]
            }
        ])
        const screen = await renderGrid(grid)
        await page.getByRole('button', { name: 'Collapse Performance review' }).click()
        await expect.poll(() => headers(screen.container)).toEqual(['#', 'YTD'])

        // Folding is what makes a group narrow, so this is the state the label
        // has to survive: it gives way to an ellipsis rather than running
        // under the toggle or out of the cell.
        const cellEl = groupCell(screen.container)!
        const cell = cellEl.getBoundingClientRect()
        const label = cellEl.querySelector('[data-dg-truncate]')!.getBoundingClientRect()
        const button = cellEl.querySelector('button')!.getBoundingClientRect()

        expect(label.right).toBeLessThanOrEqual(button.left)
        expect(label.left).toBeGreaterThanOrEqual(cell.left)
        expect(button.right).toBeLessThanOrEqual(cell.right)
    })

    it('lets the app draw the group header, and still folds it', async () => {
        const screen = await render(GroupHeaderGrid as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        // The app's own drawing, with the span it was handed.
        await expect.element(page.getByText('Pay (2)')).toBeVisible()
        // And the grid's own control beside it, as a leaf header keeps its
        // sort button beside a custom `headerCell`.
        await expect.element(page.getByRole('button', { name: 'Collapse Pay' })).toBeVisible()

        // The toggle handed to the snippet does what the built-in one does.
        await screen.container.querySelector<HTMLElement>('[data-testid="own-toggle"]')!.click()

        await expect.element(page.getByText('Pay (1)')).toBeVisible()
        await expect.element(page.getByRole('button', { name: 'Expand Pay' })).toBeVisible()
    })

    it('drives a fold from the grid API, announcing it like any column op', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        grid.api.toggleGroup!('pay')

        await expect.poll(() => headers(screen.container)).toEqual(['#', 'Name', 'Total'])
        const live = screen.container.ownerDocument.querySelector('[aria-live]')!
        await expect.poll(() => live.textContent).toContain('Pay collapsed')

        grid.api.setGroupCollapsed!('pay', false)
        await expect.poll(() => headers(screen.container)).toEqual(['#', 'Name', 'Base', 'Bonus'])
    })

    it('takes the caret up into the group header and folds it from there', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        // Into the leaf header of a column inside the group, then up.
        grid.focus.focusCell({ row: -1, col: 2 })
        screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:2"]')!.focus()
        await userEvent.keyboard('{ArrowUp}')

        await expect.poll(() => grid.focus.active).toEqual({ row: 0, col: 2, section: 'header' })
        // The cell itself holds the caret, not the button inside it.
        await expect
            .poll(() => document.activeElement?.getAttribute('data-dg-header-cell'))
            .toBe('0:2')

        await userEvent.keyboard('{Enter}')
        await expect.poll(() => headers(screen.container)).toEqual(['#', 'Name', 'Total'])

        // Space folds it back, and the caret has not moved off the group.
        await userEvent.keyboard(' ')
        await expect.poll(() => headers(screen.container)).toEqual(['#', 'Name', 'Base', 'Bonus'])
        expect(grid.focus.active).toEqual({ row: 0, col: 2, section: 'header' })

        // And back down the way it came.
        await userEvent.keyboard('{ArrowDown}')
        await expect.poll(() => grid.focus.active).toEqual({ row: -1, col: 2 })
    })

    it('gives the caret nowhere to go above a column with no group', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        grid.focus.focusCell({ row: -1, col: 0 })
        screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:0"]')!.focus()
        await userEvent.keyboard('{ArrowUp}')

        // The level above `#` holds a placeholder, which names nothing.
        expect(grid.focus.active).toEqual({ row: -1, col: 0 })
        expect(document.activeElement?.getAttribute('data-dg-cell')).toBe('-1:0')
    })

    it('keeps one tab stop while the caret stands on a group header', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        grid.focus.focusCell({ row: 0, col: 2, section: 'header' })

        await expect
            .poll(
                () =>
                    screen.container.querySelectorAll(
                        '[data-dg-cell][tabindex="0"], [data-dg-header-cell][tabindex="0"]'
                    ).length
            )
            .toBe(1)
    })

    it('keeps what an app draws inside the group it drew it for', async () => {
        const screen = await render(GroupsDemo as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        await page.getByRole('button', { name: 'Collapse Doanh thu' }).click()

        const cellEl = groupCell(screen.container)!
        await expect.poll(() => cellEl.textContent).toContain('tóm tắt')

        // Folded is a group at its narrowest, and a header an app drew has no
        // reason to know that. The cell clips, so nothing lands in the group
        // beside it or under the toggle.
        expect(getComputedStyle(cellEl).overflow).toBe('hidden')
        const cell = cellEl.getBoundingClientRect()
        const toggle = cellEl.querySelector('button')!.getBoundingClientRect()
        for (const part of cellEl.querySelectorAll('span')) {
            const box = part.getBoundingClientRect()
            if (box.width === 0) continue
            expect(box.left).toBeGreaterThanOrEqual(cell.left - 1)
            expect(box.right).toBeLessThanOrEqual(cell.right + 1)
        }
        const label = cellEl.querySelector('.truncate')!.getBoundingClientRect()
        expect(label.right).toBeLessThanOrEqual(toggle.left)
    })

    it('leaves the caret on the group, not on the button that folded it', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        await page.getByRole('button', { name: 'Collapse Pay' }).click()
        await expect.poll(() => headers(screen.container)).toEqual(['#', 'Name', 'Total'])

        // Focus lives on cells everywhere else in the grid; a control holding
        // it after a click leaves a ring sitting in the header, and leaves the
        // arrow keys with nothing to move.
        await expect
            .poll(() => document.activeElement?.getAttribute('data-dg-header-cell'))
            .toBe('0:2')
        expect(grid.focus.active).toEqual({ row: 0, col: 2, section: 'header' })
    })

    it('gives every level its own toggle, and folds them apart', async () => {
        const grid = makeGrid([
            { id: 'id', header: '#', width: 70 },
            {
                id: 'outer',
                header: 'Outer',
                children: [
                    { id: 'total', header: 'All', width: 90, columnGroupShow: 'closed' },
                    {
                        id: 'inner',
                        header: 'Inner',
                        columnGroupShow: 'open',
                        children: [
                            { id: 'base', header: 'Sub', width: 90, columnGroupShow: 'closed' },
                            { id: 'bonus', header: 'A', width: 90, columnGroupShow: 'open' },
                            { id: 'name', header: 'B', width: 90, columnGroupShow: 'open' }
                        ]
                    }
                ]
            }
        ])
        const screen = await renderGrid(grid)
        const groupCells = () =>
            [...screen.container.querySelectorAll('[data-dg-header-cell]')].map(
                (cell) =>
                    `${cell.getAttribute('data-dg-header-cell')}=${cell.getAttribute('aria-expanded')}`
            )

        // A toggle per level, not one for the outermost group only.
        expect(groupCells()).toEqual(['0:1=true', '1:1=true'])
        expect(headers(screen.container)).toEqual(['#', 'A', 'B'])

        // The inner one folds on its own account.
        await page.getByRole('button', { name: 'Collapse Inner' }).click()
        await expect.poll(() => headers(screen.container)).toEqual(['#', 'Sub'])
        expect(groupCells()).toEqual(['0:1=true', '1:1=false'])

        // And the outer one folds over the top of it.
        await page.getByRole('button', { name: 'Collapse Outer' }).click()
        await expect.poll(() => headers(screen.container)).toEqual(['#', 'All'])
        // Nothing of the inner group is on screen, so it has no cell either.
        expect(groupCells()).toEqual(['0:1=false'])

        // Reopening the outer one hands the inner one back as it was left.
        await page.getByRole('button', { name: 'Expand Outer' }).click()
        await expect.poll(() => headers(screen.container)).toEqual(['#', 'Sub'])
        expect(groupCells()).toEqual(['0:1=true', '1:1=false'])
    })

    it('is axe-clean folded and unfolded', async () => {
        const screen = await renderGrid(makeGrid())
        const clean = async () => {
            const results = await axe.run(screen.container, {
                rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
            })
            return results.violations.flatMap((violation) =>
                violation.nodes.map((node) => `${violation.id}: ${node.html.slice(0, 120)}`)
            )
        }

        expect(await clean()).toEqual([])
        await page.getByRole('button', { name: 'Collapse Pay' }).click()
        await expect.poll(() => headers(screen.container)).toHaveLength(3)
        expect(await clean()).toEqual([])
    })

    it('folds a group whose columns are windowed away by virtualization', async () => {
        const many: ColumnDef<Person>[] = [
            { id: 'name', header: 'Name', width: 200 },
            ...Array.from({ length: 30 }, (_, i) => ({
                id: `pad${i}`,
                header: `P${i}`,
                width: 200
            })),
            {
                id: 'pay',
                header: 'Pay',
                children: [
                    { id: 'total', header: 'Total', width: 200, columnGroupShow: 'closed' },
                    { id: 'base', header: 'Base', width: 200, columnGroupShow: 'open' },
                    { id: 'bonus', header: 'Bonus', width: 200, columnGroupShow: 'open' }
                ]
            }
        ]
        const grid = createDataGrid<Person>({
            columns: many,
            data: people,
            getRowId: (row) => String(row.id),
            features: [columnOps(), virtualization({ columns: true })]
        })
        await renderGrid(grid)

        // The group sits far off to the right, so its cells are not drawn.
        expect(grid.columns.visible.map((column) => column.id)).toContain('base')
        grid.columns.toggleGroup('pay')

        await expect
            .poll(() => grid.columns.visible.map((column) => column.id))
            .not.toContain('base')
        expect(grid.columns.visible.map((column) => column.id)).toContain('total')
    })

    it('keeps a folded group folded across a rerender of the data', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        await page.getByRole('button', { name: 'Collapse Pay' }).click()
        await expect.poll(() => headers(screen.container)).toEqual(['#', 'Name', 'Total'])

        grid.data = [...people, { id: 3, name: 'Linus', total: 5, base: 4, bonus: 1 }]

        await expect
            .poll(() => screen.container.querySelectorAll('[data-dg-row-id]'))
            .toHaveLength(3)
        expect(headers(screen.container)).toEqual(['#', 'Name', 'Total'])
    })

    it('leaves the Column chooser saying what the user put away, not what folded', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        await page.getByRole('button', { name: 'Collapse Pay' }).click()
        await expect.poll(() => headers(screen.container)).toEqual(['#', 'Name', 'Total'])

        // `Base` and `Bonus` are folded away, and still ticked: the user did
        // not put them away, the group did.
        expect(grid.columns.all.filter((column) => column.hidden)).toHaveLength(0)
    })
})

describe('the columns demo', () => {
    it('folds Performance down to its year to date, and leaves Compensation alone', async () => {
        const screen = await render(ColumnsDemo as never)
        await expect.element(page.getByRole('grid').first()).toBeVisible()

        // The page draws three grids; the foldable group is on the first.
        const first = () => screen.container.querySelector('[role="grid"]')!
        const leafHeaders = () =>
            [...first().querySelectorAll('[data-dg-cell^="-1:"]')].map(
                (cell) => cell.textContent?.trim() ?? ''
            )

        expect(leafHeaders().some((header) => header.startsWith('Q1'))).toBe(true)
        expect(leafHeaders().some((header) => header.startsWith('YTD'))).toBe(false)
        // One group declares a fold, the other declares nothing.
        expect(
            screen.container.querySelectorAll('[role="columnheader"][aria-expanded]')
        ).toHaveLength(1)

        await page.getByRole('button', { name: 'Collapse Performance' }).click()

        await expect.poll(() => leafHeaders().some((h) => h.startsWith('YTD'))).toBe(true)
        expect(leafHeaders().some((header) => header.startsWith('Q1'))).toBe(false)
        // The summary column draws what its accessor adds up, rather than a
        // field of its own that nothing holds.
        // Row two holds 37, 53, 71 and 89 in its quarters; the summary is
        // what its accessor makes of them, not a field anything stores.
        const ytdIndex = leafHeaders().findIndex((header) => header.startsWith('YTD'))
        const cell = first().querySelector(`[data-dg-cell="1:${ytdIndex}"]`)
        expect(cell?.textContent?.trim()).toBe('250')
    })
})

describe('the header groups demo', () => {
    const leafHeaders = (container: Element) =>
        [...container.querySelectorAll('[data-dg-cell^="-1:"]')].map(
            (cell) => cell.textContent?.trim().split(/\s+/)[0] ?? ''
        )

    it('folds the revenue quarters into one total, through the app own header', async () => {
        const screen = await render(GroupsDemo as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        const banner = () => groupCell(screen.container)?.textContent?.replace(/\s+/g, ' ').trim()

        // The app draws the group header, and is handed the span to show.
        expect(banner()).toContain('4 quý')
        expect(leafHeaders(screen.container)).toContain('Q1')

        await page.getByRole('button', { name: 'Collapse Doanh thu' }).click()

        await expect.poll(banner).toContain('tóm tắt')
        await expect.poll(() => leafHeaders(screen.container)).not.toContain('Q1')
        expect(leafHeaders(screen.container)).toContain('Cả')

        // One door: the event reached the page's own log.
        const log = () => screen.container.querySelector('[data-testid="group-log"]')?.textContent
        await expect.poll(log).toContain('revenue: gập')
    })

    it('draws a toggle per foldable level, and none where nothing declares one', async () => {
        const screen = await render(GroupsDemo as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        const toggles = () =>
            [...screen.container.querySelectorAll('[role="columnheader"][aria-expanded]')].map(
                (cell) => cell.textContent?.trim().split(/\s+/)[0]
            )

        // Doanh thu over its two halves, each with a toggle of its own, and
        // Kế hoạch, which folds to a rail. Định danh declares nothing and is
        // no rail, so it gets none.
        expect(toggles()).toEqual(['Doanh', 'Kế', 'Nửa', 'Nửa'])

        // An inner fold leaves the group over it alone.
        await page.getByRole('button', { name: 'Collapse Nửa đầu' }).click()
        await expect
            .poll(() => leafHeaders(screen.container))
            .toEqual(['#', 'Vùng', 'Phụ', 'H1', 'Q3', 'Q4', 'Chỉ', 'Chênh'])
        expect(toggles()).toEqual(['Doanh', 'Kế', 'Nửa', 'Nửa'])

        // And the outer one folds both halves away with it.
        await page.getByRole('button', { name: 'Collapse Doanh thu' }).click()
        await expect
            .poll(() => leafHeaders(screen.container))
            .toEqual(['#', 'Vùng', 'Phụ', 'Cả', 'Chỉ', 'Chênh'])
        expect(toggles()).toEqual(['Doanh', 'Kế'])
    })
})
