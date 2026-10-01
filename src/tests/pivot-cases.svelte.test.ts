import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import AlongRow from '../routes/pivot/along-row/+page.svelte'
import Index from '../routes/pivot/+page.svelte'
import Axes from '../routes/pivot/axes/+page.svelte'
import Crossing from '../routes/pivot/crossing/+page.svelte'
import Header from '../routes/pivot/header/+page.svelte'
import Drill from '../routes/pivot/drill/+page.svelte'
import Folding from '../routes/pivot/folding/+page.svelte'
import KeepRows from '../routes/pivot/keep-rows/+page.svelte'
import Keys from '../routes/pivot/keys/+page.svelte'
import MaxColumns from '../routes/pivot/max-columns/+page.svelte'
import Measures from '../routes/pivot/measures/+page.svelte'
import Nested from '../routes/pivot/nested/+page.svelte'
import OrderColumns from '../routes/pivot/order-columns/+page.svelte'
import Ordering from '../routes/pivot/ordering/+page.svelte'
import Panel from '../routes/pivot/panel/+page.svelte'
import Ratio from '../routes/pivot/ratio/+page.svelte'
import Shares from '../routes/pivot/shares/+page.svelte'
import Sorting from '../routes/pivot/sorting/+page.svelte'
import TotalRow from '../routes/pivot/total-row/+page.svelte'
import Totals from '../routes/pivot/totals/+page.svelte'
import ValuesOnRows from '../routes/pivot/values-on-rows/+page.svelte'

const pages: [string, unknown][] = [
    ['crossing', Crossing],
    ['totals', Totals],
    ['total-row', TotalRow],
    ['nested', Nested],
    ['folding', Folding],
    ['measures', Measures],
    ['values-on-rows', ValuesOnRows],
    ['shares', Shares],
    ['along-row', AlongRow],
    ['ratio', Ratio],

    ['keys', Keys],
    ['keep-rows', KeepRows],
    ['ordering', Ordering],
    ['order-columns', OrderColumns],
    ['header', Header],

    ['max-columns', MaxColumns],
    ['drill', Drill],
    ['sorting', Sorting],
    ['axes', Axes],

    ['panel', Panel]
]

const headers = () =>
    Array.from(document.querySelectorAll('[role="columnheader"]')).map(
        (cell) => cell.textContent?.trim() ?? ''
    )

const cells = () =>
    Array.from(document.querySelectorAll('[role="gridcell"]')).map(
        (cell) => cell.textContent?.trim() ?? ''
    )

describe('every pivot demo page stands up', () => {
    for (const [name, Page] of pages) {
        it(`draws a grid and says what it is for on ${name}`, async () => {
            const errors: unknown[] = []
            const spy = vi.spyOn(console, 'error').mockImplementation((...args) => {
                errors.push(args[0])
            })

            render(Page as never)
            await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible()

            expect((document.body.textContent ?? '').length).toBeGreaterThan(80)
            expect(
                document.querySelectorAll('[role="treegrid"], [role="grid"]').length
            ).toBeGreaterThan(0)
            expect(errors).toEqual([])
            spy.mockRestore()

            const grid = document.querySelector('[role="treegrid"], [role="grid"]')
            const box = grid?.getBoundingClientRect().height ?? 0
            const filled =
                grid?.querySelector('[role="rowgroup"]:last-of-type')?.getBoundingClientRect()
                    .height ?? 0
            const header =
                grid?.querySelector('[role="rowgroup"]')?.getBoundingClientRect().height ?? 0

            expect(box, 'lưới phải có chiều cao').toBeGreaterThan(0)
            expect(box - filled - header, 'không được thừa khoảng trắng').toBeLessThan(24)
        })
    }

    it('lists every one of them at the one way in, and lists nothing else', async () => {
        render(Index as never)
        await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible()

        const linked = Array.from(document.querySelectorAll('a[href^="/pivot/"]')).map((anchor) =>
            (anchor.getAttribute('href') ?? '').replace('/pivot/', '')
        )
        const known = new Set(pages.map(([name]) => name))

        for (const [name] of pages) expect(linked, name).toContain(name)
        for (const name of linked) expect(known, name).toContain(name)
        expect(linked.length).toBe(pages.length)
    })

    for (const [name, Page] of pages) {
        it(`says how it works, not just what it looks like, on ${name}`, async () => {
            render(Page as never)
            await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible()

            const explained = Array.from(document.querySelectorAll('h2'))
                .map((heading) => (heading.textContent ?? '').trim())
                .filter(Boolean)
            expect(explained.length, name).toBeGreaterThan(0)

            const prose = Array.from(document.querySelectorAll('p'))
                .map((paragraph) => paragraph.textContent?.trim() ?? '')
                .reduce((longest, text) => Math.max(longest, text.length), 0)
            expect(prose, name).toBeGreaterThan(120)
        })
    }
})

describe('what each pivot demo is supposed to show', () => {
    it('crosses region by quarter into columns the data made', async () => {
        render(Crossing as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        expect(headers()).toEqual(['Vùng', 'Q1', 'Q2', 'Q3'])
        expect(cells().slice(0, 4)).toEqual(['North', '180', '150', '-'])
    })

    it('measures the total from the rows, so the average reads 110 and not 120', async () => {
        render(Totals as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        const north = cells().slice(0, 5)
        expect(north).toEqual(['North', '90', '150', '-', '110'])
    })

    it('closes both directions on the same corner', async () => {
        render(TotalRow as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        expect(cells().slice(-5)).toEqual(['Tất cả', '460', '370', '220', '1,050'])
    })

    it('puts a key with no rows behind it on the axis', async () => {
        render(Keys as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        expect(headers()).toEqual(['Vùng', 'Small', 'Medium', 'Large', 'Huge'])
    })

    it('refuses to cross when the columns would overflow, handing back the plain list', async () => {
        render(MaxColumns as never)
        await expect.element(page.getByRole('treegrid').first()).toBeVisible()

        expect(headers()).toEqual(expect.arrayContaining(['Vùng', 'Quý', 'Hàng', 'Cỡ']))
    })

    it('redraws itself when the ceiling moves, without the grid being rebuilt', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        render(MaxColumns as never)
        await expect.element(page.getByRole('treegrid').first()).toBeVisible()

        const crossed = () => headers().filter((text) => text.startsWith('Q')).length
        const refused = crossed()

        await page.getByRole('button', { name: 'Nâng trần lên 50' }).click()
        await expect.poll(crossed).toBeGreaterThan(refused)

        await page.getByRole('button', { name: 'Hạ trần về 3' }).click()
        await expect.poll(crossed).toBe(refused)
        warn.mockRestore()
    })

    it('reads a row across to 100 percent', async () => {
        render(Shares as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        expect(cells().slice(0, 4)).toEqual(['North', '54.5%', '45.5%', '-'])
    })

    it('puts the biggest quarter first, and the total row follows', async () => {
        render(OrderColumns as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        expect(headers()).toEqual(['Vùng', 'Q1', 'Q2', 'Q3'])

        await page.getByRole('button', { name: 'Lớn nhất trước' }).click()
        await expect.poll(() => headers()).toEqual(['Vùng', 'Q1', 'Q2', 'Q3'])
        expect(cells().slice(-4)).toEqual(['Tất cả', '460', '370', '220'])

        await page.getByRole('button', { name: 'Nhỏ nhất trước' }).click()
        await expect.poll(() => headers()).toEqual(['Vùng', 'Q3', 'Q2', 'Q1'])
        expect(cells().slice(-4)).toEqual(['Tất cả', '220', '370', '460'])
    })

    it('keeps the two largest and measures the total over them', async () => {
        render(KeepRows as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        expect(cells().slice(-5)).toEqual(['Tất cả', '460', '370', '220', '1,050'])

        await page.getByRole('button', { name: 'Chỉ hai vùng lớn nhất' }).click()
        await expect.poll(() => cells()[0]).toBe('South')
        expect(cells().at(-1)).toBe('750')

        await page.getByRole('button', { name: 'Gom phần còn lại thành một hàng' }).click()
        await expect.poll(() => cells().at(-1)).toBe('1,050')
    })

    it('grows a column when the data grows a value', async () => {
        render(Crossing as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()
        expect(headers()).not.toContain('Q4')

        await page.getByRole('button', { name: 'Thêm hai dòng quý Q4' }).click()
        await expect.poll(() => headers()).toContain('Q4')
    })

    it('moves the measures between the axes', async () => {
        render(ValuesOnRows as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()
        const down = headers().length

        await page.getByRole('button', { name: 'Chạy ngang' }).click()
        await expect.poll(() => headers().length).toBeGreaterThan(down)

        await page.getByRole('button', { name: 'Chạy dọc' }).click()
        await expect.poll(() => headers().length).toBe(down)
    })

    it('lets the application name the headers the crossing invented', async () => {
        render(Header as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        expect(headers()).toContain('Quý một')
        expect(headers()).toContain('WIDGET')
        expect(headers()).not.toContain('Q1')

        await page.getByRole('button', { name: 'Đang tự đặt chữ' }).click()
        await expect.poll(() => headers()).toContain('Q1')
        expect(headers()).toContain('Widget')
    })

    it('sorts the groups by a column the crossing made, biggest first', async () => {
        render(Sorting as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        const labels = () =>
            Array.from(document.querySelectorAll('[role="row"][data-dg-row-id]'))
                .map((row) => row.querySelector('[role="gridcell"]')?.textContent?.trim() ?? '')
                .filter(Boolean)

        expect(labels()).toEqual(['North', 'South', 'East'])

        const sortBy = (header: string) =>
            page.getByRole('button', { name: header, exact: true }).first().click()

        await sortBy('Q1')
        await expect.poll(labels).toEqual(['East', 'North', 'South'])

        await sortBy('Q1')
        await expect.poll(labels).toEqual(['South', 'North', 'East'])

        await sortBy('Cả năm')
        await expect.poll(labels).toEqual(['East', 'North', 'South'])
    })

    it('trades the axes, turns the crossing off, and brings a saved view back', async () => {
        render(Axes as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()
        expect(headers()).toEqual(['Vùng', 'Q1', 'Q2', 'Q3'])

        await page.getByRole('button', { name: 'Lưu view' }).click()
        await page.getByRole('button', { name: 'Đổi hai trục' }).click()
        await expect.poll(() => headers()).toEqual(['Quý', 'East', 'North', 'South'])

        await page.getByRole('button', { name: 'Tắt phép giao' }).click()
        await expect.poll(() => headers()).toContain('Tiền')

        await page.getByRole('button', { name: 'Nạp lại view đã lưu' }).click()
        await expect.poll(() => headers()).toEqual(['Vùng', 'Q1', 'Q2', 'Q3'])
    })
})
