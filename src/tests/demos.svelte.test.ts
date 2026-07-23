import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import Headless from '../routes/headless/+page.svelte'
import Persistence from '../routes/persistence/+page.svelte'

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
