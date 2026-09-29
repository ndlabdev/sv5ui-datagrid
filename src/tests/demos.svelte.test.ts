import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import Headless from '../routes/headless/+page.svelte'
import Persistence from '../routes/persistence/+page.svelte'
import Pivot from '../routes/pivot/+page.svelte'
import Server from '../routes/server/+page.svelte'

describe('headless demo', () => {
    it('builds a working grid from the compound parts', async () => {
        render(Headless as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        await expect.element(page.getByPlaceholder('Tìm task...')).toBeVisible()
        await expect.element(page.getByText(/Trang 1 \//)).toBeVisible()
    })

    it('drives filtering through the accessor', async () => {
        render(Headless as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        const rowCount = () => document.querySelectorAll('[role="row"][data-dg-row-id]').length
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

        expect(state()).toContain('page 2/14')
        await expect.element(page.getByRole('gridcell', { name: 'Charlie #11' })).toBeVisible()
        expect(events().filter((entry) => entry.includes('pageChanged'))).toEqual([
            'pageChanged { page: 2 }'
        ])
    })

    it('indexes the rows it holds, so the keyboard still reaches them', async () => {
        await openPageTwo()

        await page.getByRole('gridcell', { name: 'Charlie #11' }).click()
        await userEvent.keyboard(' ')
        await expect.poll(state).toContain('1 selected')
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
        document
            .elementFromPoint(box.left + 2, box.top + 2)!
            .dispatchEvent(new MouseEvent('click', { bubbles: true }))

        await expect.poll(state).toContain('1 selected')
        expect(events()).toContain('selectionChanged { 1 ids }')

        await page.getByRole('button', { name: 'Go to page 5' }).click()
        await expect.poll(state).toContain('page 5/14')
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

describe('pivot demo', () => {
    const headers = () =>
        Array.from(document.querySelectorAll('[role="columnheader"]')).map(
            (cell) => cell.textContent?.trim() ?? ''
        )

    const rowCount = () => document.querySelectorAll('[role="row"][data-dg-row-id]').length

    async function show(label: string) {
        render(Pivot as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        if (label !== '1. Dữ liệu thô') {
            await page.getByRole('button', { name: label }).click()
        }
    }

    it('starts on the long list the pivot is made from', async () => {
        await show('1. Dữ liệu thô')

        expect(headers()).toEqual(['Region', 'Quarter', 'Product', 'Shipped', 'Size', 'Amount'])
        await expect.poll(rowCount).toBeGreaterThan(50)
    })

    it('folds that list down one field, keeping the declared columns', async () => {
        await show('2. Gộp nhóm')
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        expect(headers()).toEqual(['Region', 'Quarter', 'Product', 'Shipped', 'Size', 'Amount'])
        await expect.poll(rowCount).toBe(4)
    })

    it('folds it down and across, inventing a column per value found', async () => {
        await show('3. Pivot')
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        for (const quarter of ['Q1', 'Q2', 'Q3', 'Q4']) {
            await expect.poll(() => headers()).toContain(quarter)
        }
        expect(headers()).not.toContain('Quarter')
        expect(headers()).not.toContain('Amount')
        expect(headers()).toContain('Region')
    })

    it('grows a column when the data grows a value, with no code change', async () => {
        await show('3. Pivot')
        await expect.poll(() => headers()).toContain('Q4')
        expect(headers()).not.toContain('Q5')

        await page.getByRole('button', { name: 'Thêm dữ liệu quý Q5' }).click()
        await expect.poll(() => headers()).toContain('Q5')
        expect(headers()).toContain('Region')
    })

    it('transposes the table when the two axes trade places', async () => {
        await show('3. Pivot')
        await expect.poll(() => headers()).toContain('Q1')

        await page.getByRole('button', { name: 'Đổi trục' }).click()
        await expect.poll(() => headers()).toContain('North')
        expect(headers()).toContain('Quarter')
        expect(headers()).not.toContain('Q1')
    })

    it('crosses on whichever pair of fields is picked', async () => {
        await show('3. Pivot')
        await page.getByRole('button', { name: 'product', exact: true }).nth(1).click()

        await expect.poll(() => headers()).toContain('Widget')
        expect(headers()).not.toContain('Q1')
    })
})

describe('pivot demo, the parts a reader has to see working', () => {
    const headers = () =>
        Array.from(document.querySelectorAll('[role="columnheader"]')).map(
            (cell) => cell.textContent?.trim() ?? ''
        )

    async function openPivot() {
        render(Pivot as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        await page.getByRole('button', { name: '3. Pivot' }).click()
        await expect.element(page.getByRole('treegrid')).toBeVisible()
    }

    it('puts a date axis in date order, drawn as dates', async () => {
        await openPivot()
        await page.getByRole('button', { name: 'shipped', exact: true }).nth(1).click()

        await expect.poll(() => headers().some((text) => text.includes('2026'))).toBe(true)

        const drawn = headers().filter((text) => text.includes('2026'))
        expect(drawn).toEqual([
            '10 thg 1, 2026',
            '10 thg 4, 2026',
            '10 thg 7, 2026',
            '10 thg 10, 2026'
        ])
        expect(drawn.every((text) => !text.includes('T00:00'))).toBe(true)
    })

    it('takes the order the application declares over the one the values have', async () => {
        await openPivot()
        await page.getByRole('button', { name: 'size', exact: true }).nth(1).click()
        await expect.poll(() => headers()).toContain('Large')
        expect(headers().filter((t) => ['Small', 'Medium', 'Large'].includes(t))).toEqual([
            'Large',
            'Medium',
            'Small'
        ])

        await page.getByRole('button', { name: 'Tự khai khoá cho Size' }).click()
        await expect
            .poll(() => headers().filter((t) => ['Small', 'Medium', 'Large'].includes(t)))
            .toEqual(['Small', 'Medium', 'Large'])
    })

    it('closes each nested column group with its own total', async () => {
        await openPivot()
        await page.getByRole('button', { name: 'Lồng thêm Product ra ngang' }).click()
        await expect.poll(() => headers()).toContain('Widget')

        await page.getByRole('button', { name: 'Tổng con mỗi nhóm cột' }).click()
        await expect.poll(() => headers().some((text) => text.endsWith(' tổng'))).toBe(true)
    })

    it('turns the crossing off and back on through the api', async () => {
        await openPivot()
        expect(headers()).toContain('Q1')

        await page.getByRole('button', { name: 'Tắt pivot' }).click()
        await expect.poll(() => headers()).toContain('Quarter')
        expect(headers()).not.toContain('Q1')

        await page.getByRole('button', { name: 'Bật lại' }).click()
        await expect.poll(() => headers()).toContain('Q1')
    })

    it('brings a saved crossing back after it was turned off', async () => {
        await openPivot()
        await page.getByRole('button', { name: 'Lưu view' }).click()
        await page.getByRole('button', { name: 'Tắt pivot' }).click()
        await expect.poll(() => headers()).not.toContain('Q1')

        await page.getByRole('button', { name: 'Nạp lại view đã lưu' }).click()
        await expect.poll(() => headers()).toContain('Q1')
    })
})
