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
    getSelection,
    getSorting,
    mergeLabels,
    selection,
    sorting,
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

describe('language packs', () => {
    const packed = (locale?: string) =>
        createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (person) => String(person.id),
            locales: [enUS, viVN],
            locale,
            features: [sorting(), filtering(), columnOps(), selection()]
        })

    it('picks the language from the page when none is forced', async () => {
        document.documentElement.lang = 'vi'
        const grid = packed()
        const screen = await render(TypedDataGrid, { grid, toolbar: true })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        // Nothing configured but the two packs: the page decides.
        await expect.element(page.getByPlaceholder('Tìm kiếm...')).toBeVisible()
        document.documentElement.lang = ''
    })

    it('switches in place, keeping the sort and selection', async () => {
        const grid = packed('vi-VN')
        const screen = await render(TypedDataGrid, { grid, toolbar: true })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        getSorting(grid)!.setSort([{ columnId: 'name', direction: 'desc' }])
        getSelection(grid)!.select('1')
        await expect.element(page.getByPlaceholder('Tìm kiếm...')).toBeVisible()

        grid.locale = 'en-US'

        await expect.element(page.getByPlaceholder('Search...')).toBeVisible()
        // The grid was never rebuilt, so what the user had set is still set.
        expect(getSorting(grid)!.sort).toHaveLength(1)
        expect(getSelection(grid)!.count).toBe(1)
    })

    it("lets a column inherit the grid's locale for its formatting", async () => {
        const grid = createDataGrid<Person>({
            columns: [
                { id: 'name', header: 'Name', flex: 1 },
                // No `locale` of its own: it follows the grid.
                {
                    id: 'id',
                    header: 'Total',
                    width: 160,
                    type: 'currency',
                    typeOptions: { currency: 'EUR' }
                }
            ],
            data: people,
            getRowId: (person) => String(person.id),
            locales: [enUS, viVN],
            locale: 'en-US'
        })
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const cell = () => screen.container.querySelector('[data-dg-cell="0:1"]')?.textContent ?? ''
        expect(cell()).toContain('€1.00')

        grid.locale = 'vi-VN'
        // Same value, the other locale's grouping and symbol placement.
        await expect.poll(cell).toContain('1,00')
    })

    it('keeps overrides on top of the chosen language', async () => {
        const grid = createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (person) => String(person.id),
            locales: [viVN],
            locale: 'vi-VN',
            labels: { apply: 'Xác nhận' },
            features: [filtering(), columnOps()]
        })
        await render(TypedDataGrid, { grid })
        await expect.element(page.getByRole('grid')).toBeVisible()

        await page.getByRole('button', { name: 'Lọc Tên' }).click()
        const dialog = page.getByRole('dialog', { name: 'Lọc Tên' })
        // The override wins; the rest of the pack stays.
        await expect.element(dialog.getByRole('button', { name: 'Xác nhận' })).toBeVisible()
        await expect.element(dialog.getByRole('button', { name: 'Xoá' })).toBeVisible()
    })
})
