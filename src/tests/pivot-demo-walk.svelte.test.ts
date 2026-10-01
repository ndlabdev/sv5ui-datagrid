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

const readAs = async (reading: string) => {
    await page.getByRole('button', { name: 'Đọc theo' }).click()
    await page.getByRole('menuitem', { name: reading, exact: true }).click()
}

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
        expect(headers()).toEqual(['Vùng', 'Q1', 'Q2', 'Q3'])
    })

    it('keeps declared keys to the field they were declared for', async () => {
        await open()
        await pickAcross('size')
        await click('Tự khai khoá cho Size')
        expect(headers()).toEqual(['Vùng', 'Small', 'Medium', 'Large'])

        await pickAcross('quarter')
        expect(headers()).toEqual(['Vùng', 'Q1', 'Q2', 'Q3'])
    })

    it('lands where the buttons say when the crossing is turned back on', async () => {
        await open()
        await click('Lồng thêm Product ra ngang')
        await expect.poll(() => headers()).toContain('Widget')

        await click('Tắt pivot')
        await expect.poll(() => headers()).toContain('Tiền')

        await click('Bật lại')
        await expect.poll(() => headers()).toEqual(['Vùng', 'Q1', 'Q2', 'Q3'])
    })

    it('keeps the buttons and the grid agreeing after a view is reloaded', async () => {
        await open()
        await click('Lưu view')
        await pickAcross('size')
        await expect.poll(() => headers()).toContain('Large')

        await click('Nạp lại view đã lưu')
        await expect.poll(() => headers()).toEqual(['Vùng', 'Q1', 'Q2', 'Q3'])

        const pressed = Array.from(document.querySelectorAll('button'))
            .filter((button) => button.textContent?.trim() === 'quarter')
            .map((button) => button.className.includes('outline'))

        expect(pressed).toContain(false)
    })
})

describe('folding a column group in the demo', () => {
    it('folds one branch down to its total and leaves the others alone', async () => {
        await open()

        await click('Lồng thêm Product ra ngang')
        await expect.poll(() => headers()).toContain('Widget')

        await click('Tổng con')
        await expect.poll(() => headers()).toContain('Q1 cộng')

        await click('Cho gập nhóm cột')
        await expect
            .poll(() => document.querySelectorAll('[aria-expanded="true"]').length)
            .toBeGreaterThan(0)

        const leaves = () => headers().filter((text) => text === 'Widget').length
        const opened = leaves()

        const group = Array.from(
            document.querySelectorAll('[role="columnheader"][aria-expanded="true"]')
        ).find((el) => (el.textContent ?? '').trim().startsWith('Q1'))
        const fold = group?.querySelector('button') as HTMLElement | null | undefined

        expect(group).toBeDefined()
        expect(fold).toBeTruthy()

        fold?.click()

        await expect.poll(leaves).toBe(opened - 1)
        expect(headers()).toContain('Q1 cộng')
        expect(headers()).toContain('Q2 cộng')
    })
})

describe('reading a measure as a share in the demo', () => {
    const cells = () =>
        Array.from(document.querySelectorAll('[role="row"][data-dg-row-id]'))
            .map((row) =>
                Array.from(row.querySelectorAll('[role="gridcell"]')).map(
                    (cell) => cell.textContent?.trim() ?? ''
                )
            )
            .filter((row) => row.length > 1)

    it('turns the numbers into percentages that read across to a hundred', async () => {
        await open()
        await expect.poll(() => cells()[0]?.[1] ?? '').toMatch(/\d/)

        await readAs('percentOfRow')
        await expect.poll(() => cells()[0]?.[1] ?? '').toContain('%')

        const first = cells()[0]!
            .slice(1)
            .filter((text) => text.includes('%'))
        const total = first.reduce(
            (sum, text) => sum + Number(text.replace(/[^0-9,.]/g, '').replace(',', '.')),
            0
        )
        expect(total).toBeGreaterThan(99)
        expect(total).toBeLessThan(101)
    })

    it('goes back to the measured number when the share is turned off', async () => {
        await open()
        await readAs('percentOfRow')
        await expect.poll(() => cells()[0]?.[1] ?? '').toContain('%')

        await readAs('Như đã đo')
        await expect.poll(() => cells()[0]?.[1] ?? '').not.toContain('%')
    })
})

describe('the panel owns the settings on this page', () => {
    it('keeps what the panel turned on when the page is touched again', async () => {
        await open()
        expect(headers()).not.toContain('Cột tổng')

        await click('Cột tổng')
        await expect.poll(() => headers()).toContain('Cột tổng')

        await click('Lồng thêm Product ra ngang')

        await expect.poll(() => headers()).toContain('Widget')
        expect(headers()).toContain('Cột tổng')
    })

    it('offers each setting once, not once from the page and once from the panel', async () => {
        await open()

        const named = (name: string) =>
            Array.from(document.querySelectorAll('button')).filter((button) =>
                (button.getAttribute('aria-label') ?? button.textContent ?? '')
                    .toLowerCase()
                    .includes(name.toLowerCase())
            ).length

        expect(named('Cột tổng')).toBe(1)
        expect(named('Tổng con')).toBe(1)
        expect(named('Cho gập nhóm cột')).toBe(1)
    })
})

describe('seeing the rows behind a cell in the demo', () => {
    it('opens the source rows on a double click, and they add up', async () => {
        await open()
        expect(document.querySelector('[data-dg-drill]')).toBeNull()

        const cell = Array.from(
            document.querySelectorAll('[data-dg-row-id] [role="gridcell"]')
        ).find((element) => /\d/.test(element.textContent ?? ''))

        expect(cell).toBeDefined()
        cell?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))

        await expect.poll(() => document.querySelector('[data-dg-drill]')).not.toBeNull()
        const rows = document.querySelectorAll('[data-dg-drill] tr')
        expect(rows.length).toBeGreaterThan(0)
    })

    it('closes again', async () => {
        await open()
        const cell = Array.from(
            document.querySelectorAll('[data-dg-row-id] [role="gridcell"]')
        ).find((element) => /\d/.test(element.textContent ?? ''))
        cell?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await expect.poll(() => document.querySelector('[data-dg-drill]')).not.toBeNull()

        await click('Đóng')
        await expect.poll(() => document.querySelector('[data-dg-drill]')).toBeNull()
    })
})

describe('drilling with the row label pinned', () => {
    it('picks the cell the reader actually clicked, not the one at that index', async () => {
        await open()

        const row = document.querySelector('[data-dg-row-id]')!
        const cells = Array.from(row.querySelectorAll('[role="gridcell"]'))
        const measured = cells.filter((cell) => /\d/.test(cell.textContent ?? ''))
        expect(measured.length).toBeGreaterThan(1)

        const second = measured[1]!
        second.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))

        await expect.poll(() => document.querySelector('[data-dg-drill]')).not.toBeNull()

        const heading = document
            .querySelector('[data-dg-drill]')
            ?.closest('div.space-y-2')
            ?.querySelector('h2')?.textContent
        expect(heading).toContain('Q2')
    })
})
