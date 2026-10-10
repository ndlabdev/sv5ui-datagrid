import { describe, expect, it, vi } from 'vitest'
import { createDataGrid, type ColumnDef, type GridState } from '$lib/index.js'
import { getPivot, isPivotColumn, pivot, type PivotOptions } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    outer: string
    inner: string
    amount: number
}

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'outer' },
    { id: 'inner' },
    { id: 'amount', type: 'number' }
]

function build(rows: Sale[], options: Partial<PivotOptions<Sale>> = {}): GridState<Sale> {
    return createDataGrid<Sale>({
        columns,
        data: rows,
        getRowId: (row) => String(row.id),
        features: [
            pivot<Sale>({
                rows: ['region'],
                columns: ['outer', 'inner'],
                values: [{ field: 'amount', agg: 'sum' }],
                ...options
            })
        ]
    })
}

const bodyColumns = (grid: GridState<Sale>): string[] =>
    grid.columns.visible.filter((column) => isPivotColumn(column.id)).map((column) => column.id)

describe('a key holding the separator the paths are joined with', () => {
    const split: Sale[] = [
        { id: 1, region: 'North', outer: 'a|b', inner: 'c', amount: 10 },
        { id: 2, region: 'North', outer: 'a', inner: 'b|c', amount: 500 }
    ]

    it('escapes it, so the two paths cannot encode to the same column id', () => {
        const ids = bodyColumns(build(split))

        expect(ids.toSorted()).toEqual(['__pv:c:a\\|b|c::0', '__pv:c:a|b\\|c::0'])
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('measures each crossing from its own rows, not from both', () => {
        const grid = build(split)
        const state = getPivot(grid)!
        const row = grid.preWindowNodes.find((node) => node.meta?.level === 0)!

        const measured = bodyColumns(grid).map((id) =>
            Number(grid.getValue(row, grid.columns.get(id)!))
        )

        expect(measured.toSorted((a, b) => a - b)).toEqual([10, 500])
        expect(state.rowsBehind(row, bodyColumns(grid)[0]!)).toHaveLength(1)
    })

    it('keeps a backslash from forging the escape of the next key', () => {
        const forged: Sale[] = [
            { id: 1, region: 'North', outer: 'a\\', inner: 'b', amount: 10 },
            { id: 2, region: 'North', outer: 'a\\|b', inner: 'c', amount: 500 }
        ]
        const ids = bodyColumns(build(forged))

        expect(new Set(ids).size).toBe(ids.length)
        expect(ids).toHaveLength(2)
    })
})

describe('the ceiling on generated columns, left unsaid', () => {
    const many = (count: number): Sale[] =>
        Array.from({ length: count }, (_, index) => ({
            id: index + 1,
            region: 'North',
            outer: `k${index}`,
            inner: 'only',
            amount: index
        }))

    it('is a hundred, which a crossing may land exactly on', () => {
        const grid = build(many(100), { columns: ['outer'] })

        expect(grid.api.pivotMaxColumns!()).toBe(100)
        expect(bodyColumns(grid)).toHaveLength(100)
    })

    it('refuses the crossing one column past it, saying so once', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = build(many(101), { columns: ['outer'] })

        expect(bodyColumns(grid)).toEqual([])
        expect(grid.columns.visible.map((column) => column.id)).toEqual([
            'region',
            'outer',
            'inner',
            'amount'
        ])
        expect(
            warn.mock.calls.filter((call) => String(call[0]).includes('more than 100'))
        ).toHaveLength(1)
        warn.mockRestore()
    })

    it('draws that same crossing once the reader raises the ceiling', () => {
        const grid = build(many(101), { columns: ['outer'] })
        grid.api.setPivotMaxColumns!(101)

        expect(bodyColumns(grid)).toHaveLength(101)
    })
})
