import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { userEvent } from 'vitest/browser'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    filtering,
    getSelection,
    selection,
    sorting,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Person {
    id: number
    name: string
    dept: string
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

const people: Person[] = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    dept: i % 2 === 0 ? 'Core' : 'Data'
}))

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name', width: 200, sortable: true, filter: 'text' },
    { id: 'dept', header: 'Dept', width: 160, filter: 'set' }
]

function makeGrid(): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (person) => String(person.id),
        features: [sorting(), filtering(), columnOps(), selection()]
    })
}

/** Everything the browser would stop on inside the grid. */
function tabbablesInGrid(container: Element): number {
    return container.querySelectorAll(
        '[role="grid"] a[href], [role="grid"] button:not([tabindex="-1"]):not(:disabled),' +
            ' [role="grid"] input:not([tabindex="-1"]), [role="grid"] [tabindex="0"]'
    ).length
}

describe('the grid is one tab stop', () => {
    it('keeps every row checkbox out of the tab order', async () => {
        const grid = makeGrid()
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        // Twelve rows, so a tabbable checkbox each would be thirteen stops to
        // walk past on the way out of the grid.
        expect(tabbablesInGrid(screen.container)).toBe(1)

        const checkboxes = screen.container.querySelectorAll('[role="grid"] [role="checkbox"]')
        expect(checkboxes.length).toBeGreaterThan(1)
        for (const checkbox of checkboxes) {
            expect(checkbox.getAttribute('tabindex')).toBe('-1')
        }
    })

    it('reaches select-all with Space, now that its checkbox is not tabbable', async () => {
        const grid = makeGrid()
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const selectionState = getSelection(grid)!
        const cell = screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:0"]')!
        cell.focus()

        await userEvent.keyboard(' ')
        await expect.poll(() => selectionState.count).toBe(people.length)

        // And back off again — `Ctrl+A` alone would only ever select.
        await userEvent.keyboard(' ')
        await expect.poll(() => selectionState.count).toBe(0)
    })
})

describe('density toggle', () => {
    it('takes one tab stop and answers the arrows', async () => {
        const grid = makeGrid()
        const screen = await render(TypedDataGrid, { grid, toolbar: true })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const radios = [...screen.container.querySelectorAll('[role="radio"]')]
        expect(radios).toHaveLength(3)
        // Only the checked one is tabbable; the arrows move between them.
        expect(radios.filter((radio) => radio.getAttribute('tabindex') === '0')).toHaveLength(1)

        const checked = radios.find((radio) => radio.getAttribute('tabindex') === '0')!
        ;(checked as HTMLElement).focus()
        await userEvent.keyboard('{ArrowRight}')

        await expect.poll(() => grid.density).toBe('comfortable')
        await userEvent.keyboard('{ArrowLeft}')
        await expect.poll(() => grid.density).toBe('standard')
    })
})

describe('header focus ring', () => {
    it('keeps the floating controls clear of the ring the cell draws inside itself', async () => {
        const grid = makeGrid()
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const cell = screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:1"]')!
        const controls = cell.querySelector<HTMLElement>('[data-dg-noreorder]')!

        // Opaque and stretched edge to edge, the controls painted over the top
        // and bottom of the focus ring and left the outline broken.
        const cellRect = cell.getBoundingClientRect()
        const controlsRect = controls.getBoundingClientRect()
        expect(controlsRect.top).toBeGreaterThan(cellRect.top)
        expect(controlsRect.bottom).toBeLessThan(cellRect.bottom)
    })
})
