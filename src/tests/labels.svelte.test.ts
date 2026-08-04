import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    defaultLabels,
    filtering,
    mergeLabels,
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

const people: Person[] = [
    { id: 1, name: 'Ada', dept: 'Core' },
    { id: 2, name: 'Linus', dept: 'Data' }
]

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Tên', sortable: true, filter: 'text', flex: 1, minWidth: 140 },
    { id: 'dept', header: 'Bộ phận', width: 140, filter: 'set' }
]

/** A partial translation: the point is that the rest keeps working. */
const vi = {
    search: 'Tìm kiếm...',
    apply: 'Áp dụng',
    clear: 'Xoá',
    sortAscending: 'Sắp xếp tăng dần',
    hideColumn: 'Ẩn cột',
    noData: 'Không có dữ liệu',
    selectAllRows: 'Chọn tất cả các dòng',
    filterColumn: (column: string) => `Lọc ${column}`,
    totalRows: (total: number) => `${total} dòng`,
    textOps: { contains: 'Chứa' }
}

function makeGrid(data: Person[] = people): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data,
        getRowId: (person) => String(person.id),
        labels: vi,
        features: [sorting(), filtering(), columnOps(), selection()]
    })
}

describe('mergeLabels', () => {
    it('keeps every default the caller did not mention', () => {
        const merged = mergeLabels({ apply: 'Áp dụng' })
        expect(merged.apply).toBe('Áp dụng')
        expect(merged.clear).toBe(defaultLabels.clear)
        expect(merged.textOps).toEqual(defaultLabels.textOps)
    })

    it('merges an operator map entry at a time', () => {
        const merged = mergeLabels({ textOps: { contains: 'Chứa' } })
        expect(merged.textOps.contains).toBe('Chứa')
        // Translating one operator must not blank out the other seven.
        expect(merged.textOps.notContains).toBe(defaultLabels.textOps.notContains)
    })

    it('returns the defaults untouched when nothing is overridden', () => {
        expect(mergeLabels(undefined)).toBe(defaultLabels)
    })
})

describe('translated grid', () => {
    it('renders the toolbar, status bar and selection in the given language', async () => {
        const grid = makeGrid()
        const screen = await render(TypedDataGrid, { grid, toolbar: true })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        await expect.element(page.getByPlaceholder('Tìm kiếm...')).toBeVisible()
        await expect.element(page.getByText('2 dòng')).toBeVisible()
        await expect
            .element(page.getByRole('checkbox', { name: 'Chọn tất cả các dòng' }))
            .toBeVisible()
    })

    it('translates the column menu while untranslated items keep the default', async () => {
        const grid = makeGrid()
        await render(TypedDataGrid, { grid })
        await expect.element(page.getByRole('grid')).toBeVisible()

        await page.getByRole('button', { name: 'Tên column menu' }).click()
        await expect.element(page.getByRole('menuitem', { name: 'Sắp xếp tăng dần' })).toBeVisible()
        await expect.element(page.getByRole('menuitem', { name: 'Ẩn cột' })).toBeVisible()
        // Not in the override, so it falls back rather than disappearing.
        await expect.element(page.getByRole('menuitem', { name: 'Clear sort' })).toBeVisible()
    })

    it('translates the filter panel and its operator list', async () => {
        const grid = makeGrid()
        await render(TypedDataGrid, { grid })
        await expect.element(page.getByRole('grid')).toBeVisible()

        await page.getByRole('button', { name: 'Lọc Tên' }).click()
        const dialog = page.getByRole('dialog', { name: 'Lọc Tên' })
        await expect.element(dialog).toBeVisible()
        await expect.element(dialog.getByRole('button', { name: 'Áp dụng' })).toBeVisible()

        await page.getByRole('button', { name: 'Filter operator' }).click()
        await expect.element(page.getByRole('option', { name: 'Chứa' })).toBeVisible()
        // Untranslated operators stay in the list in the default language.
        await expect.element(page.getByRole('option', { name: 'Does not contain' })).toBeVisible()
    })

    it('translates the empty state', async () => {
        const grid = makeGrid([])
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        await expect.element(page.getByText('Không có dữ liệu')).toBeVisible()
    })

    it('lets an explicit emptyText prop win over the label', async () => {
        const grid = makeGrid([])
        const screen = await render(TypedDataGrid, { grid, emptyText: 'Trống' })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        await expect.element(page.getByText('Trống')).toBeVisible()
    })
})
