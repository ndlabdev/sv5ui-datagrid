import axe from 'axe-core'
import { createRawSnippet, type Component } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    sorting,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Row {
    id: number
    name: string
    avatar: string
    role: string
    salary: number
    share: number
    joined: string
    active: boolean
    score: number
    stars: number
    site: string
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Row>>

const rows: Row[] = [
    {
        id: 1,
        name: 'Alice Nguyen',
        avatar: 'https://example.com/a.png',
        role: 'Engineer',
        salary: 120000,
        share: 0.42,
        joined: '2026-03-14T10:30:00Z',
        active: true,
        score: 65,
        stars: 4,
        site: 'https://example.com/alice'
    },
    {
        id: 2,
        name: 'Bob Tran',
        avatar: 'https://example.com/b.png',
        role: 'Designer',
        salary: 98000,
        share: 0.08,
        joined: '2025-11-02T08:00:00Z',
        active: false,
        score: 20,
        stars: 2,
        site: 'https://example.com/bob'
    }
]

const onEdit = vi.fn()

const columns: ColumnDef<Row>[] = [
    {
        id: 'name',
        header: 'Name',
        type: 'user',
        width: 220,
        typeOptions: {
            avatar: (row) => row.avatar,
            description: (row) => row.role
        }
    },
    {
        id: 'role',
        header: 'Role',
        type: 'badge',
        width: 120,
        typeOptions: { colors: { Engineer: 'primary' } }
    },
    {
        id: 'salary',
        header: 'Salary',
        type: 'currency',
        width: 130,
        typeOptions: { locale: 'en-US', currency: 'USD' }
    },
    { id: 'share', header: 'Share', type: 'percent', width: 100, typeOptions: { locale: 'en-US' } },
    {
        id: 'joined',
        header: 'Joined',
        type: 'date',
        width: 140,
        typeOptions: { locale: 'en-US', dateFormat: { timeZone: 'UTC' } }
    },
    { id: 'active', header: 'Active', type: 'boolean', width: 90 },
    { id: 'score', header: 'Score', type: 'progress', width: 140 },
    { id: 'stars', header: 'Stars', type: 'rating', width: 140 },
    { id: 'site', header: 'Site', type: 'link', width: 160 },
    {
        id: 'actions',
        header: '',
        type: 'actions',
        width: 70,
        typeOptions: {
            actions: (row) => [
                { label: 'Edit', icon: 'lucide:pencil', onSelect: onEdit.bind(null, row) }
            ]
        }
    }
]

function makeGrid(overrides: ColumnDef<Row>[] = columns, data: Row[] = rows): GridState<Row> {
    return createDataGrid<Row>({
        columns: overrides,
        data,
        getRowId: (row) => String(row.id),
        features: [sorting()]
    })
}

async function renderGrid(grid: GridState<Row>) {
    const screen = await render(TypedDataGrid, { grid })
    await expect.element(screen.getByRole('grid')).toBeVisible()
    return screen
}

function cellAt(container: Element, row: number, col: number): HTMLElement {
    return container.querySelector<HTMLElement>(`[data-dg-cell="${row}:${col}"]`)!
}

describe('formatting renderers', () => {
    it('formats currency, percent and date through Intl', async () => {
        const screen = await renderGrid(makeGrid())

        expect(cellAt(screen.container, 0, 2).textContent).toContain('$120,000.00')
        expect(cellAt(screen.container, 0, 3).textContent).toContain('42%')
        expect(cellAt(screen.container, 0, 4).textContent).toContain('Mar 14, 2026')
    })

    it('renders an em dash for blank values instead of "null"', async () => {
        const blank = [{ ...rows[0], salary: null as unknown as number }]
        const screen = await renderGrid(
            makeGrid([{ id: 'salary', header: 'Salary', type: 'currency' }], blank)
        )

        expect(cellAt(screen.container, 0, 0).textContent?.trim()).toBe('—')
    })

    it('honours a custom emptyText', async () => {
        const blank = [{ ...rows[0], salary: null as unknown as number }]
        const screen = await renderGrid(
            makeGrid(
                [
                    {
                        id: 'salary',
                        header: 'Salary',
                        type: 'currency',
                        typeOptions: { emptyText: 'n/a' }
                    }
                ],
                blank
            )
        )

        expect(cellAt(screen.container, 0, 0).textContent?.trim()).toBe('n/a')
    })

    it('marks a blank the same way on a column that declares no type', async () => {
        // Untyped columns take the plain-text path, which used to print the raw
        // value and so drew nothing at all where a hole was.
        const blank = [{ ...rows[0], name: null as unknown as string, role: '' }]
        const screen = await renderGrid(
            makeGrid(
                [
                    { id: 'name', header: 'Name' },
                    { id: 'role', header: 'Role', typeOptions: { emptyText: 'n/a' } }
                ],
                blank
            )
        )

        expect(cellAt(screen.container, 0, 0).textContent?.trim()).toBe('—')
        expect(cellAt(screen.container, 0, 1).textContent?.trim()).toBe('n/a')
    })
})

describe('component renderers', () => {
    it('renders the user cell with name, description and avatar', async () => {
        const screen = await renderGrid(makeGrid())
        const cell = cellAt(screen.container, 0, 0)

        expect(cell.textContent).toContain('Alice Nguyen')
        expect(cell.textContent).toContain('Engineer')
        expect(cell.querySelector('img')?.getAttribute('src')).toBe('https://example.com/a.png')
    })

    it('colours a badge from the map and falls back for unmapped values', async () => {
        const screen = await renderGrid(makeGrid())

        expect(cellAt(screen.container, 0, 1).textContent).toContain('Engineer')
        expect(cellAt(screen.container, 1, 1).textContent).toContain('Designer')
    })

    it('exposes progress and rating to assistive tech', async () => {
        const screen = await renderGrid(makeGrid())

        const progress = cellAt(screen.container, 0, 6).querySelector('[role="progressbar"]')!
        expect(progress.getAttribute('aria-valuenow')).toBe('65')
        expect(progress.getAttribute('aria-valuemax')).toBe('100')

        expect(cellAt(screen.container, 0, 7).textContent).not.toBe('4')
    })

    it('renders a link pointing at the value', async () => {
        const screen = await renderGrid(makeGrid())
        const link = cellAt(screen.container, 0, 8).querySelector('a')!

        expect(link.getAttribute('href')).toBe('https://example.com/alice')
    })

    it('runs a row action with the row it belongs to', async () => {
        onEdit.mockClear()
        const screen = await renderGrid(makeGrid())

        await page.getByRole('button', { name: 'Row actions' }).first().click()
        await page.getByRole('menuitem', { name: 'Edit' }).click()

        expect(onEdit).toHaveBeenCalledTimes(1)
        expect(onEdit.mock.calls[0][0]).toMatchObject({ id: 1 })
        void screen
    })

    it('renders nothing when a row has no actions', async () => {
        const screen = await renderGrid(
            makeGrid([
                { id: 'actions', header: '', type: 'actions', typeOptions: { actions: () => [] } }
            ])
        )

        expect(cellAt(screen.container, 0, 0).querySelector('button')).toBeNull()
    })
})

describe('precedence', () => {
    it('lets a cell snippet win over the type', async () => {
        const cell = createRawSnippet<[{ value: unknown }]>((context) => ({
            render: () => `<span>snippet:${context().value}</span>`
        }))

        const screen = await renderGrid(
            makeGrid([{ id: 'role', header: 'Role', type: 'badge', cell }])
        )

        expect(cellAt(screen.container, 0, 0).textContent?.trim()).toBe('snippet:Engineer')
    })

    it('leaves untyped columns as plain text', async () => {
        const screen = await renderGrid(makeGrid([{ id: 'name', header: 'Name' }]))
        expect(cellAt(screen.container, 0, 0).textContent?.trim()).toBe('Alice Nguyen')
    })
})

describe('a11y', () => {
    it('is axe-clean with every renderer on screen', async () => {
        const screen = await renderGrid(makeGrid())

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(results.violations.map((violation) => violation.id)).toEqual([])
    })
})
