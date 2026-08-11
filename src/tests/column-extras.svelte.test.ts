import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { userEvent } from 'vitest/browser'
import Qa from '../routes/qa/+page.svelte'
import Renderers from '../routes/renderers/+page.svelte'
import {
    columnOps,
    createDataGrid,
    DataGrid,
    getColumnOps,
    type ColumnDef,
    type DataGridProps,
    type GridState
} from '$lib/index.js'

interface Person {
    id: number
    name: string
    note: string
    score: number
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Person>>

const people: Person[] = [
    { id: 1, name: 'Ada', note: 'a long note that will not fit', score: 91 },
    { id: 2, name: 'Linus', note: '', score: 74 }
]

function makeGrid(columns: ColumnDef<Person>[]): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (person) => String(person.id),
        features: [columnOps()]
    })
}

function cellAt(container: Element, row: number, col: number): HTMLElement {
    const cell = container.querySelector<HTMLElement>(`[data-dg-cell="${row}:${col}"]`)
    if (!cell) throw new Error(`no cell at ${row}:${col}`)
    return cell
}

describe('ColumnDef.resizable', () => {
    it('withholds the resize handle from a frozen column only', async () => {
        const grid = makeGrid([
            { id: 'id', header: '#', width: 60, resizable: false },
            { id: 'name', header: 'Name', width: 160 }
        ])
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const handles = screen.container.querySelectorAll('[role="separator"]')
        expect([...handles].map((handle) => handle.getAttribute('aria-label'))).toEqual([
            'Resize Name column'
        ])
    })

    it('refuses a width change through the API too', async () => {
        const grid = makeGrid([
            { id: 'id', header: '#', width: 60, resizable: false },
            { id: 'name', header: 'Name', width: 160 }
        ])
        await render(TypedDataGrid, { grid })
        const ops = getColumnOps(grid)!

        expect(ops.canResizeColumn('id')).toBe(false)
        expect(ops.canResizeColumn('name')).toBe(true)

        ops.setColumnWidth('id', 300)
        ops.setColumnWidth('name', 300)
        expect(ops.currentWidth('id')).toBe(60)
        expect(ops.currentWidth('name')).toBe(300)
    })

    it('leaves a frozen column out of autosize', async () => {
        const grid = makeGrid([
            { id: 'id', header: '#', width: 60, resizable: false },
            { id: 'name', header: 'Name', width: 160 }
        ])
        await render(TypedDataGrid, { grid })

        const ops = getColumnOps(grid)!
        ops.autoSizeColumns()
        expect(ops.currentWidth('id')).toBe(60)
    })
})

describe('ColumnDef.tooltip', () => {
    /** The sv5ui tooltip wraps the cell in a trigger; this is that trigger. */
    function triggerIn(container: Element, row: number, col: number): HTMLElement {
        const trigger = cellAt(container, row, col).querySelector<HTMLElement>(
            '[data-tooltip-trigger]'
        )
        if (!trigger) throw new Error(`no tooltip trigger at ${row}:${col}`)
        return trigger
    }

    /**
     * What the tooltip is showing. It lives in a portal, and sv5ui opens it
     * after its own 700ms delay — longer than a default poll waits.
     */
    const tooltipContent = () =>
        document.querySelector('[data-bits-floating-content-wrapper]')?.textContent?.trim()

    async function openTooltip(trigger: HTMLElement): Promise<string> {
        await userEvent.hover(trigger)
        await expect.poll(tooltipContent, { timeout: 3000 }).toBeTruthy()
        return tooltipContent() ?? ''
    }

    it('says what the cell says, through the sv5ui tooltip', async () => {
        const grid = makeGrid([
            {
                id: 'score',
                header: 'Score',
                width: 160,
                type: 'currency',
                typeOptions: { currency: 'USD', locale: 'en-US' },
                tooltip: true
            }
        ])
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        // Not the raw 91 behind it, and not through a native title.
        expect(cellAt(screen.container, 0, 0).title).toBe('')
        expect(await openTooltip(triggerIn(screen.container, 0, 0))).toBe('$91.00')
    })

    it('takes the text from a callback, which also gets the formatted text', async () => {
        const seen: (string | undefined)[] = []
        const grid = makeGrid([
            {
                id: 'score',
                header: 'Score',
                width: 120,
                type: 'number',
                tooltip: ({ row, value, formatted }) => {
                    seen.push(formatted)
                    return `${row.name}: ${value}/100`
                }
            }
        ])
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        expect(await openTooltip(triggerIn(screen.container, 0, 0))).toBe('Ada: 91/100')
        expect(seen).toContain('91')
    })

    it('leaves a blank cell without a tooltip rather than showing "null"', async () => {
        const grid = makeGrid([{ id: 'note', header: 'Note', width: 120, tooltip: true }])
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        expect(cellAt(screen.container, 1, 0).querySelector('[data-tooltip-trigger]')).toBeNull()
    })

    it('keeps the grid one tab stop, tooltip trigger included', async () => {
        const grid = makeGrid([
            { id: 'name', header: 'Name', width: 160, tooltip: true },
            { id: 'score', header: 'Score', width: 120, tooltip: true }
        ])
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        // bits-ui hands its trigger a tabindex of 0. Left alone, a page of rows
        // would be a page of tab stops — the fault the checkbox column had.
        const triggers = screen.container.querySelectorAll<HTMLElement>('[data-tooltip-trigger]')
        expect(triggers.length).toBeGreaterThan(0)
        for (const trigger of triggers) expect(trigger.tabIndex).toBe(-1)
    })

    it('marks a column that manages its own tooltip so hover stays out of it', async () => {
        const grid = makeGrid([
            { id: 'name', header: 'Name', width: 120, tooltip: false },
            { id: 'note', header: 'Note', width: 120 }
        ])
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        expect(cellAt(screen.container, 0, 0).hasAttribute('data-dg-manual-tooltip')).toBe(true)
        // The column that said nothing is still the hover measure's business.
        expect(cellAt(screen.container, 0, 1).hasAttribute('data-dg-manual-tooltip')).toBe(false)
    })
})

describe('ColumnDef.meta', () => {
    it('rides along untouched for a renderer or feature to read', async () => {
        const meta = { exportGroup: 'identity', width: 'auto' }
        const grid = makeGrid([{ id: 'name', header: 'Name', width: 160, meta }])
        await render(TypedDataGrid, { grid })

        expect(grid.columns.get('name')?.def.meta).toBe(meta)
    })
})

describe('tooltip on the playground', () => {
    it('shows the formatted amount on the renderers page', async () => {
        const screen = await render(Renderers as never)
        await expect.element(screen.getByRole('grid').first()).toBeVisible()

        // Found by the trigger rather than by a column index the demo may move.
        const trigger = screen.container.querySelector<HTMLElement>('[data-tooltip-trigger]')!
        const salary = trigger.closest<HTMLElement>('[data-dg-cell]')!
        expect(trigger.tabIndex).toBe(-1)

        await userEvent.hover(trigger)
        await expect
            .poll(
                () =>
                    document
                        .querySelector('[data-bits-floating-content-wrapper]')
                        ?.textContent?.trim(),
                { timeout: 3000 }
            )
            .toBe(salary.textContent?.trim())
    })

    it('leaves a callback tooltip working on the QA page', async () => {
        const screen = await render(Qa as never)
        await expect.element(screen.getByRole('grid').first()).toBeVisible()

        const trigger = screen.container.querySelector<HTMLElement>('[data-tooltip-trigger]')
        expect(trigger).not.toBeNull()
        expect(trigger!.tabIndex).toBe(-1)
    })
})
