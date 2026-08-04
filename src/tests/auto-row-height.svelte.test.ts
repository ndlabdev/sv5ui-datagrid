import { createRawSnippet, type Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import {
    createDataGrid,
    DataGrid,
    getVirtualization,
    virtualization,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Note {
    id: number
    text: string
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Note>>

/** Row 2 wraps onto several lines; the rest are one line. */
const notes: Note[] = [
    { id: 1, text: 'short' },
    { id: 2, text: 'a very long note that has to wrap over several lines in a narrow column' },
    { id: 3, text: 'short' },
    { id: 4, text: 'short' }
]

const wrapCell = createRawSnippet<[{ value: unknown }]>((context) => ({
    render: () => `<span style="display:block;white-space:normal">${context().value}</span>`
}))

const columns: ColumnDef<Note>[] = [{ id: 'text', header: 'Note', width: 160, cell: wrapCell }]

function makeGrid(getRowHeight: (node: { row: Note }) => number | 'auto'): GridState<Note> {
    return createDataGrid<Note>({
        columns,
        data: notes,
        getRowId: (note) => String(note.id),
        features: [virtualization({ rowHeight: 40, getRowHeight, initialRows: 4 })]
    })
}

function rowElement(container: Element, id: string): HTMLElement {
    const row = container.querySelector<HTMLElement>(`[data-dg-row-id="${id}"]`)
    if (!row) throw new Error(`no row ${id}`)
    return row
}

describe("getRowHeight: 'auto'", () => {
    it('lets the row size itself instead of pinning a height on it', async () => {
        const grid = makeGrid(() => 'auto')
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        // No inline height: the content decides.
        expect(rowElement(screen.container, '1').style.height).toBe('')
        // And the wrapping row really is taller than the one-liners.
        await expect
            .poll(() => rowElement(screen.container, '2').offsetHeight)
            .toBeGreaterThan(rowElement(screen.container, '1').offsetHeight)
    })

    it('feeds the measured heights back into the scroll total', async () => {
        const grid = makeGrid(() => 'auto')
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const virtualizer = getVirtualization(grid)!.virtualizer
        const rendered = notes.reduce(
            (sum, note) => sum + rowElement(screen.container, String(note.id)).offsetHeight,
            0
        )

        // Starts at the 40px estimate, then settles on what was measured.
        await expect.poll(() => Math.round(virtualizer.totalHeight)).toBe(Math.round(rendered))
        expect(virtualizer.totalHeight).toBeGreaterThan(notes.length * 40)
    })

    it('still honours a numeric height, and mixes the two', async () => {
        const grid = makeGrid((node) => (node.row.id === 2 ? 'auto' : 72))
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        expect(rowElement(screen.container, '1').style.height).toBe('72px')
        expect(rowElement(screen.container, '2').style.height).toBe('')
        await expect.poll(() => getVirtualization(grid)!.virtualizer.sizeOf(0)).toBe(72)
    })

    it('keeps a row measurement across a re-sort, because it is keyed by id', async () => {
        const grid = makeGrid(() => 'auto')
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const virtualizer = getVirtualization(grid)!.virtualizer
        await expect.poll(() => virtualizer.sizeOf(1)).toBeGreaterThan(40)
        const tall = virtualizer.sizeOf(1)

        // Reverse the data: the tall row is now first and must stay tall.
        grid.data = [...notes].reverse()
        await expect.poll(() => virtualizer.sizeOf(2)).toBe(tall)
    })
})
