import axe from 'axe-core'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page, userEvent } from 'vitest/browser'
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

        // Two header levels, pinned columns on both edges, and the frozen id
        // column all live together here. `Identity` renders as two cells: the
        // pinned section and the scrolling one cannot share a group cell.
        await expect
            .element(page.getByRole('columnheader', { name: 'Identity' }).first())
            .toBeVisible()
        expect(
            document.querySelectorAll('[role="separator"][aria-label^="Resize"]').length
        ).toBeGreaterThan(0)
        // `resizable: false` on the id column means no handle for it.
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

        // The page compares its own object against `defaultLabels`, so a label
        // added to the library without a translation shows up here.
        await expect.element(page.getByText(/Bản dịch phủ đủ \d+ khoá\./)).toBeVisible()
        await expect.element(page.getByPlaceholder('Tìm kiếm...')).toBeVisible()
        await expect.element(page.getByText('1–8 trên 60')).toBeVisible()
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

        // sv5ui ToggleGroup renders its items as radios, not buttons.
        await page.getByRole('radio', { name: 'English' }).click()
        await expect.element(page.getByPlaceholder('Search...')).toBeVisible()
        // The footer belongs to the label set too, not to the Pagination
        // component's own wording.
        await expect.element(page.getByText('1–8 of 60')).toBeVisible()
    })
})

describe('CSV export demo', () => {
    it('quotes, escapes and neutralizes exactly what lands in the file', async () => {
        render(Export as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        const csv = () => document.querySelector('pre')?.textContent ?? ''
        await expect.poll(csv).toContain('Mã,Khách hàng')
        // A comma inside a value forces quoting under the default delimiter.
        await expect.poll(csv).toContain('"Có, dấu phẩy"')
        // A quote inside a value is doubled.
        await expect.poll(csv).toContain('""Bé""')
        // A formula-looking cell is prefixed so a spreadsheet keeps it as text.
        await expect.poll(csv).toContain("'=SUM(A1:A9)")
        // Rows end with CRLF.
        expect(csv()).toContain('\r\n')
    })

    it('follows the delimiter when deciding what to quote', async () => {
        render(Export as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        await page.getByRole('button', { name: 'Dấu phân cách' }).click()
        await page.getByRole('option', { name: 'Chấm phẩy  ;' }).click()

        const csv = () => document.querySelector('pre')?.textContent ?? ''
        // Now the semicolon is what needs quoting, and the comma does not.
        await expect.poll(csv).toContain('"Có; dấu chấm phẩy"')
        expect(csv()).toContain('Có, dấu phẩy;')
    })

    it('can export a hidden column when it is named', async () => {
        render(Export as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        // The column is hidden in the grid...
        expect(page.getByRole('columnheader', { name: 'Ghi chú nội bộ' }).elements()).toHaveLength(
            0
        )

        await page.getByRole('button', { name: 'Cột xuất' }).click()
        await page.getByRole('option', { name: 'Kèm cột ẩn (Ghi chú nội bộ)' }).click()

        // ...and still reaches the file.
        await expect.poll(() => document.querySelector('pre')?.textContent).toContain('chỉ nội bộ')
    })
})
