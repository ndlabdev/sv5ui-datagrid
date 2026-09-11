import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
import Editors from '../routes/editors/+page.svelte'
import Export from '../routes/export/+page.svelte'
import I18n from '../routes/i18n/+page.svelte'
import Qa from '../routes/qa/+page.svelte'

async function expectNoViolations(container: Element) {
    const results = await axe.run(container, {
        rules: { region: { enabled: false }, 'page-has-heading-one': { enabled: false } }
    })
    const summary = results.violations.flatMap((violation) =>
        violation.nodes.map((node) => `${violation.id}: ${node.html.slice(0, 120)}`)
    )
    for (const entry of summary) expect(entry).toBe('')
}

describe('QA demo', () => {
    it('renders every feature at once without axe violations', async () => {
        render(Qa as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        await expect
            .element(page.getByRole('columnheader', { name: 'Identity' }).first())
            .toBeVisible()
        expect(
            document.querySelectorAll('[role="separator"][aria-label^="Resize"]').length
        ).toBeGreaterThan(0)
        expect(document.querySelector('[aria-label="Resize # column"]')).toBeNull()

        await expectNoViolations(document.body)
    })

    it('drives the state panel from the grid', async () => {
        render(Qa as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        await page.getByRole('button', { name: 'Chọn hết' }).click()
        await expect.element(page.getByText(/Chọn: \d+ dòng/)).toBeVisible()
        await expect.poll(() => document.body.textContent).toContain('selectionChanged')
    })

    it('shows the empty, loading and error states on demand', async () => {
        render(Qa as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        await page.getByRole('switch', { name: 'Empty' }).click()
        await expect.element(page.getByText('No data')).toBeVisible()

        await page.getByRole('switch', { name: 'Error' }).click()
        await expect.element(page.getByText(/Không tải được/)).toBeVisible()
    })
})

describe('i18n demo', () => {
    it('reports the translation as complete and renders it', async () => {
        render(I18n as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        await expect
            .element(page.getByText(/vi-VN phủ đủ \d+ khoá - \d+ ngôn ngữ đóng sẵn\./))
            .toBeVisible()
        await expect.element(page.getByPlaceholder('Tìm kiếm...')).toBeVisible()
        await expect.element(page.getByText('1-8 trên 60')).toBeVisible()
        await expect
            .element(page.getByRole('checkbox', { name: 'Chọn tất cả các dòng' }))
            .toBeVisible()
    })

    it('translates the column menu and switches back to English', async () => {
        render(I18n as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        await page.getByRole('button', { name: 'Menu cột Khách hàng' }).click()
        await expect.element(page.getByRole('menuitem', { name: 'Ghim trái' })).toBeVisible()
        await userEvent.keyboard('{Escape}')

        await page.getByRole('button', { name: 'Ngôn ngữ' }).click()
        await page.getByRole('option', { name: 'English' }).click()
        await expect.element(page.getByPlaceholder('Search...')).toBeVisible()
        await expect.element(page.getByText('1-8 of 60')).toBeVisible()
    })

    it('reaches a language beyond the pair the demo started with', async () => {
        render(I18n as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        await page.getByRole('button', { name: 'Ngôn ngữ' }).click()
        await page.getByRole('option', { name: '日本語' }).click()

        await expect.element(page.getByPlaceholder('検索...')).toBeVisible()
        await expect.element(page.getByText('60件中 1-8件')).toBeVisible()
        await expect
            .poll(() => document.querySelector('[data-dg-cell="0:5"]')?.textContent)
            .toContain('2026/01/10')
    })
})

describe('CSV export demo', () => {
    it('quotes, escapes and neutralizes exactly what lands in the file', async () => {
        render(Export as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        const csv = () => document.querySelector('pre')?.textContent ?? ''
        await expect.poll(csv).toContain('Mã,Khách hàng')
        await expect.poll(csv).toContain('"Có, dấu phẩy"')
        await expect.poll(csv).toContain('""Bé""')
        await expect.poll(csv).toContain("'=SUM(A1:A9)")
        expect(csv()).toContain('\r\n')
    })

    it('follows the delimiter when deciding what to quote', async () => {
        render(Export as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        await page.getByRole('button', { name: 'Dấu phân cách' }).click()
        await page.getByRole('option', { name: 'Chấm phẩy  ;' }).click()

        const csv = () => document.querySelector('pre')?.textContent ?? ''
        await expect.poll(csv).toContain('"Có; dấu chấm phẩy"')
        expect(csv()).toContain('Có, dấu phẩy;')
    })

    it('can export a hidden column when it is named', async () => {
        render(Export as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        expect(page.getByRole('columnheader', { name: 'Ghi chú nội bộ' }).elements()).toHaveLength(
            0
        )

        await page.getByRole('button', { name: 'Cột xuất' }).click()
        await page.getByRole('option', { name: 'Kèm cột ẩn (Ghi chú nội bộ)' }).click()

        await expect.poll(() => document.querySelector('pre')?.textContent).toContain('chỉ nội bộ')
    })
})

describe('editors demo', () => {
    it('renders every built-in editor type alongside a custom one', async () => {
        render(Editors as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        const headers = [...document.querySelectorAll('[role="columnheader"]')].map((cell) =>
            cell.textContent?.trim()
        )
        for (const header of ['Title', 'Estimate', 'Priority', 'Assignee', 'Done', 'Due']) {
            expect(
                headers.some((text) => text?.startsWith(header)),
                header
            ).toBe(true)
        }
    })

    it('blocks a commit that fails the column schema and keeps the old value', async () => {
        render(Editors as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        const title = document.querySelector<HTMLElement>('[data-dg-cell="0:1"]')!
        const before = title.textContent?.trim()
        await userEvent.dblClick(title)
        await page.getByRole('textbox').first().fill('ab')
        await userEvent.keyboard('{Enter}')

        await expect.element(page.getByRole('alert')).toHaveTextContent('At least 3 characters')

        await userEvent.keyboard('{Escape}')
        await expect.poll(() => title.textContent?.trim()).toBe(before)
    })

    it('runs parse before validation, so a decimal is rounded rather than rejected', async () => {
        render(Editors as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        const estimate = document.querySelector<HTMLElement>('[data-dg-cell="0:2"]')!
        await userEvent.dblClick(estimate)
        await page.getByRole('spinbutton').first().fill('3.7')
        await userEvent.keyboard('{Enter}')

        await expect.poll(() => estimate.textContent?.trim()).toBe('4')
    })
})
