import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    getSelection,
    pagination,
    selection,
    type ColumnDef
} from '$lib/index.js'

interface Row {
    id: number
    name: string
}

const rows: Row[] = Array.from({ length: 60 }, (_, i) => ({ id: i + 1, name: `Row ${i + 1}` }))
const columns: ColumnDef<Row>[] = [{ id: 'name' }]

function grid(pageSize: number) {
    return createDataGrid<Row>({
        columns,
        data: rows,
        getRowId: (row) => String(row.id),
        features: [pagination({ pageSize })]
    })
}

function sizeTrigger(): HTMLElement {
    const trigger = document.querySelector<HTMLElement>('[aria-label="Rows per page"]')
    if (!trigger) throw new Error('no page-size select')
    return trigger
}

describe('page-size select', () => {
    it('labels a page size that is one of the offered choices', async () => {
        render(DataGrid as never, { grid: grid(25) } as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        expect(sizeTrigger().textContent).toContain('25')
    })

    it('labels a page size that is not in the offered list', async () => {
        // A grid created with pageSize 12 must not render a blank select just
        // because 12 is missing from the default [10, 25, 50, 100].
        render(DataGrid as never, { grid: grid(12) } as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        expect(sizeTrigger().textContent).toContain('12')
    })
})

describe('footer layout', () => {
    it('stacks on narrow viewports and spreads on wide ones', async () => {
        render(DataGrid as never, { grid: grid(12) } as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        const footer = document
            .querySelector<HTMLElement>('[aria-label="Rows per page"]')!
            .closest('.flex-col')
        // The column-by-default, row-at-`sm` shape is what keeps the controls
        // off a single crowded line on a phone.
        expect(footer?.className).toContain('flex-col')
        expect(footer?.className).toContain('sm:flex-row')
    })

    it('constrains the page-size select instead of letting it stretch', async () => {
        render(DataGrid as never, { grid: grid(12) } as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        // A select that fills the footer is what made it look broken. The
        // trigger still fills its root, but the root is now a fixed width.
        const root = sizeTrigger().closest('.w-32')
        expect(root).not.toBeNull()
        expect(root!.getBoundingClientRect().width).toBeLessThan(200)
    })

    it('states the row range once, not the page number twice', async () => {
        render(DataGrid as never, { grid: grid(12) } as never)
        await expect.element(page.getByText('1–12 of 60')).toBeVisible()
        // The range lives in the pagination footer; the status bar must not
        // repeat it as "page 1 of 5".
        expect(document.body.textContent).not.toMatch(/page \d+ of \d+/)
    })
})

describe('status bar', () => {
    it('shows the selection count when rows are selected', async () => {
        const g = createDataGrid<Row>({
            columns,
            data: rows,
            getRowId: (row) => String(row.id),
            features: [selection(), pagination({ pageSize: 12 })]
        })
        render(DataGrid as never, { grid: g } as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        getSelection(g)!.select('1')
        getSelection(g)!.select('2')
        await expect.element(page.getByText('2 selected')).toBeVisible()
    })
})
