import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    getPagination,
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
        expect(footer?.className).toContain('flex-col')
        expect(footer?.className).toContain('sm:flex-row')
    })

    it('constrains the page-size select instead of letting it stretch', async () => {
        render(DataGrid as never, { grid: grid(12) } as never)
        await expect.element(page.getByRole('grid')).toBeVisible()
        const root = sizeTrigger().closest('.w-32')
        expect(root).not.toBeNull()
        expect(root!.getBoundingClientRect().width).toBeLessThan(200)
    })

    it('states the row range once, not the page number twice', async () => {
        render(DataGrid as never, { grid: grid(12) } as never)
        await expect.element(page.getByText('1-12 of 60')).toBeVisible()
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

describe('a page number wider than the button it sits in', () => {
    function millionRows() {
        return createDataGrid<Row>({
            columns,
            data: rows,
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [pagination({ pageSize: 50, rowCount: 1_000_000 })]
        })
    }

    function pageButtons(): HTMLElement[] {
        return [...document.querySelectorAll<HTMLElement>('[data-pagination-page]')]
    }

    it('draws five digits without spilling them out of the button', async () => {
        const g = millionRows()
        getPagination(g)!.setPage(20_000)
        render(DataGrid as never, { grid: g } as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        const spilling = pageButtons()
            .filter((button) => button.scrollWidth > button.clientWidth)
            .map((button) => `${button.textContent?.trim()} needs ${button.scrollWidth}`)
        expect(spilling).toEqual([])
    })

    it('keeps a gap, so two page numbers never read as one', async () => {
        const g = millionRows()
        getPagination(g)!.setPage(20_000)
        render(DataGrid as never, { grid: g } as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        const boxes = pageButtons().map((button) => button.getBoundingClientRect())
        const touching: string[] = []
        for (let i = 1; i < boxes.length; i++) {
            if (boxes[i]!.left - boxes[i - 1]!.right < 2) touching.push(`${i - 1} and ${i}`)
        }
        expect(touching).toEqual([])
    })

    it('leaves a one digit page square, so the ordinary footer is unchanged', async () => {
        render(DataGrid as never, { grid: grid(12) } as never)
        await expect.element(page.getByRole('grid')).toBeVisible()

        const first = pageButtons()[0]!
        const box = first.getBoundingClientRect()
        expect(first.textContent?.trim()).toBe('1')
        expect(Math.round(box.width)).toBe(Math.round(box.height))
    })
})
