import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import Headless from '../routes/headless/+page.svelte'
import Persistence from '../routes/persistence/+page.svelte'
import Server from '../routes/server/+page.svelte'

describe('headless demo', () => {
    it('builds a working grid from the compound parts', async () => {
        render(Headless as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        // Custom toolbar + custom footer, not <DataGrid>.
        await expect.element(page.getByPlaceholder('Tìm task...')).toBeVisible()
        await expect.element(page.getByText(/Trang 1 \//)).toBeVisible()
    })

    it('drives filtering through the accessor', async () => {
        render(Headless as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        const rowCount = () => document.querySelectorAll('[role="row"][data-dg-row-id]').length
        // A unique term, so the result is smaller than the page of 8.
        await userEvent.fill(page.getByPlaceholder('Tìm task...'), 'Task 48')
        await expect.poll(rowCount).toBe(1)
        await expect.element(page.getByRole('gridcell', { name: 'Task 48' })).toBeVisible()
    })
})

describe('server row model demo', () => {
    const state = () => document.querySelector('[data-testid="server-state"]')?.textContent ?? ''
    const events = () =>
        Array.from(document.querySelectorAll('li')).map((item) => item.textContent ?? '')

    async function openPageTwo() {
        render(Server as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        await expect.poll(state).toContain('page 1/14')

        await page.getByRole('button', { name: 'Go to page 2' }).click()
        await expect.element(page.getByRole('gridcell', { name: 'Charlie #11' })).toBeVisible()
        expect(state()).toContain('page 2/14')
    }

    it('stays on the page a cell was clicked on', async () => {
        await openPageTwo()

        await page.getByRole('gridcell', { name: 'Charlie #11' }).click()

        // The whole point of the server model: the fetched page survives the
        // click instead of the focus dragging the grid back to page 1.
        expect(state()).toContain('page 2/14')
        await expect.element(page.getByRole('gridcell', { name: 'Charlie #11' })).toBeVisible()
        expect(events().filter((entry) => entry.includes('pageChanged'))).toEqual([
            'pageChanged { page: 2 }'
        ])
    })

    it('indexes the rows it holds, so the keyboard still reaches them', async () => {
        await openPageTwo()

        // A server model holds one page, so its row indexes run 0..n on every
        // page. Numbering them from the page offset left every lookup into
        // `preWindowNodes` — Space, Ctrl+C, type-to-edit — pointing past the end.
        await page.getByRole('gridcell', { name: 'Charlie #11' }).click()
        await userEvent.keyboard(' ')
        await expect.poll(state).toContain('1 selected')
        // The focused row, not whichever row the stale index landed on.
        const selected = document.querySelectorAll('[aria-selected="true"][data-dg-row-id]')
        expect(Array.from(selected).map((row) => row.getAttribute('data-dg-row-id'))).toEqual([
            '11'
        ])

        const grid = document.querySelector('[role="grid"]')!
        const row = document.querySelector('[role="row"][data-dg-row-id="11"]')!
        expect(Number(row.getAttribute('aria-rowindex'))).toBeLessThanOrEqual(
            Number(grid.getAttribute('aria-rowcount'))
        )
    })

    it('selects a row from the checkbox column and keeps it across pages', async () => {
        await openPageTwo()

        const cell = document.querySelector<HTMLElement>('[data-dg-cell="0:0"]')!
        const box = cell.getBoundingClientRect()
        // Off the checkbox, inside the cell — where a casual aim lands.
        document
            .elementFromPoint(box.left + 2, box.top + 2)!
            .dispatchEvent(new MouseEvent('click', { bubbles: true }))

        await expect.poll(state).toContain('1 selected')
        expect(events()).toContain('selectionChanged { 1 ids }')

        await page.getByRole('button', { name: 'Go to page 5' }).click()
        await expect.poll(state).toContain('page 5/14')
        // Selection is keyed by row id, so a row off the current page keeps it.
        expect(state()).toContain('1 selected')
    })

    it('adds a page to the selection when select-all is pressed on it', async () => {
        render(Server as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        await expect.poll(state).toContain('page 1/14')

        await page.getByRole('checkbox', { name: 'Select row 1', exact: true }).click()
        await page.getByRole('checkbox', { name: 'Select row 2', exact: true }).click()
        expect(state()).toContain('2 selected')

        await page.getByRole('button', { name: 'Go to page 2' }).click()
        await expect.element(page.getByRole('gridcell', { name: 'Charlie #11' })).toBeVisible()
        // The header checkbox speaks for the rows the grid holds — one page
        // here — so it must not throw away the pages it cannot see.
        await page.getByRole('checkbox', { name: 'Select all rows' }).click()
        await expect.poll(state).toContain('12 selected')

        await page.getByRole('checkbox', { name: 'Select all rows' }).click()
        await expect.poll(state).toContain('2 selected')
    })
})

describe('persistence demo', () => {
    it('shows the live snapshot and updates it on a change', async () => {
        render(Persistence as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        const snapshot = () => document.querySelector('pre')?.textContent ?? ''
        expect(snapshot()).not.toContain('sorting')

        await page.getByRole('button', { name: 'Sort theo price ↓' }).click()
        await expect.poll(snapshot).toContain('sorting')
    })
})
