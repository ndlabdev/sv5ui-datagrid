import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    getPagination,
    pagination,
    rowPinning,
    sorting,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Person {
    id: number
    name: string
    note: string
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

const people: Person[] = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    note: i === 0 ? 'A note far too long to fit inside a narrow column' : 'short'
}))

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name', width: 140 },
    { id: 'note', header: 'Note', width: 120 }
]

function pinnedGrid(): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (person) => String(person.id),
        features: [
            sorting(),
            rowPinning({
                isRowPinned: (person) =>
                    person.id === 1 ? 'top' : person.id === 12 ? 'bottom' : null
            })
        ]
    })
}

async function renderGrid(grid: GridState<Person>) {
    const screen = await render(TypedDataGrid, { grid })
    await expect.element(screen.getByRole('grid')).toBeVisible()
    return screen
}

function activeDescriptor(): string | null {
    const cell = document.activeElement as HTMLElement | null
    return cell?.getAttribute('data-dg-pinned-cell') ?? cell?.getAttribute('data-dg-cell') ?? null
}

describe('pinned row keyboard access', () => {
    it('walks header → pinned top → body → pinned bottom with arrows', async () => {
        const grid = pinnedGrid()
        const screen = await renderGrid(grid)

        screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:0"]')!.focus()
        expect(grid.focus.active).toEqual({ row: -1, col: 0 })

        await userEvent.keyboard('{ArrowDown}')
        expect(grid.focus.active).toEqual({ row: 0, col: 0, section: 'top' })
        await expect.poll(activeDescriptor).toBe('top:0:0')

        await userEvent.keyboard('{ArrowDown}')
        expect(grid.focus.active).toEqual({ row: 0, col: 0 })
        await expect.poll(activeDescriptor).toBe('0:0')

        await userEvent.keyboard('{ArrowUp}')
        expect(grid.focus.active).toEqual({ row: 0, col: 0, section: 'top' })
    })

    it('reaches the bottom pinned row past the end of the body', async () => {
        const grid = pinnedGrid()
        const screen = await renderGrid(grid)

        // DOM focus only follows the model once focus is already inside the
        // grid — the grid must never steal it from elsewhere on the page.
        screen.container.querySelector<HTMLElement>('[data-dg-cell="0:0"]')!.focus()
        grid.focus.focusCell({ row: grid.totalRows - 1, col: 0 })
        grid.focus.moveBy(1, 0)

        expect(grid.focus.active).toEqual({ row: 0, col: 0, section: 'bottom' })
        await expect.poll(activeDescriptor).toBe('bottom:0:0')
    })

    it('keeps body positions free of a section so consumers reading row are unaffected', () => {
        const grid = pinnedGrid()
        grid.focus.focusCell({ row: 3, col: 1 })
        expect(grid.focus.active).toEqual({ row: 3, col: 1 })
        expect('section' in grid.focus.active).toBe(false)
    })

    it('ignores a section that has no rows', () => {
        const grid = createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (person) => String(person.id),
            features: [sorting()]
        })
        grid.focus.focusCell({ row: 0, col: 0, section: 'top' })
        expect(grid.focus.active).toEqual({ row: -1, col: 0 })
    })
})

describe('tooltip on truncation', () => {
    it('adds a title only to text that is actually cut off', async () => {
        const grid = createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (person) => String(person.id),
            features: [sorting()]
        })
        const screen = await renderGrid(grid)

        const long = screen.container.querySelector<HTMLElement>(
            '[data-dg-cell="0:1"] [data-dg-truncate]'
        )!
        const short = screen.container.querySelector<HTMLElement>(
            '[data-dg-cell="1:1"] [data-dg-truncate]'
        )!

        expect(long.title).toBe('')

        long.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))
        short.dispatchEvent(new PointerEvent('pointerover', { bubbles: true }))

        expect(long.title).toBe('A note far too long to fit inside a narrow column')
        expect(short.title).toBe('')
    })
})

describe('server-side pagination', () => {
    function serverGrid(): GridState<Person> {
        return createDataGrid<Person>({
            columns,
            data: people.slice(0, 5),
            getRowId: (person) => String(person.id),
            features: [sorting(), pagination({ pageSize: 5, rowCount: 137 })]
        })
    }

    it('stops slicing because the data already is the page', () => {
        const grid = serverGrid()
        expect(grid.nodes).toHaveLength(5)
        expect(getPagination(grid)!.server).toBe(true)
    })

    it('counts pages against the server total', () => {
        const state = getPagination(serverGrid())!
        expect(state.total).toBe(137)
        expect(state.pageCount).toBe(28)
    })

    it('reports the server total in the footer', async () => {
        const grid = serverGrid()
        await renderGrid(grid)
        await expect.element(page.getByText('1–5 of 137')).toBeVisible()
    })

    it('clamps the page when the total shrinks under it', () => {
        const state = getPagination(serverGrid())!
        state.setPage(28)
        state.setRowCount(12)
        expect(state.pageCount).toBe(3)
        expect(state.page).toBe(3)
    })

    it('falls back to the client total once rowCount is cleared', () => {
        const state = getPagination(serverGrid())!
        state.setRowCount(null)
        expect(state.server).toBe(false)
        expect(state.total).toBe(5)
    })
})
