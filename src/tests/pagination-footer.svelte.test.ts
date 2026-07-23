import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import { createDataGrid, DataGrid, pagination, type ColumnDef } from '$lib/index.js'

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
})
