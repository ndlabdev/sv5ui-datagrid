import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import Pivot from '../routes/pivot/+page.svelte'

const headers = () =>
    Array.from(document.querySelectorAll('[role="columnheader"]')).map(
        (cell) => cell.textContent?.trim() ?? ''
    )

const click = async (name: string) =>
    page.getByRole('button', { name, exact: true }).first().click()

const pickAcross = async (field: string) =>
    page.getByRole('button', { name: field, exact: true }).nth(1).click()

async function open() {
    render(Pivot as never)
    await expect.element(page.getByRole('grid')).toBeVisible()
    await click('3. Pivot')
    await expect.element(page.getByRole('treegrid')).toBeVisible()
}

describe('the pivot demo holds together as a reader drives it', () => {
    it('shows the row field and the crossing, and no column full of dashes', async () => {
        await open()
        expect(headers()).toEqual(['Region', 'Q1', 'Q2', 'Q3', 'Q4'])
    })

    it('keeps declared keys to the field they were declared for', async () => {
        await open()
        await pickAcross('size')
        await click('Tự khai khoá cho Size')
        expect(headers()).toEqual(['Region', 'Small', 'Medium', 'Large'])

        await pickAcross('quarter')
        expect(headers()).toEqual(['Region', 'Q1', 'Q2', 'Q3', 'Q4'])
    })

    it('lands where the buttons say when the crossing is turned back on', async () => {
        await open()
        await click('Lồng thêm Product ra ngang')
        await expect.poll(() => headers()).toContain('Widget')

        await click('Tắt pivot')
        await expect.poll(() => headers()).toContain('Amount')

        await click('Bật lại')
        await expect.poll(() => headers()).toEqual(['Region', 'Q1', 'Q2', 'Q3', 'Q4'])
    })

    it('keeps the buttons and the grid agreeing after a view is reloaded', async () => {
        await open()
        await click('Lưu view')
        await pickAcross('size')
        await expect.poll(() => headers()).toContain('Large')

        await click('Nạp lại view đã lưu')
        await expect.poll(() => headers()).toEqual(['Region', 'Q1', 'Q2', 'Q3', 'Q4'])

        const pressed = Array.from(document.querySelectorAll('button'))
            .filter((button) => button.textContent?.trim() === 'quarter')
            .map((button) => button.className.includes('outline'))

        expect(pressed).toContain(false)
    })
})
