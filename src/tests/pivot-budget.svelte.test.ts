import { describe, expect, it } from 'vitest'
import { createDataGrid, type ColumnDef } from '$lib/index.js'
import { isPivotColumn, pivot, type PivotOptions } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    dept: string
    country: string
    bucket: string
    third: string
    amount: number
}

const DEPTS = ['Core', 'Platform', 'Growth', 'Data', 'Infra']
const COUNTRIES = ['VN', 'US', 'DE', 'JP']

function makeRows(count: number, keys: number): Sale[] {
    return Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        dept: DEPTS[index % 5]!,
        country: COUNTRIES[index % 4]!,
        bucket: `K${index % keys}`,
        third: `T${index % 3}`,
        amount: 40 + ((index * 37) % 260)
    }))
}

const columns: ColumnDef<Sale>[] = [
    { id: 'dept' },
    { id: 'country' },
    { id: 'bucket' },
    { id: 'third' },
    { id: 'amount', type: 'currency' }
]

function crossing(options: Partial<PivotOptions<Sale>>): PivotOptions<Sale> {
    return {
        rows: ['dept'],
        columns: ['bucket'],
        values: [{ field: 'amount', agg: 'sum' }],
        maxColumns: 2_000,
        ...options
    }
}

function measure(data: Sale[], options: Partial<PivotOptions<Sale>>) {
    let best = Number.POSITIVE_INFINITY
    let leaves = 0
    let rows = 0

    const cleanup = $effect.root(() => {
        const grid = createDataGrid<Sale>({
            columns,
            data,
            getRowId: (row) => String(row.id),
            features: [pivot<Sale>(crossing(options))]
        })

        for (let sample = 0; sample < 3; sample++) {
            grid.data = [...data]
            const start = performance.now()
            void grid.preWindowNodes.length
            void grid.columns.visible.length
            best = Math.min(best, performance.now() - start)
        }
        leaves = grid.columns.visible.filter((column) => isPivotColumn(column.id)).length
        rows = grid.preWindowNodes.length
    })
    cleanup()

    return { ms: best, leaves, rows }
}

const BUDGET_MS = 1_500

describe('crossing 100k rows stays inside its budget', () => {
    const rows100k = makeRows(100_000, 4)
    const wide100k = makeRows(100_000, 100)

    it('costs what the rows cost, not what the columns cost', () => {
        const narrow = measure(rows100k, {})
        const wide = measure(wide100k, {})

        expect(narrow.leaves).toBe(4)
        expect(wide.leaves).toBe(100)
        expect(wide.ms).toBeLessThan(BUDGET_MS)
        expect(wide.ms).toBeLessThan(narrow.ms * 3)
    })

    it('pays for measures down the page in rows rather than in columns', () => {
        const across = measure(wide100k, {
            values: [
                { field: 'amount', agg: 'sum' },
                { field: 'amount', agg: 'avg' },
                { field: 'amount', agg: 'max' }
            ]
        })
        const down = measure(wide100k, {
            valuesOn: 'rows',
            values: [
                { field: 'amount', agg: 'sum' },
                { field: 'amount', agg: 'avg' },
                { field: 'amount', agg: 'max' }
            ]
        })

        expect(across.leaves).toBe(300)
        expect(down.leaves).toBe(101)
        expect(down.rows).toBe(across.rows * 4)
        expect(down.ms).toBeLessThan(BUDGET_MS)
    })

    it('stays inside it nested, with two measures and both totals', () => {
        const heavy = measure(makeRows(100_000, 50), {
            rows: ['dept', 'country'],
            columns: ['bucket', 'third'],
            values: [
                { field: 'amount', agg: 'sum' },
                { field: 'amount', agg: 'avg' }
            ],
            totalColumn: 'Total',
            totalRow: 'All',
            columnSubtotal: (header) => `${header} total`
        })

        expect(heavy.leaves).toBeGreaterThan(300)
        expect(heavy.ms).toBeLessThan(2 * BUDGET_MS)
    })
})
