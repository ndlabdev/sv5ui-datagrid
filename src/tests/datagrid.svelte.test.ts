import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import {
    createDataGrid,
    DataGrid,
    filtering,
    getFiltering,
    getPagination,
    pagination,
    sorting,
    type ColumnDef,
    type DataGridProps
} from '$lib/index.js'
import CompoundGrid from './CompoundGrid.svelte'

interface Person {
    id: number
    name: string
    age: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

const people: Person[] = [
    { id: 1, name: 'Alice Nguyen', age: 29 },
    { id: 2, name: 'Bob Tran', age: 34 },
    { id: 3, name: 'Charlie Le', age: 41 },
    { id: 4, name: 'Diana Pham', age: 26 },
    { id: 5, name: 'Ethan Vo', age: 31 },
    { id: 6, name: 'Fiona Dang', age: 38 },
    { id: 7, name: 'George Ho', age: 27 },
    { id: 8, name: 'Hana Bui', age: 45 },
    { id: 9, name: 'Ivan Do', age: 24 },
    { id: 10, name: 'Julia Ly', age: 33 },
    { id: 11, name: 'Kevin Truong', age: 30 },
    { id: 12, name: 'Linh Hoang', age: 28 }
]

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name', sortable: true, flex: 1, minWidth: 120 },
    { id: 'age', header: 'Age', sortable: true, width: 96 }
]

const getRowId = (person: Person) => String(person.id)

function firstColumn(container: Element): string[] {
    return [...container.querySelectorAll('[role="gridcell"][aria-colindex="1"]')].map(
        (cell) => cell.textContent?.trim() ?? ''
    )
}

describe('DataGrid', () => {
    it('renders the ARIA grid structure', async () => {
        const screen = await render(TypedDataGrid, { data: people.slice(0, 3), columns, getRowId })

        const grid = screen.getByRole('grid')
        await expect.element(grid).toHaveAttribute('aria-rowcount', '4')
        await expect.element(grid).toHaveAttribute('aria-colcount', '2')

        expect(screen.getByRole('columnheader').all()).toHaveLength(2)
        expect(screen.getByRole('row').all()).toHaveLength(4)
        expect(firstColumn(screen.container)).toEqual(['Alice Nguyen', 'Bob Tran', 'Charlie Le'])
    })

    it('writes column widths as CSS custom properties', async () => {
        const screen = await render(TypedDataGrid, { data: people.slice(0, 2), columns, getRowId })

        await expect.element(screen.getByRole('grid')).toBeVisible()
        const style = screen.getByRole('grid').element().getAttribute('style') ?? ''
        expect(style).toContain('--dg-col-age-w: 96px')
        expect(style).toContain('--dg-col-name-w: minmax(120px, 1fr)')
        expect(style).toContain('--dg-grid-template: var(--dg-col-name-w) var(--dg-col-age-w)')
    })

    it('cycles sort on header click: asc → desc → none', async () => {
        const screen = await render(TypedDataGrid, { data: people.slice(0, 4), columns, getRowId })
        const header = screen.getByRole('columnheader', { name: 'Name' })
        const sortButton = screen.getByRole('button', { name: 'Name' })

        await sortButton.click()
        await expect.element(header).toHaveAttribute('aria-sort', 'ascending')
        expect(firstColumn(screen.container)[0]).toBe('Alice Nguyen')

        await sortButton.click()
        await expect.element(header).toHaveAttribute('aria-sort', 'descending')
        expect(firstColumn(screen.container)[0]).toBe('Diana Pham')

        await sortButton.click()
        await expect.element(header).not.toHaveAttribute('aria-sort')
        expect(firstColumn(screen.container)[0]).toBe('Alice Nguyen')
    })

    it('shows the empty state when there are no rows', async () => {
        const screen = await render(TypedDataGrid, {
            data: [] as Person[],
            columns,
            getRowId,
            emptyText: 'Nothing here'
        })
        await expect.element(screen.getByText('Nothing here')).toBeVisible()
    })

    it('windows rows by page and reacts to filter and page changes', async () => {
        const grid = createDataGrid<Person>({
            data: people,
            columns,
            getRowId,
            features: [filtering(), sorting(), pagination({ pageSize: 5 })]
        })
        const screen = await render(TypedDataGrid, { grid })

        expect(firstColumn(screen.container)).toHaveLength(5)
        await expect
            .element(screen.getByRole('grid'))
            .toHaveAttribute('aria-rowcount', String(people.length + 1))

        getPagination(grid)!.setPage(2)
        await expect.element(screen.getByRole('gridcell', { name: 'Fiona Dang' })).toBeVisible()
        expect(firstColumn(screen.container)[0]).toBe('Fiona Dang')

        getFiltering(grid)!.setQuickFilter('julia')
        await expect.element(screen.getByRole('gridcell', { name: 'Julia Ly' })).toBeVisible()
        expect(firstColumn(screen.container)).toEqual(['Julia Ly'])
        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '2')
    })

    it('keeps aria-rowindex relative to the full filtered set across pages', async () => {
        const grid = createDataGrid<Person>({
            data: people,
            columns,
            getRowId,
            features: [pagination({ pageSize: 5 })]
        })
        const screen = await render(TypedDataGrid, { grid })

        getPagination(grid)!.setPage(2)
        await expect.element(screen.getByRole('gridcell', { name: 'Fiona Dang' })).toBeVisible()

        const rows = screen.container.querySelectorAll('[role="rowgroup"]:last-child [role="row"]')
        expect([...rows].map((row) => row.getAttribute('aria-rowindex'))).toEqual([
            '7',
            '8',
            '9',
            '10',
            '11'
        ])
    })
})

describe('Grid compound composition', () => {
    it('renders and sorts through the same parts as DataGrid', async () => {
        const grid = createDataGrid<Person>({
            data: people.slice(0, 4),
            columns,
            getRowId,
            features: [sorting()]
        })
        const screen = await render(CompoundGrid, { grid })

        await expect.element(screen.getByRole('grid')).toBeVisible()
        expect(firstColumn(screen.container)).toHaveLength(4)

        await screen.getByRole('button', { name: 'Age' }).click()
        await expect
            .element(screen.getByRole('columnheader', { name: 'Age' }))
            .toHaveAttribute('aria-sort', 'ascending')
        expect(firstColumn(screen.container)[0]).toBe('Diana Pham')
    })
})
