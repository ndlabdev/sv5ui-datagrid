import type { Component } from 'svelte'
import { describe, expect, it } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    formatCurrency,
    formatDate,
    formatNumber,
    formatPercent,
    isBlank,
    toDate,
    toNumber,
    type ColumnDef,
    type DataGridProps
} from '$lib/index.js'
import Renderers from '../routes/renderers/+page.svelte'

interface Row {
    id: number
    amount: number | null
}

const TypedDataGrid = DataGrid as unknown as Component<DataGridProps<Row>>

describe('formatting from a cell snippet', () => {
    it('formats a custom cell exactly as the column type would', async () => {
        const rows: Row[] = [{ id: 1, amount: 1234.5 }]
        const columns: ColumnDef<Row>[] = [
            {
                id: 'byType',
                header: 'By type',
                accessor: (row) => row.amount,
                type: 'currency',
                typeOptions: { currency: 'EUR', locale: 'de-DE' },
                width: 160
            },
            {
                id: 'bySnippet',
                header: 'By snippet',
                accessor: (row) => row.amount,
                width: 160
            }
        ]
        const grid = createDataGrid<Row>({
            columns,
            data: rows,
            getRowId: (row) => String(row.id)
        })
        const screen = await render(TypedDataGrid, { grid })
        await expect.element(screen.getByRole('grid')).toBeVisible()

        const rendered = screen.container.querySelector('[data-dg-cell="0:0"]')!.textContent?.trim()
        expect(formatCurrency(1234.5, { currency: 'EUR', locale: 'de-DE' })).toBe(rendered)
    })

    it('renders the demo cell that formats through the public helper', async () => {
        render(Renderers as never)
        await expect.element(page.getByRole('grid').first()).toBeVisible()
        const cell = document.querySelector('[data-testid="budget-cell"]')
        expect(cell?.textContent?.trim()).toMatch(/^\$[\d,]+/)
    })

    it('keeps blank meaning one thing across the helpers', () => {
        for (const blank of [null, undefined, '']) {
            expect(isBlank(blank)).toBe(true)
            expect(formatNumber(blank)).toBe('')
            expect(formatCurrency(blank)).toBe('')
            expect(formatPercent(blank)).toBe('')
            expect(formatDate(blank)).toBe('')
        }
        expect(isBlank(0)).toBe(false)
        expect(toNumber('42')).toBe(42)
        expect(toNumber('nope')).toBeNull()
        expect(toDate('2026-08-11')?.getUTCFullYear()).toBe(2026)
        expect(toDate('nope')).toBeNull()
    })
})
