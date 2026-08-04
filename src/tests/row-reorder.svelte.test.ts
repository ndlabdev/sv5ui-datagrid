import type { Component } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { userEvent } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    getRowReorder,
    rowReorder,
    selection,
    virtualization,
    sorting,
    type ColumnDef,
    type DataGridProps,
    type GridFeature,
    type GridState,
    type SortState
} from '$lib/index.js'

interface Task {
    id: number
    name: string
    locked?: boolean
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Task>>

const tasks: Task[] = [
    { id: 1, name: 'Alpha' },
    { id: 2, name: 'Bravo' },
    { id: 3, name: 'Charlie' },
    { id: 4, name: 'Delta' }
]

const columns: ColumnDef<Task>[] = [{ id: 'name', header: 'Name', sortable: true, flex: 1 }]

function makeGrid(features: GridFeature<Task>[]): GridState<Task> {
    return createDataGrid<Task>({
        columns,
        data: [...tasks],
        getRowId: (task) => String(task.id),
        features
    })
}

async function mount(grid: GridState<Task>) {
    const screen = await render(TypedDataGrid, { grid })
    await expect.element(screen.getByRole('grid')).toBeVisible()
    return screen
}

const order = (grid: GridState<Task>) => grid.data.map((task) => task.name)

interface PointerAt {
    /** Defaults to the grip column, which is where a drag starts. */
    clientX?: number
    pointerType?: string
}

function pointer(target: Element, type: string, clientY: number, at: PointerAt = {}) {
    const { clientX = 20, pointerType = 'mouse' } = at
    target.dispatchEvent(
        new PointerEvent(type, {
            bubbles: true,
            composed: true,
            cancelable: true,
            pointerId: 1,
            isPrimary: true,
            button: 0,
            pointerType,
            clientX,
            clientY
        })
    )
}

/** The floating copy of a row, marked so nothing else can be mistaken for it. */
const ghosts = () => document.querySelectorAll('[data-dg-ghost]')

/** The copy flies to its landing spot after a drop; wait for it to clear. */
const settled = () => expect.poll(() => ghosts().length).toBe(0)

function handleOf(container: Element, position: number): HTMLElement {
    const handle = container.querySelector<HTMLElement>(`[aria-label="Move row ${position}"]`)
    if (!handle) throw new Error(`no handle for row ${position}`)
    return handle
}

describe('row reorder', () => {
    it('renders a grip column ahead of the checkbox', async () => {
        const grid = makeGrid([rowReorder(), selection()])
        const screen = await mount(grid)

        expect(grid.columns.visible.map((column) => column.id)).toEqual([
            '__dg-row-handle__',
            '__dg-select__',
            'name'
        ])
        expect(handleOf(screen.container, 1)).toBeTruthy()
    })

    it('moves a row by dragging its grip onto another row', async () => {
        const grid = makeGrid([rowReorder()])
        const screen = await mount(grid)

        const handle = handleOf(screen.container, 1)
        const target = screen.container.querySelector<HTMLElement>('[data-dg-row-id="3"]')!
        const rect = target.getBoundingClientRect()
        const overTarget = rect.top + rect.height / 2

        pointer(handle, 'pointerdown', 10)
        // Past the threshold, so the press counts as a drag rather than a tap.
        pointer(handle, 'pointermove', overTarget)
        // The target is resolved in an animation frame, together with the
        // auto-scroll, so the drop needs one to land on.
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        pointer(handle, 'pointerup', overTarget)

        await expect.poll(() => order(grid)).toEqual(['Bravo', 'Charlie', 'Alpha', 'Delta'])
        await settled()
    })

    it('reports the move once, with the data indices', async () => {
        const onReorder = vi.fn()
        const grid = makeGrid([rowReorder({ onReorder })])
        const moved = vi.fn()
        grid.events.on('rowMoved', moved)
        await mount(grid)

        getRowReorder(grid)!.moveRow('4', 0)

        expect(order(grid)).toEqual(['Delta', 'Alpha', 'Bravo', 'Charlie'])
        expect(moved).toHaveBeenCalledOnce()
        expect(moved.mock.calls[0][0]).toMatchObject({ id: '4', from: 3, to: 0 })
        expect(onReorder).toHaveBeenCalledOnce()
        expect(onReorder.mock.calls[0][0]).toMatchObject({ from: 3, to: 0 })
    })

    it('moves the focused row with Alt+Arrow and announces the new position', async () => {
        const grid = makeGrid([rowReorder()])
        const screen = await mount(grid)

        const cell = screen.container.querySelector<HTMLElement>('[data-dg-cell="0:1"]')!
        cell.focus()
        await userEvent.keyboard('{Alt>}{ArrowDown}{/Alt}')

        await expect.poll(() => order(grid)).toEqual(['Bravo', 'Alpha', 'Charlie', 'Delta'])
        expect(grid.announcer.message).toBe('row moved to position 2')
    })

    it('refuses to move a row the app locked', async () => {
        const grid = makeGrid([rowReorder({ isRowDraggable: (task) => task.id !== 1 })])
        const screen = await mount(grid)

        expect(handleOf(screen.container, 1).hasAttribute('disabled')).toBe(true)
        getRowReorder(grid)!.moveRow('1', 2)
        expect(order(grid)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta'])

        // Its neighbours still move, including past the locked row.
        getRowReorder(grid)!.moveRow('3', 0)
        expect(order(grid)).toEqual(['Charlie', 'Alpha', 'Bravo', 'Delta'])
    })

    it('drops onto the row the user aimed at even while sorted', async () => {
        const grid = makeGrid([rowReorder(), sorting()])
        await mount(grid)

        // Descending: Delta, Charlie, Bravo, Alpha.
        ;(grid.api.setSort as (sort: SortState[]) => void)([
            { columnId: 'name', direction: 'desc' }
        ])
        await expect
            .poll(() => grid.nodes.map((node) => node.row.name))
            .toEqual(['Delta', 'Charlie', 'Bravo', 'Alpha'])

        // Move Delta (rendered first) to where Bravo sits.
        getRowReorder(grid)!.moveRow('4', 2)
        // Dropped where Bravo was, so it lands after Bravo in `data`.
        expect(order(grid)).toEqual(['Alpha', 'Bravo', 'Delta', 'Charlie'])
        // What renders is still the sort's business, not the drop's.
        expect(grid.nodes.map((node) => node.row.name)).toEqual([
            'Delta',
            'Charlie',
            'Bravo',
            'Alpha'
        ])
    })

    it('can be used without the grip column', async () => {
        const grid = makeGrid([rowReorder({ handle: false })])
        const screen = await mount(grid)

        expect(grid.columns.visible.map((column) => column.id)).toEqual(['name'])
        expect(screen.container.querySelector('[aria-label^="Move row"]')).toBeNull()
    })
})

describe('the drag gesture', () => {
    async function pressGrip(grid: GridState<Task>, position = 1) {
        const screen = await mount(grid)
        const handle = handleOf(screen.container, position)
        pointer(handle, 'pointerdown', 10)
        return { screen, handle }
    }

    it('treats a press that barely moves as a tap, not a reorder', async () => {
        const grid = makeGrid([rowReorder()])
        const { handle } = await pressGrip(grid)

        // Two pixels: under the threshold, so no ghost and no drag state.
        pointer(handle, 'pointermove', 12)
        expect(getRowReorder(grid)!.drag).toBeNull()
        expect(ghosts()).toHaveLength(0)

        pointer(handle, 'pointerup', 12)
        expect(order(grid)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta'])
    })

    it('lifts a copy of the row and dims the one left behind', async () => {
        const grid = makeGrid([rowReorder()])
        const { screen, handle } = await pressGrip(grid)

        pointer(handle, 'pointermove', 90)
        await expect.poll(() => ghosts().length).toBe(1)

        const ghost = ghosts()[0] as HTMLElement
        // A copy, not the row itself: it must not answer hit tests or be read.
        expect(ghost.hasAttribute('data-dg-row-id')).toBe(false)
        expect(ghost.style.pointerEvents).toBe('none')
        // The row is a CSS grid whose tracks come from an ancestor variable;
        // without carrying the resolved template the copy collapses.
        expect(ghost.style.gridTemplateColumns).not.toBe('')

        const source = screen.container.querySelector<HTMLElement>('[data-dg-row-id="1"]')!
        expect(source.className).toContain('opacity-40')

        pointer(handle, 'pointerup', 90)
        await settled()
    })

    it('abandons the drag on Escape, leaving the order alone', async () => {
        const grid = makeGrid([rowReorder()])
        const { handle } = await pressGrip(grid)

        const target = document.querySelector<HTMLElement>('[data-dg-row-id="4"]')!
        const rect = target.getBoundingClientRect()
        pointer(handle, 'pointermove', rect.top + rect.height / 2)
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))

        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))

        await settled()
        expect(getRowReorder(grid)!.drag).toBeNull()
        expect(order(grid)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta'])
    })

    it('scrolls the viewport when the cursor reaches its edge', async () => {
        // Enough rows to scroll, and a short viewport to scroll within.
        const grid = createDataGrid<Task>({
            columns,
            data: Array.from({ length: 60 }, (_, i) => ({ id: i + 1, name: `Task ${i + 1}` })),
            getRowId: (task) => String(task.id),
            features: [rowReorder(), virtualization({ rowHeight: 32, overscan: 4 })]
        })
        const screen = await render(TypedDataGrid, { grid, class: 'max-h-40' })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const viewport = screen.container.querySelector<HTMLElement>('[role="grid"]')!
        expect(viewport.scrollTop).toBe(0)

        const handle = handleOf(screen.container, 1)
        pointer(handle, 'pointerdown', 10)
        // Hold the cursor just inside the bottom edge; the list has to come to
        // the cursor, otherwise only the rows already on screen are reachable.
        pointer(handle, 'pointermove', viewport.getBoundingClientRect().bottom - 4)

        await expect.poll(() => viewport.scrollTop).toBeGreaterThan(0)
        pointer(handle, 'pointercancel', 0)
    })
})

describe('landing and touch', () => {
    it('flies the copy to where the row ended up instead of blinking it away', async () => {
        const grid = makeGrid([rowReorder()])
        const screen = await mount(grid)

        const handle = handleOf(screen.container, 1)
        const target = screen.container.querySelector<HTMLElement>('[data-dg-row-id="3"]')!
        const overTarget = target.getBoundingClientRect().top + 10

        pointer(handle, 'pointerdown', 10)
        pointer(handle, 'pointermove', overTarget)
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
        pointer(handle, 'pointerup', overTarget)

        // The data moves at once; the copy is still in the air, animating.
        expect(order(grid)).toEqual(['Bravo', 'Charlie', 'Alpha', 'Delta'])
        await expect.poll(() => ghosts()[0]?.getAnimations().length ?? 0).toBeGreaterThan(0)
        await settled()
    })

    it('carries the grid variables, so pinned cells keep their offset', async () => {
        const grid = makeGrid([rowReorder(), selection()])
        const screen = await mount(grid)
        const handle = handleOf(screen.container, 1)
        const row = screen.container.querySelector<HTMLElement>('[data-dg-row-id="1"]')!

        pointer(handle, 'pointerdown', 10)
        pointer(handle, 'pointermove', 120)
        await expect.poll(() => ghosts().length).toBe(1)

        // The grid drives its geometry from custom properties on ancestors of
        // the row. Moved to `<body>` the copy loses them, and the pinned grip
        // and checkbox fall back to `auto` — their background then paints over
        // the copy's own edge, which shows up as a broken border.
        const offsets = (element: Element) =>
            [...element.children].slice(0, 2).map((cell) => getComputedStyle(cell).insetInlineStart)

        expect(offsets(ghosts()[0])).toEqual(offsets(row))
        expect(offsets(ghosts()[0])).not.toContain('auto')

        // Those same pinned cells carry a square opaque background. Unclipped,
        // it spills past the rounded corners and eats the ring's arc on the
        // left — the right corners stay clean, which is what gives it away.
        expect(getComputedStyle(ghosts()[0]).overflow).toBe('hidden')

        pointer(handle, 'pointercancel', 120)
        await settled()
    })

    it('lets the copy leave the grid, so it reads as lifted', async () => {
        const grid = makeGrid([rowReorder()])
        const screen = await mount(grid)
        const handle = handleOf(screen.container, 1)
        const row = screen.container.querySelector<HTMLElement>('[data-dg-row-id="1"]')!
        const before = row.getBoundingClientRect()

        pointer(handle, 'pointerdown', 10)
        // Down *and* 300px across.
        pointer(handle, 'pointermove', 120, { clientX: 320 })
        await expect.poll(() => ghosts().length).toBe(1)

        // Pinned to the column it came from, the copy sits flush on the list
        // and is indistinguishable from the row beneath it.
        const ghost = (ghosts()[0] as HTMLElement).getBoundingClientRect()
        expect(Math.round(ghost.left - before.left)).toBe(300)
        expect(Math.round(ghost.top - before.top)).toBe(110)

        pointer(handle, 'pointercancel', 120, { clientX: 320 })
        await settled()
    })

    it('lets a finger scroll the grip, and only reorders once it rests', async () => {
        const grid = makeGrid([rowReorder()])
        const screen = await mount(grid)
        const handle = handleOf(screen.container, 1)

        // A swipe: the finger leaves before the hold is up, so the gesture
        // stays the browser's and the list just scrolls.
        pointer(handle, 'pointerdown', 10, { pointerType: 'touch' })
        pointer(handle, 'pointermove', 60, { pointerType: 'touch' })
        expect(getRowReorder(grid)!.drag).toBeNull()
        expect(ghosts()).toHaveLength(0)
        pointer(handle, 'pointerup', 60, { pointerType: 'touch' })
        expect(order(grid)).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta'])

        // A hold: stay put long enough and the row comes up.
        pointer(handle, 'pointerdown', 10, { pointerType: 'touch' })
        await expect.poll(() => ghosts().length, { timeout: 2000 }).toBe(1)
        expect(getRowReorder(grid)!.drag?.sourceId).toBe('1')
        pointer(handle, 'pointercancel', 10, { pointerType: 'touch' })
        await settled()
    })

    it('scrolls the page when the grid has no scroller of its own', async () => {
        // No height cap, so the grid is as tall as its rows and the window is
        // what has to move for a row to reach a position further down.
        const grid = createDataGrid<Task>({
            columns,
            data: Array.from({ length: 80 }, (_, i) => ({ id: i + 1, name: `Task ${i + 1}` })),
            getRowId: (task) => String(task.id),
            features: [rowReorder()]
        })
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const viewport = screen.container.querySelector<HTMLElement>('[role="grid"]')!
        expect(viewport.scrollHeight).toBeLessThanOrEqual(viewport.clientHeight + 1)
        window.scrollTo(0, 0)

        const handle = handleOf(screen.container, 1)
        pointer(handle, 'pointerdown', 10)
        pointer(handle, 'pointermove', window.innerHeight - 4)

        await expect.poll(() => window.scrollY).toBeGreaterThan(0)
        pointer(handle, 'pointercancel', 0)
        await settled()
        window.scrollTo(0, 0)
    })
})
