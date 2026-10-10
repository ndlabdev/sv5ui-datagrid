import { type Component } from 'svelte'
import { describe, expect, it, vi } from 'vitest'
import { render } from 'vitest-browser-svelte'
import { page } from 'vitest/browser'
import {
    createDataGrid,
    DataGrid,
    pivot,
    serverRowModel,
    type ColumnDef,
    type DataGridProps,
    type GetRowsResult,
    type GridState
} from '$lib/index.js'

interface Sale {
    id: number
    region: string
    quarter: string
    amount: number
    pivot?: Record<string, unknown>
}

const Typed = DataGrid as unknown as Component<DataGridProps<Sale>>

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'quarter' },
    { id: 'amount', type: 'number' }
]

const crossing = {
    rows: ['region'],
    columns: ['quarter'],
    values: [{ field: 'amount' as const, agg: 'sum' as const }]
}

const counted = () =>
    Array.from(document.querySelectorAll('span'))
        .map((span) => span.textContent?.trim() ?? '')
        .find((text) => /rows$/.test(text)) ?? ''

async function show(grid: GridState<Sale>) {
    render(Typed, { grid, statusBar: true } as never)
    await expect.element(page.getByRole('treegrid')).toBeVisible()
}

describe('the count under a crossing the client made', () => {
    it('names the crossings and the rows they came from', async () => {
        const grid = createDataGrid<Sale>({
            columns,
            data: [
                { id: 1, region: 'North', quarter: 'Q1', amount: 10 },
                { id: 2, region: 'North', quarter: 'Q2', amount: 20 },
                { id: 3, region: 'South', quarter: 'Q1', amount: 30 }
            ],
            getRowId: (row) => String(row.id),
            features: [pivot<Sale>(crossing)]
        })

        await show(grid)

        expect(counted()).toBe('2 crossings from 3 rows')
    })
})

describe('the count under a crossing the server made', () => {
    it('claims no crossing count, the client never having gathered anything', async () => {
        const answer: GetRowsResult<Sale> = {
            rows: [
                { id: 1, region: 'North', quarter: '', amount: 0, pivot: { Q1: [180] } },
                { id: 2, region: 'South', quarter: '', amount: 0, pivot: { Q1: [200] } }
            ],
            pivotColumns: [['Q1']]
        }
        const getRows = vi.fn(async () => answer)
        const grid = createDataGrid<Sale>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [pivot<Sale>(crossing), serverRowModel<Sale>({ getRows }, { mode: 'paged' })]
        })

        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await vi.waitFor(() => expect(getRows.mock.calls.length).toBeGreaterThan(0))
        await show(grid)

        await expect.poll(counted).not.toMatch(/crossings/)
        await expect.poll(counted).toMatch(/^\d+ rows$/)
    })
})

describe('the count under a crossing the grid refused to draw', () => {
    const wide: Sale[] = Array.from({ length: 12 }, (_, at) => ({
        id: at + 1,
        region: at % 2 === 0 ? 'North' : 'South',
        quarter: `Q${at}`,
        amount: at
    }))

    it('says plain rows when the column axis went past the ceiling', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = createDataGrid<Sale>({
            columns,
            data: wide,
            getRowId: (row) => String(row.id),
            features: [pivot<Sale>({ ...crossing, maxColumns: 6 })]
        })

        await show(grid)

        expect(counted()).toBe('12 rows')
        warn.mockRestore()
    })

    it('says plain rows when an axis field names no column', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = createDataGrid<Sale>({
            columns,
            data: wide,
            getRowId: (row) => String(row.id),
            features: [pivot<Sale>({ ...crossing, columns: ['nowhere'] })]
        })

        await show(grid)

        expect(counted()).toBe('12 rows')
        warn.mockRestore()
    })

    it('says plain rows on a server grid with no server row model to cross it', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = createDataGrid<Sale>({
            columns,
            data: wide,
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [pivot<Sale>(crossing)]
        })

        await show(grid)

        expect(counted()).toBe('12 rows')
        warn.mockRestore()
    })
})
