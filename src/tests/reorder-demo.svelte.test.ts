import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import Reorder from '../routes/reorder/+page.svelte'

describe('row reorder demo', () => {
    it('renders, keeps row 1 locked and moves a row with the keyboard', async () => {
        render(Reorder as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        const firstHandle = document.querySelector<HTMLElement>('[aria-label="Move row 1"]')!
        expect(firstHandle.hasAttribute('disabled')).toBe(true)

        const titleOf = (row: number) =>
            document.querySelector(`[data-dg-cell="${row}:3"]`)?.textContent?.trim()
        expect(titleOf(1)).toBe('Task 2')

        const cell = document.querySelector<HTMLElement>('[data-dg-cell="1:3"]')!
        cell.focus()
        cell.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowDown', altKey: true, bubbles: true })
        )

        await expect.poll(() => titleOf(1)).toBe('Task 3')
        await expect.poll(() => document.body.textContent).toContain('Task 2: 2 → 3')
    })
})
