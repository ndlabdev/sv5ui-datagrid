import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import Axes from '../routes/pivot/axes/+page.svelte'
import Drill from '../routes/pivot/drill/+page.svelte'
import Folding from '../routes/pivot/folding/+page.svelte'
import Keys from '../routes/pivot/keys/+page.svelte'
import Shares from '../routes/pivot/shares/+page.svelte'

const headers = () =>
    Array.from(document.querySelectorAll('[role="columnheader"]')).map(
        (cell) => cell.textContent?.trim() ?? ''
    )

const click = async (name: string) =>
    page.getByRole('button', { name, exact: true }).first().click()

const open = async (Page: unknown) => {
    render(Page as never)
    await expect.element(page.getByRole('treegrid').first()).toBeVisible()
}

describe('the axes page drives the crossing at run time', () => {
    it('shows the row field and the crossing, and no column full of dashes', async () => {
        await open(Axes)
        expect(headers()).toEqual(['Vùng', 'Q1', 'Q2', 'Q3'])
    })

    it('trades the two axes without changing what was measured', async () => {
        await open(Axes)
        await click('Đổi hai trục')
        await expect.poll(() => headers()).toEqual(['Quý', 'East', 'North', 'South'])
    })

    it('lands where the buttons say when the crossing is turned back on', async () => {
        await open(Axes)
        await click('Tắt phép giao')
        await expect.poll(() => headers()).toContain('Tiền')

        await click('Bật lại')
        await expect.poll(() => headers()).toEqual(['Vùng', 'Q1', 'Q2', 'Q3'])
    })

    it('keeps the buttons and the grid agreeing after a view is reloaded', async () => {
        await open(Axes)
        await click('Lưu view')
        await click('Đổi hai trục')
        await expect.poll(() => headers()).toContain('North')

        await click('Nạp lại view đã lưu')
        await expect.poll(() => headers()).toEqual(['Vùng', 'Q1', 'Q2', 'Q3'])

        const said = document.querySelector('[data-dg-axes]')?.textContent ?? ''
        expect(said).toContain('region')
        expect(said).toContain('quarter')
    })
})

describe('the keys page keeps a declared order', () => {
    it('keeps declared keys to the field they were declared for', async () => {
        await open(Keys)
        expect(headers()).toEqual(['Vùng', 'Small', 'Medium', 'Large', 'Huge'])

        await click('Đang dùng thứ tự tự khai')
        await expect.poll(() => headers()).toEqual(['Vùng', 'Large', 'Medium', 'Small'])
    })
})

describe('folding a column group in the demo', () => {
    it('folds one branch down to its total and leaves the others alone', async () => {
        await open(Folding)
        await expect.poll(() => headers()).toContain('Q1 cộng')

        const leaves = () => headers().filter((text) => text === 'Widget').length
        const opened = leaves()
        expect(opened).toBeGreaterThan(1)

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
        await open(Shares)
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
        await open(Shares)
        await expect.poll(() => cells()[0]?.[1] ?? '').toContain('%')

        await click('Như đã đo')
        await expect.poll(() => cells()[0]?.[1] ?? '').not.toContain('%')
    })
})

describe('seeing the rows behind a cell in the demo', () => {
    const measured = () =>
        Array.from(document.querySelectorAll('[data-dg-row-id] [role="gridcell"]')).filter(
            (element) => /\d/.test(element.textContent ?? '')
        )

    const panel = () =>
        Array.from(document.querySelectorAll('h2')).find((heading) =>
            (heading.textContent ?? '').includes('dòng sau ô')
        )

    it('opens the source rows on a double click, and they add up', async () => {
        await open(Drill)
        expect(panel()).toBeUndefined()

        measured()[0]?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))

        await expect.poll(() => panel()?.textContent ?? '').toContain('dòng sau ô')
        expect(panel()?.textContent).toContain('2 dòng')
        expect(panel()?.textContent).toContain('180')
        expect(document.querySelectorAll('table tbody tr').length).toBe(2)
    })

    it('closes again', async () => {
        await open(Drill)
        measured()[0]?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))
        await expect.poll(() => panel()).toBeDefined()

        await click('Đóng')
        await expect.poll(() => panel()).toBeUndefined()
    })

    it('picks the cell the reader actually clicked, not the one at that index', async () => {
        await open(Drill)

        const cells = measured()
        expect(cells.length).toBeGreaterThan(1)
        cells[1]!.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }))

        await expect.poll(() => panel()).toBeDefined()
        expect(panel()?.textContent).toContain('Q2')
    })
})
