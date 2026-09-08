import {
    createDataGrid,
    editing,
    filtering,
    sorting,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'
import axe from 'axe-core'
import type { Component } from 'svelte'
import { InGrid } from './fixtures/in-root.js'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import DataGrid from '../lib/components/grid/DataGrid.svelte'
import RangeStatusBar from '../lib/components/chrome/RangeStatusBar.svelte'
import {
    getRangeSelection,
    rangeSelection
} from '../lib/features/range-selection/range-selection.svelte.js'

interface Cell {
    id: number
    region: string
    q1: number
    q2: number
}

const toNumber = (input: unknown) => (input === null || input === '' ? null : Number(input))

const columns: ColumnDef<Cell>[] = [
    { id: 'region', header: 'Region', width: 160, filter: 'text' },
    { id: 'q1', header: 'Q1', width: 120, editable: true, editor: 'number', parse: toNumber },
    { id: 'q2', header: 'Q2', width: 120, editable: true, editor: 'number', parse: toNumber }
]

function makeData(): Cell[] {
    return [
        { id: 1, region: 'North', q1: 10, q2: 20 },
        { id: 2, region: 'South', q1: 30, q2: 40 },
        { id: 3, region: 'East', q1: 50, q2: 60 }
    ]
}

const TypedGrid = DataGrid as unknown as Component<DataGridProps<Cell>>
const TypedStatus = InGrid

const inRoot = (grid: GridState<Cell>) => ({ props: { grid, component: RangeStatusBar } })

function makeGrid(): GridState<Cell> {
    return createDataGrid<Cell>({
        columns,
        data: makeData(),
        getRowId: (row) => String(row.id),
        features: [sorting(), filtering(), editing(), rangeSelection()]
    })
}

function cellAt(container: Element, row: number, col: number): HTMLElement {
    return container.querySelector<HTMLElement>(`[data-dg-cell="${row}:${col}"]`)!
}

function selectedCells(container: Element): string[] {
    return [...container.querySelectorAll('[data-dg-cell][aria-selected="true"]')].map((cell) =>
        cell.getAttribute('data-dg-cell')!
    )
}

function drag(container: Element, from: [number, number], to: [number, number]) {
    const start = cellAt(container, from[0], from[1])
    const end = cellAt(container, to[0], to[1])
    start.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
    end.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }))
    window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
}

async function renderGrid(grid: GridState<Cell>) {
    const screen = await render(TypedGrid, { grid })
    await expect.element(screen.getByRole('grid')).toBeVisible()
    return screen
}

describe('dragging a range', () => {
    it('highlights every cell in the dragged rectangle', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        drag(screen.container, [0, 1], [1, 2])

        await expect
            .poll(() => selectedCells(screen.container).sort())
            .toEqual(['0:1', '0:2', '1:1', '1:2'])
        expect(getRangeSelection(grid)!.ranges).toEqual([{ top: 0, left: 1, bottom: 1, right: 2 }])
    })

    it('replaces the range on a plain drag and adds one with Ctrl', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        const state = getRangeSelection(grid)!

        drag(screen.container, [0, 0], [0, 0])
        expect(state.ranges).toHaveLength(1)

        cellAt(screen.container, 2, 2).dispatchEvent(
            new PointerEvent('pointerdown', { bubbles: true, button: 0, ctrlKey: true })
        )
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))

        expect(state.ranges).toHaveLength(2)
        await expect.poll(() => selectedCells(screen.container).sort()).toEqual(['0:0', '2:2'])
    })

    it('leaves editors alone so a double-click can still edit', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        cellAt(screen.container, 0, 1).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await expect.element(page.getByRole('spinbutton').first()).toBeVisible()

        const input = cellAt(screen.container, 0, 1).querySelector('input')!
        input.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))
        expect(getRangeSelection(grid)!.dragging).toBe(false)
    })
})

describe('popovers above the range layer', () => {
    it('keeps focus in the filter panel and starts no range from its inputs', async () => {
        const grid = makeGrid()
        await renderGrid(grid)

        await page.getByRole('button', { name: 'Filter Region' }).click()
        const input = page.getByRole('dialog', { name: 'Filter Region' }).getByRole('textbox')
        await input.click()

        await userEvent.keyboard('nor')

        const active = document.activeElement
        expect(active?.closest('[role="dialog"]')).not.toBeNull()
        expect((active as HTMLInputElement).value).toBe('nor')
        expect(getRangeSelection(grid)!.ranges).toEqual([])
    })

    it('ignores a pointerdown on a header cell', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        screen.container
            .querySelector('[data-dg-cell="-1:0"]')!
            .dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0 }))

        expect(getRangeSelection(grid)!.ranges).toEqual([])
    })
})

describe('keyboard range', () => {
    it('extends with Shift+Arrow from the focused cell', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        await page.getByRole('gridcell', { name: 'North' }).click()
        await expect.poll(() => grid.focus.active).toEqual({ row: 0, col: 0 })

        await userEvent.keyboard('{Shift>}{ArrowDown}{ArrowRight}{/Shift}')

        await expect
            .poll(() => selectedCells(screen.container).sort())
            .toEqual(['0:0', '0:1', '1:0', '1:1'])
    })

    it('clears with Escape', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        drag(screen.container, [0, 0], [1, 1])

        await page.getByRole('gridcell', { name: 'North' }).click()
        await userEvent.keyboard('{Escape}')
        await expect.poll(() => selectedCells(screen.container)).toEqual([])
    })
})

describe('clipboard round-trip', () => {
    it('copies the range as TSV and as a table', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        drag(screen.container, [0, 1], [1, 2])

        const flavours: Record<string, string> = {}
        vi.spyOn(navigator.clipboard, 'write').mockImplementation(async (items) => {
            for (const item of items) {
                for (const type of item.types)
                    flavours[type] = await (await item.getType(type)).text()
            }
        })

        await getRangeSelection(grid)!.copyRange()
        expect(flavours['text/plain']).toBe('10\t20\n30\t40')
        expect(flavours['text/html']).toBe(
            '<table><tr><td>10</td><td>20</td></tr><tr><td>30</td><td>40</td></tr></table>'
        )
        vi.restoreAllMocks()
    })

    it('writes plain text alone when the browser has no ClipboardItem', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        drag(screen.container, [0, 1], [1, 2])

        const written: string[] = []
        const item = globalThis.ClipboardItem
        Reflect.deleteProperty(globalThis, 'ClipboardItem')
        vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (text) => {
            written.push(text)
        })

        try {
            await getRangeSelection(grid)!.copyRange()
        } finally {
            Reflect.set(globalThis, 'ClipboardItem', item)
        }

        expect(written).toEqual(['10\t20\n30\t40'])
        vi.restoreAllMocks()
    })

    it('skips the table flavour when the caller asks for plain text only', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        drag(screen.container, [0, 1], [1, 2])

        const written: string[] = []
        vi.spyOn(navigator.clipboard, 'writeText').mockImplementation(async (text) => {
            written.push(text)
        })

        await getRangeSelection(grid)!.copyRange({ html: false })
        expect(written).toEqual(['10\t20\n30\t40'])
        vi.restoreAllMocks()
    })

    it('pastes a block, runs validation and undoes in one step', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        drag(screen.container, [0, 1], [0, 1])

        expect(getRangeSelection(grid)!.pasteText('1\t2\n3\t4')).toBe(true)
        expect(grid.data[0]).toMatchObject({ q1: 1, q2: 2 })
        expect(grid.data[1]).toMatchObject({ q1: 3, q2: 4 })

        const undo = grid.api.undo as () => void
        undo()
        expect(grid.data[0]).toMatchObject({ q1: 10, q2: 20 })
        expect(grid.data[1]).toMatchObject({ q1: 30, q2: 40 })
        void screen
    })
})

describe('Ctrl+Enter over a range', () => {
    it('writes the value being typed into every selected cell', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        drag(screen.container, [0, 1], [1, 2])

        cellAt(screen.container, 0, 1).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await expect.element(page.getByRole('spinbutton').first()).toBeVisible()

        const input = cellAt(screen.container, 0, 1).querySelector('input')!
        input.focus()
        await userEvent.fill(input, '7')
        await userEvent.keyboard('{Control>}{Enter}{/Control}')

        expect(grid.data[0]).toMatchObject({ q1: 7, q2: 7 })
        expect(grid.data[1]).toMatchObject({ q1: 7, q2: 7 })
        expect(grid.data[2]).toMatchObject({ q1: 50, q2: 60 })
    })

    it('leaves the grid to commit the one cell when nothing else is selected', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)

        cellAt(screen.container, 0, 1).dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await expect.element(page.getByRole('spinbutton').first()).toBeVisible()

        const input = cellAt(screen.container, 0, 1).querySelector('input')!
        input.focus()
        await userEvent.fill(input, '7')
        await userEvent.keyboard('{Control>}{Enter}{/Control}')

        expect(grid.data[0]).toMatchObject({ q1: 7, q2: 20 })
    })
})

describe('moving a range by its border', () => {
    it('drags the block to a new place and clears the old one', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        drag(screen.container, [0, 1], [0, 2])

        const source = cellAt(screen.container, 0, 1)
        const box = source.getBoundingClientRect()
        source.dispatchEvent(
            new PointerEvent('pointerdown', {
                bubbles: true,
                button: 0,
                clientX: box.left + 1,
                clientY: box.top + box.height / 2
            })
        )
        cellAt(screen.container, 2, 1).dispatchEvent(
            new PointerEvent('pointermove', { bubbles: true })
        )
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
        await vi.waitFor(() => expect(grid.data[2]).toMatchObject({ q1: 10, q2: 20 }))

        expect(grid.data[0]).toMatchObject({ q1: null, q2: null })
        expect(getRangeSelection(grid)!.ranges).toEqual([{ top: 2, left: 1, bottom: 2, right: 2 }])
    })

    it('starts a range instead when the pointer lands away from the border', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        drag(screen.container, [0, 1], [1, 2])

        const inside = cellAt(screen.container, 1, 2)
        const box = inside.getBoundingClientRect()
        inside.dispatchEvent(
            new PointerEvent('pointerdown', {
                bubbles: true,
                button: 0,
                clientX: box.left + box.width / 2,
                clientY: box.top + box.height / 2
            })
        )
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))

        expect(getRangeSelection(grid)!.cutSource).toBeNull()
        expect(getRangeSelection(grid)!.ranges).toEqual([{ top: 1, left: 2, bottom: 1, right: 2 }])
        expect(grid.data[0]).toMatchObject({ q1: 10 })
    })
})

describe('range status bar', () => {
    it('sums the selected numeric cells', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        drag(screen.container, [0, 1], [1, 2])

        const bar = await render(TypedStatus, inRoot(grid))
        await expect.element(bar.getByText(/4 cells/)).toBeVisible()
        await expect.element(bar.getByText('100')).toBeVisible()
    })

    it('drops the shape when the count spans more than one block', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        await render(TypedStatus, inRoot(grid))

        drag(screen.container, [0, 1], [1, 2])
        await expect.element(page.getByText('4 cells (2x2)')).toBeVisible()

        const state = getRangeSelection(grid)!
        state.startRange(2, 0, { additive: true })
        state.endRange()

        await vi.waitFor(() => {
            const bar = document.querySelector('[data-dg-range-status]')
            expect(bar?.textContent).toContain('5 cells')
        })
        expect(document.querySelector('[data-dg-range-status]')?.textContent).not.toContain('(2x2)')
    })

    it('stays hidden without a range', async () => {
        const grid = makeGrid()
        const bar = await render(TypedStatus, inRoot(grid))
        expect(bar.container.querySelector('[data-dg-range-status]')).toBeNull()
    })
})

describe('a11y', () => {
    it('is axe-clean with a range selected', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        drag(screen.container, [0, 0], [1, 1])

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })

    it('is axe-clean while a cut is marked and a move is previewed', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        drag(screen.container, [0, 1], [1, 2])

        const state = getRangeSelection(grid)!
        state.startMove(0, 1)
        state.extendMove(2, 1)
        await vi.waitFor(() =>
            expect(
                screen.container.querySelectorAll('[aria-selected="true"]').length
            ).toBeGreaterThan(0)
        )

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })
})

describe('the fill handle', () => {
    function grabHandle(cell: HTMLElement, inset = 2) {
        const box = cell.getBoundingClientRect()
        cell.dispatchEvent(
            new PointerEvent('pointerdown', {
                bubbles: true,
                button: 0,
                clientX: box.right - inset,
                clientY: box.bottom - inset
            })
        )
    }

    async function selectQ1Rows(container: Element) {
        drag(container, [0, 1], [1, 1])
        await expect.poll(() => selectedCells(container)).toEqual(['0:1', '1:1'])
    }

    it('draws itself on the range corner and nowhere else', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        await selectQ1Rows(screen.container)

        const handles = [...screen.container.querySelectorAll('[data-dg-cell]')]
            .filter((cell) => cell.className.includes('after:bg-primary'))
            .map((cell) => cell.getAttribute('data-dg-cell'))
        expect(handles).toEqual(['1:1'])
    })

    it('writes through the handle and selects what it wrote', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        await selectQ1Rows(screen.container)

        grabHandle(cellAt(screen.container, 1, 1))
        cellAt(screen.container, 1, 2).dispatchEvent(
            new PointerEvent('pointermove', { bubbles: true })
        )
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))

        await expect.poll(() => grid.data.map((row) => row.q2)).toEqual([10, 30, 60])
        await expect
            .poll(() => selectedCells(screen.container))
            .toEqual(['0:1', '0:2', '1:1', '1:2'])
    })

    it('carries a series down the rows, not only across the columns', async () => {
        const grid = createDataGrid<Cell>({
            columns,
            data: [
                { id: 1, region: 'North', q1: 10, q2: 20 },
                { id: 2, region: 'South', q1: 20, q2: 40 },
                { id: 3, region: 'East', q1: 0, q2: 60 },
                { id: 4, region: 'West', q1: 0, q2: 80 },
                { id: 5, region: 'Nord', q1: 0, q2: 100 }
            ],
            getRowId: (row) => String(row.id),
            features: [sorting(), filtering(), editing(), rangeSelection()]
        })
        const screen = await renderGrid(grid)
        await selectQ1Rows(screen.container)

        grabHandle(cellAt(screen.container, 1, 1))
        cellAt(screen.container, 4, 1).dispatchEvent(
            new PointerEvent('pointermove', { bubbles: true })
        )
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))

        await expect.poll(() => grid.data.map((row) => row.q1)).toEqual([10, 20, 30, 40, 50])
    })

    it('draws no handle at all when fill is switched off', async () => {
        const grid = createDataGrid<Cell>({
            columns,
            data: makeData(),
            getRowId: (row) => String(row.id),
            features: [sorting(), filtering(), editing(), rangeSelection({ fill: false })]
        })
        const screen = await renderGrid(grid)
        await selectQ1Rows(screen.container)

        const handles = [...screen.container.querySelectorAll('[data-dg-cell]')].filter((cell) =>
            cell.className.includes('after:bg-primary')
        )
        expect(handles).toEqual([])
    })

    it('outlines the range once, not once per cell', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        drag(screen.container, [0, 1], [1, 2])
        await expect
            .poll(() => selectedCells(screen.container).sort())
            .toEqual(['0:1', '0:2', '1:1', '1:2'])

        const sides = (row: number, col: number) => {
            const className = cellAt(screen.container, row, col).className
            return {
                top: className.includes('before:border-t'),
                bottom: className.includes('before:border-b'),
                start: className.includes('before:border-s'),
                end: className.includes('before:border-e')
            }
        }

        expect(sides(0, 1)).toEqual({ top: true, bottom: false, start: true, end: false })
        expect(sides(0, 2)).toEqual({ top: true, bottom: false, start: false, end: true })
        expect(sides(1, 1)).toEqual({ top: false, bottom: true, start: true, end: false })
        expect(sides(1, 2)).toEqual({ top: false, bottom: true, start: false, end: true })
    })

    it('boxes a single cell on all four sides', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        drag(screen.container, [1, 1], [1, 1])
        await expect.poll(() => selectedCells(screen.container)).toEqual(['1:1'])

        const className = cellAt(screen.container, 1, 1).className
        for (const side of [
            'before:border-t',
            'before:border-b',
            'before:border-s',
            'before:border-e'
        ]) {
            expect(className, side).toContain(side)
        }
    })

    it('suppresses text selection while the handle is being dragged', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        await selectQ1Rows(screen.container)

        const layer = screen.container.querySelector<HTMLElement>('[data-dg-range-layer]')!
        expect(layer.style.userSelect).toBe('')

        grabHandle(cellAt(screen.container, 1, 1))

        await expect.poll(() => layer.style.userSelect).toBe('none')

        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
        await expect.poll(() => layer.style.userSelect).toBe('')
    })

    it('starts a new range when the pointer lands away from the corner', async () => {
        const grid = makeGrid()
        const screen = await renderGrid(grid)
        await selectQ1Rows(screen.container)

        const cell = cellAt(screen.container, 1, 1)
        const box = cell.getBoundingClientRect()
        cell.dispatchEvent(
            new PointerEvent('pointerdown', {
                bubbles: true,
                button: 0,
                clientX: box.left + box.width / 2,
                clientY: box.top + box.height / 2
            })
        )
        window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))

        await expect.poll(() => selectedCells(screen.container)).toEqual(['1:1'])
    })
})
