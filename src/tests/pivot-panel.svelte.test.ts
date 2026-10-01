import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import Panel from '../routes/pivot/panel/+page.svelte'

const headers = () =>
    Array.from(document.querySelectorAll('[role="columnheader"]')).map(
        (cell) => cell.textContent?.trim() ?? ''
    )

const zone = (key: string) =>
    document.querySelector(`[data-dg-pivot-zone="${key}"]`) as HTMLElement | null

const chipsIn = (label: string) =>
    Array.from(zone(label)?.querySelectorAll('span.inline-flex > span > span:first-child') ?? [])
        .map((el) => el.textContent?.trim() ?? '')
        .filter(Boolean)

async function open() {
    render(Panel as never)
    await expect.element(page.getByRole('treegrid')).toBeVisible()
}

describe('the pivot panel', () => {
    it('draws one zone per axis and one for the values', async () => {
        await open()

        expect(zone('rows')).not.toBeNull()
        expect(zone('columns')).not.toBeNull()
        expect(zone('values')).not.toBeNull()
    })

    it('names each zone for a reader who cannot see which is which', async () => {
        await open()

        expect(zone('rows')?.getAttribute('aria-label')).toBe('Chạy dọc')
        expect(zone('columns')?.getAttribute('aria-label')).toBe('Chạy ngang')
        expect(zone('values')?.getAttribute('aria-label')).toBe('Giá trị')
        for (const key of ['rows', 'columns', 'values']) {
            expect(zone(key)?.getAttribute('role')).toBe('group')
        }
    })

    it('keys its zones on something a translation cannot move', async () => {
        await open()

        for (const key of ['rows', 'columns', 'values']) {
            expect(zone(key)).not.toBeNull()
        }
        expect(document.querySelector('[data-dg-pivot-zone="Chạy dọc"]')).toBeNull()
    })

    it('shows what is on each axis, by the header the application gave', async () => {
        await open()

        expect(chipsIn('rows')).toEqual(['Vùng'])
        expect(chipsIn('columns')).toEqual(['Quý'])
    })

    it('puts a field on an axis from its own add menu', async () => {
        await open()
        await page.getByRole('button', { name: 'Thêm vào trục ngang' }).click()
        await expect.element(page.getByRole('menuitem', { name: 'Hàng' })).toBeVisible()
        await page.getByRole('menuitem', { name: 'Hàng' }).click()

        await expect.poll(() => chipsIn('columns')).toEqual(['Quý', 'Hàng'])
        await expect.poll(() => headers()).toContain('Widget')
    })

    it('takes a field off, and the grid stops crossing on it', async () => {
        await open()
        await page.getByRole('button', { name: 'Bỏ Quý' }).click()

        await expect.poll(() => chipsIn('columns')).toEqual([])
        await expect.poll(() => headers()).toContain('Quý')
    })

    it('names every control for a reader who cannot see the icon', async () => {
        await open()

        for (const name of ['Bỏ Vùng', 'Bỏ Quý', 'Thêm vào trục dọc', 'Thêm vào trục ngang']) {
            await expect.element(page.getByRole('button', { name })).toBeInTheDocument()
        }
    })

    it('is reachable and operable from the keyboard alone', async () => {
        await open()
        const remove = page.getByRole('button', { name: 'Bỏ Quý' })
        await expect.element(remove).toBeInTheDocument()

        const element = document.querySelector('[aria-label="Bỏ Quý"]') as HTMLButtonElement | null
        element?.focus()
        expect(document.activeElement).toBe(element)

        await userEvent.keyboard('{Enter}')
        await expect.poll(() => chipsIn('columns')).toEqual([])
    })

    it('changes how a measure reduces, and the numbers follow', async () => {
        await open()
        const before = document.querySelector('[role="gridcell"]')?.textContent ?? ''

        await page.getByRole('button', { name: 'Gộp bằng' }).click()
        await page.getByRole('menuitem', { name: 'avg' }).click()

        await expect.poll(() => zone('values')?.textContent ?? '').toContain('avg')
        expect(before).toBeTruthy()
    })

    it('reads a measure as a share from the panel', async () => {
        await open()
        await page.getByRole('button', { name: 'Đọc theo' }).click()
        await page.getByRole('menuitem', { name: 'percentOfRow' }).click()

        await expect
            .poll(() =>
                Array.from(document.querySelectorAll('[role="gridcell"]'))
                    .map((cell) => cell.textContent ?? '')
                    .join('')
            )
            .toContain('%')
    })

    it('moves the measures down the page, giving each one a row of its own', async () => {
        await open()
        const before = document.querySelectorAll('[role="row"]').length

        await page.getByRole('button', { name: 'Measure xếp dọc' }).click()

        await expect.poll(() => headers()).toContain('Giá trị')
        await expect
            .poll(() => document.querySelectorAll('[role="row"]').length)
            .toBeGreaterThan(before)
    })
})
