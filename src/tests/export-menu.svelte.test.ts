import type { Component } from 'svelte'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    filtering,
    getFiltering,
    getSelection,
    selection,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'
import { enUS, viVN } from '$lib/locales/index.js'

interface Person {
    id: number
    name: string
    dept: string
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

const people: Person[] = [
    { id: 1, name: 'Ada', dept: 'Core' },
    { id: 2, name: 'Linus', dept: 'Data' },
    { id: 3, name: 'Grace', dept: 'Core' }
]

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name', flex: 1, minWidth: 120, filter: 'text' },
    { id: 'dept', header: 'Dept', width: 140, filter: 'text' }
]

function makeGrid(withSelection = true): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (person) => String(person.id),
        features: [filtering<Person>(), ...(withSelection ? [selection<Person>()] : [])]
    })
}

/**
 * Downloads never leave the page here: the blob handed to `createObjectURL` is
 * kept, and the anchor click that would save it is recorded instead.
 */
let downloads: { name: string; blob: Blob }[] = []
let createObjectURL: typeof URL.createObjectURL
let clickAnchor: typeof HTMLAnchorElement.prototype.click

beforeEach(() => {
    downloads = []
    createObjectURL = URL.createObjectURL
    clickAnchor = HTMLAnchorElement.prototype.click

    let pending: Blob | null = null
    URL.createObjectURL = (source: Blob | MediaSource) => {
        pending = source as Blob
        return 'blob:stub'
    }
    HTMLAnchorElement.prototype.click = function click(this: HTMLAnchorElement) {
        // Only a download anchor is ours; anything else still behaves.
        if (this.download && pending) downloads.push({ name: this.download, blob: pending })
        else clickAnchor.call(this)
    }
})

afterEach(() => {
    URL.createObjectURL = createObjectURL
    HTMLAnchorElement.prototype.click = clickAnchor
    vi.restoreAllMocks()
})

const bodyOf = (index = 0) => downloads[index].blob.text()

describe('toolbar export menu', () => {
    it('offers all rows and the selection, and names the file', async () => {
        const grid = makeGrid()
        const screen = await render(TypedDataGrid, {
            grid,
            toolbar: true,
            exportFilename: 'people.csv'
        })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        await page.getByRole('button', { name: 'Export CSV' }).click()
        await expect.element(page.getByRole('menuitem', { name: 'All rows' })).toBeVisible()

        // Nothing is selected, so exporting the selection would produce an
        // empty file: the item is offered but not usable.
        const selected = page.getByRole('menuitem', { name: 'Selected rows' })
        await expect.element(selected).toBeVisible()
        await expect.element(selected).toHaveAttribute('aria-disabled', 'true')

        await page.getByRole('menuitem', { name: 'All rows' }).click()
        await expect.poll(() => downloads).toHaveLength(1)
        expect(downloads[0].name).toBe('people.csv')
        const csv = await bodyOf()
        expect(csv).toContain('Name,Dept')
        expect(csv).toContain('Ada,Core')
        expect(csv).toContain('Grace,Core')
    })

    it('exports only what is selected once something is', async () => {
        const grid = makeGrid()
        const screen = await render(TypedDataGrid, { grid, toolbar: true })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        getSelection(grid)!.select('2')

        await page.getByRole('button', { name: 'Export CSV' }).click()
        await page.getByRole('menuitem', { name: 'Selected rows' }).click()

        await expect.poll(() => downloads).toHaveLength(1)
        expect(downloads[0].name).toBe('export.csv')
        const csv = await bodyOf()
        expect(csv).toContain('Linus,Data')
        expect(csv).not.toContain('Ada,Core')
    })

    it('exports every filtered row, not just the ones on screen', async () => {
        const grid = makeGrid()
        const screen = await render(TypedDataGrid, { grid, toolbar: true })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        getFiltering(grid)!.setColumnFilter('dept', {
            kind: 'text',
            op: 'equals',
            value: 'Core'
        })
        await expect.element(screen.getByRole('grid')).toHaveAttribute('aria-rowcount', '3')

        await page.getByRole('button', { name: 'Export CSV' }).click()
        await page.getByRole('menuitem', { name: 'All rows' }).click()

        await expect.poll(() => downloads).toHaveLength(1)
        // "All rows" means all the filter left, which is the set the user is
        // actually looking at.
        const csv = await bodyOf()
        expect(csv).toContain('Ada,Core')
        expect(csv).not.toContain('Linus,Data')
    })

    it('speaks the grid language', async () => {
        const grid = createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (person) => String(person.id),
            locales: [enUS, viVN],
            locale: 'vi-VN',
            features: [selection<Person>()]
        })
        const screen = await render(TypedDataGrid, { grid, toolbar: true })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        await page.getByRole('button', { name: 'Xuất CSV' }).click()
        await expect.element(page.getByRole('menuitem', { name: 'Tất cả các dòng' })).toBeVisible()
    })

    it('is absent when the grid cannot export', async () => {
        // Export lives on the selection feature; without it the button would
        // only ever be dead.
        const screen = await render(TypedDataGrid, { grid: makeGrid(false), toolbar: true })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        expect(page.getByRole('button', { name: 'Export CSV' }).elements()).toHaveLength(0)
    })
})
