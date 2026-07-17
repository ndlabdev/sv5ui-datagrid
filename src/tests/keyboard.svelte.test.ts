import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { userEvent } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    filtering,
    getPagination,
    getVirtualization,
    pagination,
    sorting,
    virtualization,
    type ColumnDef,
    type DataGridProps
} from '$lib/index.js'
import VirtualGrid from './VirtualGrid.svelte'

interface Person {
    id: number
    name: string
    age: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

const people: Person[] = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    age: 20 + i
}))

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name', sortable: true, flex: 1, minWidth: 140 },
    { id: 'age', header: 'Age', sortable: true, align: 'right', width: 100 }
]

const getRowId = (person: Person) => String(person.id)

function activeCell(): string | null {
    return document.activeElement?.getAttribute('data-dg-cell') ?? null
}

describe('keyboard navigation', () => {
    it('is a single tab stop with a roving tabindex', async () => {
        const screen = await render(TypedDataGrid, {
            data: people.slice(0, 5),
            columns,
            getRowId
        })

        const tabbable = screen.container.querySelectorAll('[data-dg-cell][tabindex="0"]')
        expect(tabbable).toHaveLength(1)
        expect(tabbable[0]?.getAttribute('data-dg-cell')).toBe('-1:0')
    })

    it('moves focus with the full arrow/Home/End/Ctrl matrix', async () => {
        const screen = await render(TypedDataGrid, {
            data: people.slice(0, 5),
            columns,
            getRowId
        })

        const firstHeader = screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:0"]')!
        firstHeader.focus()

        await userEvent.keyboard('{ArrowDown}')
        expect(activeCell()).toBe('0:0')

        await userEvent.keyboard('{ArrowRight}')
        expect(activeCell()).toBe('0:1')

        await userEvent.keyboard('{ArrowDown}{ArrowDown}')
        expect(activeCell()).toBe('2:1')

        await userEvent.keyboard('{Home}')
        expect(activeCell()).toBe('2:0')

        await userEvent.keyboard('{End}')
        expect(activeCell()).toBe('2:1')

        await userEvent.keyboard('{Control>}{End}{/Control}')
        expect(activeCell()).toBe('4:1')

        await userEvent.keyboard('{Control>}{Home}{/Control}')
        expect(activeCell()).toBe('0:0')

        await userEvent.keyboard('{ArrowUp}')
        expect(activeCell()).toBe('-1:0')
    })

    it('steps by page with PageDown/PageUp under pagination', async () => {
        const grid = createDataGrid<Person>({
            data: people,
            columns,
            getRowId,
            features: [filtering(), sorting(), pagination({ pageSize: 5 })]
        })
        const screen = await render(TypedDataGrid, { grid })

        screen.container.querySelector<HTMLElement>('[data-dg-cell="0:0"]')!.focus()
        expect(grid.focus.active).toEqual({ row: 0, col: 0 })
        await userEvent.keyboard('{PageDown}')
        expect(grid.focus.active.row).toBe(5)

        await expect.poll(() => activeCell()).toBe('5:0')
        expect(getPagination(grid)!.page).toBe(2)
    })

    it('sorts with Enter on a header cell and announces it', async () => {
        const screen = await render(TypedDataGrid, {
            data: people.slice(0, 5),
            columns,
            getRowId
        })

        const header = screen.container.querySelector<HTMLElement>('[data-dg-cell="-1:1"]')!
        header.focus()
        await userEvent.keyboard('{Enter}')

        await expect
            .element(screen.getByRole('columnheader', { name: 'Age' }))
            .toHaveAttribute('aria-sort', 'ascending')
        expect(screen.container.querySelector('[aria-live="polite"]')?.textContent).toBe(
            'sorted by Age ascending'
        )
    })

    it('follows focus into unrendered rows on a virtualized grid', async () => {
        interface Row {
            id: number
            name: string
            value: number
        }
        const rows: Row[] = Array.from({ length: 1000 }, (_, i) => ({
            id: i + 1,
            name: `Row ${i + 1}`,
            value: i
        }))
        const grid = createDataGrid<Row>({
            data: rows,
            columns: [
                { id: 'name', header: 'Name', sortable: true, flex: 1, minWidth: 120 },
                { id: 'value', header: 'Value', align: 'right', width: 100 }
            ],
            getRowId: (row) => String(row.id),
            features: [sorting(), virtualization({ rowHeight: 40, overscan: 5 })]
        })
        const screen = await render(VirtualGrid, { grid })
        await expect
            .element(screen.getByRole('gridcell', { name: 'Row 1', exact: true }))
            .toBeVisible()

        screen.container.querySelector<HTMLElement>('[data-dg-cell="0:0"]')!.focus()
        grid.focus.focusCell({ row: 500, col: 0 })

        await expect
            .element(screen.getByRole('gridcell', { name: 'Row 501', exact: true }))
            .toBeVisible()
        await expect.poll(() => activeCell()).toBe('500:0')
        expect(getVirtualization(grid)!.virtualizer.scrollTop).toBeGreaterThan(0)
    })

    it('does not steal focus on mount', async () => {
        await render(TypedDataGrid, { data: people.slice(0, 3), columns, getRowId })
        expect(document.activeElement?.getAttribute('data-dg-cell') ?? null).toBeNull()
    })
})

describe('density and toolbar', () => {
    it('switches density via the toolbar toggle without touching cells', async () => {
        const screen = await render(TypedDataGrid, {
            data: people.slice(0, 3),
            columns,
            getRowId,
            toolbar: true
        })

        const root = screen.container.firstElementChild as HTMLElement
        expect(root.className).toContain('[--dg-row-h:2.5rem]')

        await screen.getByRole('button', { name: 'Compact density' }).click()
        expect(root.className).toContain('[--dg-row-h:2rem]')
    })

    it('filters through the toolbar quick filter', async () => {
        const screen = await render(TypedDataGrid, {
            data: people.slice(0, 9),
            columns,
            getRowId,
            toolbar: true
        })

        await screen.getByPlaceholder('Search...').fill('Person 3')
        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '2')
    })
})

describe('overlays', () => {
    it('renders skeleton rows while loading', async () => {
        const screen = await render(TypedDataGrid, {
            data: people.slice(0, 5),
            columns,
            getRowId,
            loading: true
        })

        const body = screen.container.querySelector('[role="rowgroup"][aria-busy="true"]')
        expect(body).not.toBeNull()
        expect(screen.container.querySelectorAll('[role="gridcell"]')).toHaveLength(0)
    })

    it('renders the error state with a retry action', async () => {
        let retried = false
        const screen = await render(TypedDataGrid, {
            data: people.slice(0, 5),
            columns,
            getRowId,
            error: 'Failed to load',
            onRetry: () => {
                retried = true
            }
        })

        await expect.element(screen.getByText('Failed to load')).toBeVisible()
        await screen.getByRole('button', { name: 'Retry' }).click()
        expect(retried).toBe(true)
    })
})
