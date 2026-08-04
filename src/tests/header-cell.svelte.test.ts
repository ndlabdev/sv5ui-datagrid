import axe from 'axe-core'
import { createRawSnippet, type Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    filtering,
    sorting,
    type ColumnDef,
    type DataGridProps,
    type GridState,
    type HeaderContext
} from '$lib/index.js'

interface Person {
    id: number
    name: string
    revenue: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

const people: Person[] = [
    { id: 1, name: 'Ada', revenue: 120 },
    { id: 2, name: 'Linus', revenue: 340 }
]

const getRowId = (person: Person) => String(person.id)

/** Renders the label the grid resolved, marked so a test can find it. */
const labelSnippet = createRawSnippet<[HeaderContext<Person>]>((context) => ({
    render: () => `<span data-custom-header>★ ${context().header}</span>`
}))

/** Renders no readable text at all - the worst case for the accessible name. */
const iconOnlySnippet = createRawSnippet<[HeaderContext<Person>]>(() => ({
    render: () => '<span data-custom-header aria-hidden="true">◆</span>'
}))

function makeGrid(columns: ColumnDef<Person>[]): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId,
        features: [sorting(), filtering(), columnOps()]
    })
}

async function mount(columns: ColumnDef<Person>[]) {
    const grid = makeGrid(columns)
    const screen = await render(TypedDataGrid, { grid })
    await expect.element(screen.getByRole('grid')).toBeVisible()
    return { grid, screen }
}

function headerCell(container: Element, index: number): HTMLElement {
    const cell = container.querySelector<HTMLElement>(`[data-dg-cell="-1:${index}"]`)
    if (!cell) throw new Error(`no header cell at ${index}`)
    return cell
}

describe('headerCell snippet', () => {
    it('draws the label while the grid keeps the text one', async () => {
        const { screen } = await mount([
            { id: 'name', header: 'Name', width: 160 },
            { id: 'revenue', header: 'Revenue', headerCell: labelSnippet, width: 160 }
        ])

        const custom = headerCell(screen.container, 1).querySelector('[data-custom-header]')
        expect(custom?.textContent).toBe('★ Revenue')
        // The plain column is untouched by the feature.
        expect(headerCell(screen.container, 0).querySelector('[data-custom-header]')).toBeNull()
    })

    it('hands the snippet the resolved header and the column state', async () => {
        let seen: HeaderContext<Person> | undefined
        const capture = createRawSnippet<[HeaderContext<Person>]>((context) => {
            seen = context()
            return { render: () => '<span></span>' }
        })
        await mount([{ id: 'revenue', headerCell: capture, width: 160, align: 'right' }])

        expect(seen?.header).toBe('revenue')
        expect(seen?.column.id).toBe('revenue')
        expect(seen?.column.align).toBe('right')
    })

    it('names the column from `header`, not from what the snippet drew', async () => {
        const { screen } = await mount([
            { id: 'revenue', header: 'Revenue', headerCell: iconOnlySnippet, width: 160 }
        ])

        await expect
            .element(screen.getByRole('columnheader', { name: 'Revenue' }))
            .toBeInTheDocument()
    })

    it('falls back to the column id when a snippet column has no header', async () => {
        const { screen } = await mount([{ id: 'revenue', header: '', headerCell: iconOnlySnippet }])

        expect(headerCell(screen.container, 0).getAttribute('aria-label')).toBe('revenue')
    })

    it('leaves the accessible name to the rendered text without a snippet', async () => {
        const { screen } = await mount([{ id: 'name', header: 'Name', width: 160 }])

        const cell = headerCell(screen.container, 0)
        expect(cell.hasAttribute('aria-label')).toBe(false)
        expect(cell.textContent).toContain('Name')
    })

    it('keeps the sort control around a custom label', async () => {
        const { screen } = await mount([
            { id: 'revenue', header: 'Revenue', sortable: true, headerCell: labelSnippet }
        ])

        const header = screen.getByRole('columnheader', { name: 'Revenue' })
        const button = headerCell(screen.container, 0).querySelector('button')
        expect(button?.querySelector('[data-custom-header]')?.textContent).toBe('★ Revenue')

        button?.click()
        await expect.element(header).toHaveAttribute('aria-sort', 'ascending')
    })

    it('marks the default label for truncation on sortable columns too', async () => {
        const { screen } = await mount([{ id: 'name', header: 'Name', sortable: true, width: 60 }])

        const label = headerCell(screen.container, 0).querySelector('[data-dg-truncate]')
        expect(label?.textContent).toBe('Name')
    })

    it('stays axe-clean with a label a screen reader cannot read', async () => {
        const { screen } = await mount([
            { id: 'name', header: 'Name', sortable: true, width: 160 },
            { id: 'revenue', header: 'Revenue', headerCell: iconOnlySnippet, width: 160 }
        ])

        const results = await axe.run(screen.container, {
            rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
        })
        expect(
            results.violations.flatMap((violation) =>
                violation.nodes.map((node) => `${violation.id}: ${node.html.slice(0, 160)}`)
            )
        ).toEqual([])
    })

    it("leaves an ungrouped column's placeholder out of the header tree", async () => {
        const grid = createDataGrid<Person>({
            columns: [
                {
                    id: 'g',
                    header: 'Group',
                    children: [{ id: 'name', header: 'Name', width: 140 }]
                },
                { id: 'revenue', header: 'Revenue', width: 140 }
            ],
            data: people,
            getRowId,
            features: [columnOps()]
        })
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        // The filler above the ungrouped column names nothing, so it must not
        // read as an unlabelled column header.
        const headers = [...screen.container.querySelectorAll('[role="columnheader"]')].filter(
            (cell) => !cell.hasAttribute('data-dg-cell')
        )
        expect(headers.map((cell) => cell.textContent?.trim())).toEqual(['Group'])
    })

    it('feeds the text header to surfaces a snippet cannot reach', async () => {
        const { grid } = await mount([
            { id: 'revenue', header: 'Revenue', headerCell: iconOnlySnippet, width: 160 }
        ])

        // What the column chooser, column menu, exports and the announcer read.
        expect(grid.columns.get('revenue')?.header).toBe('Revenue')
    })
})
