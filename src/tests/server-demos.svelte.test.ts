import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import Big from '../routes/server/big/+page.svelte'
import Infinite from '../routes/server/infinite/+page.svelte'

/** What the demo measured, read back off the panel it renders. */
function metric(label: string): number {
    const panel = document.querySelector('[data-testid="metrics"]')
    const term = Array.from(panel?.querySelectorAll('dt') ?? []).find((node) =>
        node.textContent?.startsWith(label)
    )
    return Number.parseFloat(term?.nextElementSibling?.textContent ?? 'NaN')
}

const domRows = () => document.querySelectorAll('[role="row"][data-dg-row-id]').length

describe('server big-data demo', () => {
    it('holds one page of a million rows, whatever the page is', async () => {
        render(Big as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        await expect.poll(() => metric('rows in the DOM')).toBe(50)

        // The page number moves; the cost does not, because the grid is handed
        // 50 rows either way and never sees the 999,950 it did not ask for.
        await page.getByRole('button', { name: 'Jump to the last page' }).click()
        await expect.element(page.getByRole('gridcell', { name: '1000000' })).toBeVisible()
        await expect.poll(() => metric('rows in the DOM')).toBe(50)
    })

    it('costs the same on a backend a hundred times larger', async () => {
        render(Big as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        await expect.poll(() => metric('rows in the DOM')).toBe(50)

        await page.getByRole('button', { name: 'Turn 20 pages' }).click()
        await expect.poll(() => metric('avg of 20')).toBeGreaterThan(0)
        const smallerBackend = metric('avg of 20')

        await page.getByRole('button', { name: 'Backend size' }).click()
        await page.getByRole('option', { name: '10,000,000 rows' }).click()
        await expect.poll(() => metric('rows in the DOM')).toBe(50)

        await page.getByRole('button', { name: 'Turn 20 pages' }).click()
        await expect.poll(() => metric('avg of 20')).toBeGreaterThan(0)

        // A hundredfold backend, the same page. The comparison is against the
        // run before it rather than against a number, and the floor is loose:
        // a two-core runner sharing itself out measures a single page turn
        // anywhere between 15ms and 230ms, so an absolute ceiling here says
        // more about the runner than about the grid. `budgets.test.ts` owns
        // the wall-clock ceilings, where a best-of-three keeps them honest;
        // what belongs here is that the size of the set does not count, which
        // a regression would show as an order of magnitude, not as noise.
        expect(metric('avg of 20')).toBeLessThan(Math.max(smallerBackend * 4, 200))
        expect(metric('rows scanned')).toBe(50)
    })

    it('puts a thousand-row page in the DOM when asked, and says so', async () => {
        render(Big as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        await expect.poll(() => metric('rows in the DOM')).toBe(50)

        await page.getByRole('button', { name: 'Page size' }).click()
        await page.getByRole('option', { name: '1000 / page' }).click()

        // Page size is the variable that costs, which is the demo's point:
        // this is where a server model wants virtualization instead.
        await expect.poll(() => metric('rows in the DOM'), { timeout: 5000 }).toBe(1000)
    })
})

describe('server infinite-scroll demo', () => {
    const held = () => {
        const text = document.querySelector('[data-testid="infinite-state"]')?.textContent ?? ''
        return Number.parseInt(text.match(/([\d,]+) of/)?.[1].replace(/,/g, '') ?? '0', 10)
    }

    it('loads the first chunk and windows it', async () => {
        render(Infinite as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        await expect.poll(held).toBe(200)
        expect(domRows()).toBeLessThan(80)
    })

    it('fetches more as the window nears the end, and the DOM stays put', async () => {
        render(Infinite as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        await expect.poll(held).toBe(200)

        const viewport = document.querySelector<HTMLElement>('[role="grid"]')!
        for (let step = 0; step < 12; step++) {
            viewport.scrollTop += 2000
            viewport.dispatchEvent(new Event('scroll'))
            await new Promise((resolve) => requestAnimationFrame(resolve))
        }

        // Rows held grows by the chunk; rows rendered stays the window, which
        // is what the viewport can show plus the overscan either side.
        await expect.poll(held).toBeGreaterThan(600)
        expect(domRows()).toBeLessThan(60)
        expect(held()).toBeGreaterThan(domRows() * 10)
    })
})
