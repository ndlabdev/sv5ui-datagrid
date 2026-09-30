import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import AlongRow from '../routes/pivot/along-row/+page.svelte'
import Cases from '../routes/pivot/cases/+page.svelte'
import Crossing from '../routes/pivot/crossing/+page.svelte'
import Drill from '../routes/pivot/drill/+page.svelte'
import Exporting from '../routes/pivot/export/+page.svelte'
import Filtering from '../routes/pivot/filtering/+page.svelte'
import Folding from '../routes/pivot/folding/+page.svelte'
import Gate from '../routes/pivot/gate/+page.svelte'
import Growing from '../routes/pivot/growing/+page.svelte'
import Header from '../routes/pivot/header/+page.svelte'
import Heatmap from '../routes/pivot/heatmap/+page.svelte'
import KeepRows from '../routes/pivot/keep-rows/+page.svelte'
import Keys from '../routes/pivot/keys/+page.svelte'
import MaxColumns from '../routes/pivot/max-columns/+page.svelte'
import Measures from '../routes/pivot/measures/+page.svelte'
import Menu from '../routes/pivot/menu/+page.svelte'
import Nested from '../routes/pivot/nested/+page.svelte'
import Ordering from '../routes/pivot/ordering/+page.svelte'
import Panel from '../routes/pivot/panel/+page.svelte'
import Ratio from '../routes/pivot/ratio/+page.svelte'
import Server from '../routes/pivot/server/+page.svelte'
import Shares from '../routes/pivot/shares/+page.svelte'
import Sorting from '../routes/pivot/sorting/+page.svelte'
import TotalRow from '../routes/pivot/total-row/+page.svelte'
import Totals from '../routes/pivot/totals/+page.svelte'
import ValuesOnRows from '../routes/pivot/values-on-rows/+page.svelte'
import Views from '../routes/pivot/views/+page.svelte'

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
    ['heatmap', Heatmap],
    ['keys', Keys],
    ['keep-rows', KeepRows],
    ['ordering', Ordering],
    ['header', Header],
    ['growing', Growing],
    ['filtering', Filtering],
    ['sorting', Sorting],
    ['max-columns', MaxColumns],
    ['drill', Drill],
    ['menu', Menu],
    ['panel', Panel],
    ['views', Views],
    ['gate', Gate],
    ['export', Exporting],
    ['server', Server]
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

    it('lists every demo on the index', async () => {
        render(Cases as never)
        await expect.element(page.getByRole('heading', { level: 1 })).toBeVisible()

        const links = Array.from(document.querySelectorAll('a[href^="/pivot/"]'))
        expect(links.length).toBeGreaterThanOrEqual(pages.length)
    })
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

    it('reads a row across to 100 percent', async () => {
        render(Shares as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        expect(cells().slice(0, 4)).toEqual(['North', '54.5%', '45.5%', '-'])
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
        render(Growing as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()
        expect(headers()).not.toContain('Q4')

        await page.getByRole('button', { name: 'Thêm hai dòng quý Q4' }).click()
        await expect.poll(() => headers()).toContain('Q4')
    })

    it('empties a filtered out column instead of dropping it', async () => {
        render(Filtering as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        const before = headers()
        await page.getByRole('button', { name: 'Chỉ Q2' }).click()

        await expect.poll(() => cells().slice(0, 4)).toEqual(['North', '-', '150', '-'])
        expect(headers()).toEqual(before)
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

    it('sends the crossing to the server and draws what came back', async () => {
        render(Server as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        await expect.poll(() => document.body.textContent ?? '').toContain('"rows"')
        expect(headers()).toEqual(expect.arrayContaining(['Q1', 'Q2', 'Q3']))
    })

    it('writes the crossing to csv, one line per row on screen', async () => {
        render(Exporting as never)
        await expect.element(page.getByRole('treegrid')).toBeVisible()

        const onScreen = document.querySelectorAll('[role="row"][data-dg-row-id]').length
        await page.getByRole('button', { name: 'Xuất CSV' }).click()

        const csv = () =>
            Array.from(document.querySelectorAll('pre'))
                .map((node) => node.textContent ?? '')
                .find((text) => text.includes('Vùng')) ?? ''

        await expect.poll(csv).not.toBe('')
        expect(csv().trim().split('\n')).toHaveLength(onScreen + 1)
    })
})
