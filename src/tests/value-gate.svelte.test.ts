import type { Component } from 'svelte'
import { flushSync } from 'svelte'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import ValueGateDemo from '../routes/value-gate/+page.svelte'
import {
    createDataGrid,
    DataGrid,
    editing,
    filtering,
    getFiltering,
    getSelection,
    selection,
    type ColumnDef,
    type DataGridProps,
    type GridFeature,
    type GridState
} from '$lib/index.js'

interface Person {
    id: number
    name: string
    salary: number
    secret?: string
}

const MASK = '***'

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name' },
    { id: 'salary', header: 'Salary', filter: 'set', editable: true }
]

const people: Person[] = [
    { id: 1, name: 'Ada', salary: 9000, secret: 'classified' },
    { id: 2, name: 'Grace', salary: 8000, secret: 'classified' }
]

function makeGrid(policy: GridFeature<Person>): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (row) => String(row.id),
        features: [filtering(), selection(), editing(), policy]
    })
}

/**
 * The gate reads reactive state, which is the case the caches have to survive:
 * the search text and the set filter's value list are both held per column,
 * and answering out of either after the gate changed is showing what the gate
 * was put there to hide.
 */
describe('a gate that changes its mind', () => {
    it('takes the cells, the search and the value list with it', () => {
        const cleanup = $effect.root(() => {
            let hidden = $state(true)
            // One reader, reused: a fresh closure per call would work too, and
            // would throw away the caches keyed on it.
            const maskReader = () => MASK
            const grid = makeGrid({
                id: 'policy',
                cellValue: ({ column }) =>
                    hidden && column.id === 'salary' ? maskReader : undefined
            })
            const filter = getFiltering(grid)!
            const salary = grid.columns.get('salary')!

            expect(grid.getValue(grid.nodes[0]!, salary)).toBe(MASK)
            expect(filter.distinctFor('salary')).toEqual([MASK])
            filter.setQuickFilter('9000')
            expect(grid.nodes).toHaveLength(0)

            flushSync(() => {
                hidden = false
            })

            // The same search, against text that has to have been built again.
            expect(grid.nodes.map((node) => node.row.name)).toEqual(['Ada'])
            expect(grid.getValue(grid.nodes[0]!, salary)).toBe(9000)
            expect(filter.distinctFor('salary')).toEqual([8000, 9000])
        })
        cleanup()
    })
})

/** Downloads never leave the page: the blob is kept, the save is recorded. */
let downloads: Blob[] = []
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
        if (this.download && pending) downloads.push(pending)
        else clickAnchor.call(this)
    }
})

afterEach(() => {
    URL.createObjectURL = createObjectURL
    HTMLAnchorElement.prototype.click = clickAnchor
})

describe('the file a gated grid writes', () => {
    it('carries the substitute through a column the grid does not show', async () => {
        // A named column is exported out of `columns.all`, hidden or not, so
        // the reader has to be found there too and not only among the visible.
        const grid = createDataGrid<Person>({
            columns: [...columns, { id: 'secret', header: 'Secret', hidden: true }],
            data: people.map((row) => ({ ...row })),
            getRowId: (row) => String(row.id),
            features: [
                selection(),
                {
                    id: 'policy',
                    cellValue: ({ column }) => (column.id === 'secret' ? () => MASK : undefined)
                }
            ]
        })
        getSelection(grid)!.exportCsv({
            filename: 'secret.csv',
            allRows: true,
            columns: ['name', 'secret']
        })

        expect(downloads).toHaveLength(1)
        const csv = await downloads[0]!.text()
        expect(csv).toContain(MASK)
        expect(csv).not.toContain('classified')
    })

    it('carries the substitute, not the value behind it', async () => {
        const grid = makeGrid({
            id: 'policy',
            cellValue: ({ column }) => (column.id === 'salary' ? () => MASK : undefined)
        })
        getSelection(grid)!.exportCsv({ filename: 'people.csv', allRows: true })

        expect(downloads).toHaveLength(1)
        const csv = await downloads[0]!.text()
        expect(csv).toContain(MASK)
        expect(csv).not.toContain('9000')
    })
})

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

/**
 * The kernel tests read values back out of the grid. These read the DOM,
 * which is the only place that answers the question a user would ask: is the
 * number on my screen, and is it in the markup behind it.
 */
describe('the cells a gated grid draws', () => {
    const seen: { cellClass: unknown[]; tooltip: unknown[] } = { cellClass: [], tooltip: [] }

    function drawnGrid(): GridState<Person> {
        seen.cellClass = []
        seen.tooltip = []
        return createDataGrid<Person>({
            columns: [
                { id: 'name', header: 'Name', width: 160 },
                {
                    id: 'salary',
                    header: 'Salary',
                    width: 160,
                    tooltip: ({ value }) => {
                        seen.tooltip.push(value)
                        return `tip: ${String(value)}`
                    },
                    cellClass: ({ value }) => {
                        seen.cellClass.push(value)
                        return undefined
                    }
                }
            ],
            data: people.map((row) => ({ ...row })),
            getRowId: (row) => String(row.id),
            features: [
                {
                    id: 'policy',
                    cellValue: ({ column }) => (column.id === 'salary' ? () => MASK : undefined)
                }
            ]
        })
    }

    const cellAt = (container: Element, row: number, col: number) =>
        container.querySelector<HTMLElement>(`[data-dg-cell="${row}:${col}"]`)!

    it('puts the substitute in the markup, and the value nowhere in it', async () => {
        const screen = await render(TypedDataGrid, { grid: drawnGrid() })
        await expect.element(page.getByRole('grid')).toBeVisible()

        expect(cellAt(screen.container, 0, 1).textContent).toContain(MASK)
        expect(screen.container.innerHTML).not.toContain('9000')
        expect(screen.container.innerHTML).not.toContain('8000')
    })

    it('hands the substitute to the tooltip and to cellClass', async () => {
        const screen = await render(TypedDataGrid, { grid: drawnGrid() })
        await expect.element(page.getByRole('grid')).toBeVisible()

        expect(seen.cellClass).toContain(MASK)
        expect(seen.cellClass).not.toContain(9000)
        expect(seen.tooltip).toContain(MASK)

        const trigger = cellAt(screen.container, 0, 1).querySelector<HTMLElement>(
            '[data-tooltip-trigger]'
        )!
        await userEvent.hover(trigger)
        const content = () =>
            document.querySelector('[data-bits-floating-content-wrapper]')?.textContent?.trim()
        await expect.poll(content, { timeout: 3000 }).toBe(`tip: ${MASK}`)
    })
})

/**
 * What a built-in renderer does with a substitute it cannot draw. Nothing
 * leaks either way, but a mark only appears where the renderer can show one,
 * so a gate on a typed column has to answer in that type.
 */
describe('a substitute a typed column cannot draw', () => {
    function typedGrid(substitute: unknown): GridState<Person> {
        return createDataGrid<Person>({
            columns: [
                {
                    id: 'salary',
                    header: 'Salary',
                    width: 160,
                    type: 'currency',
                    typeOptions: { currency: 'USD', locale: 'en-US', emptyText: 'khong xem duoc' }
                }
            ],
            data: people.map((row) => ({ ...row })),
            getRowId: (row) => String(row.id),
            features: [{ id: 'policy', cellValue: () => () => substitute }]
        })
    }

    const cellText = (container: Element) =>
        container.querySelector<HTMLElement>('[data-dg-cell="0:0"]')?.textContent?.trim()

    it('draws nothing at all when the mark is a string a currency cannot parse', async () => {
        const screen = await render(TypedDataGrid, { grid: typedGrid(MASK) })
        await expect.element(page.getByRole('grid')).toBeVisible()

        expect(cellText(screen.container)).toBe('')
        expect(screen.container.innerHTML).not.toContain('9000')
    })

    it('draws the column empty text when the mark is null, which is the way to say it', async () => {
        const screen = await render(TypedDataGrid, { grid: typedGrid(null) })
        await expect.element(page.getByRole('grid')).toBeVisible()

        expect(cellText(screen.container)).toBe('khong xem duoc')
    })
})

describe('the value-gate demo', () => {
    it('opens with the three columns hidden on every exit at once', async () => {
        const screen = await render(ValueGateDemo as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        const text = (id: string) =>
            screen.container.querySelector(`[data-testid="${id}"]`)?.textContent ?? ''

        expect(text('drawn')).toBe(MASK)
        expect(text('clipboard')).toContain(MASK)
        expect(text('clipboard')).not.toContain('32000000')
        expect(text('csv')).not.toContain('0901234567')
        expect(text('facets')).toBe(MASK)
        await expect.element(page.getByText('Cột Lương: khoá')).toBeVisible()
    })

    it('finds nothing when asked for a number the gate took away', async () => {
        await render(ValueGateDemo as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        await page.getByRole('button', { name: 'Tìm 32000000' }).click()
        await expect.element(page.getByTestId('rows-found')).toHaveTextContent('Đang hiện 0 / 6')

        await page.getByRole('button', { name: 'Tìm ***' }).click()
        await expect.element(page.getByTestId('rows-found')).toHaveTextContent('Đang hiện 6 / 6')
    })
})
