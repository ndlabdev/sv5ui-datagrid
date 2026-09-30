import { describe, expect, it } from 'vitest'
import { createDataGrid, grouping, sorting, type ColumnDef, type GridState } from '$lib/index.js'
import { pivot, type PivotOptions } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    product: string
    quarter: string
    amount: number
}

const sales: Sale[] = [
    { id: 1, region: 'North', product: 'Widget', quarter: 'Q1', amount: 100 },
    { id: 2, region: 'North', product: 'Gadget', quarter: 'Q1', amount: 80 },
    { id: 3, region: 'North', product: 'Widget', quarter: 'Q2', amount: 150 },
    { id: 4, region: 'South', product: 'Widget', quarter: 'Q1', amount: 300 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'product' },
    { id: 'quarter' },
    { id: 'amount', type: 'number' }
]

const build = (options: Partial<PivotOptions<Sale>> = {}, extra: unknown[] = []) =>
    createDataGrid<Sale>({
        data: sales,
        columns,
        getRowId: (sale) => String(sale.id),
        features: [
            ...(extra as never[]),
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }],
                ...options
            })
        ]
    })

const openEverything = (grid: GridState<Sale>) => {
    grid.expansion.setExpanded(grid.preWindowNodes.map((node) => node.id))
}

const shape = (grid: GridState<Sale>) =>
    grid.preWindowNodes.map((node) => `${node.meta?.level}:${node.id.split('=').pop()}`)

describe('a gathered row does not open onto the rows it gathered', () => {
    it('carries no toggle when its level is the innermost one', () => {
        const grid = build()

        expect(grid.preWindowNodes).toHaveLength(2)
        expect(grid.preWindowNodes.map((node) => node.meta?.expandable)).toEqual([false, false])
    })

    it('stays put even when something asks for it to be opened', () => {
        const grid = build()
        const before = shape(grid)

        openEverything(grid)

        expect(shape(grid)).toEqual(before)
    })

    it('opens onto the next row field when there is one, and stops there', () => {
        const grid = build({ rows: ['region', 'product'] })

        expect(grid.preWindowNodes.map((node) => node.meta?.expandable)).toEqual([true, true])

        openEverything(grid)
        const opened = grid.preWindowNodes

        expect(opened.map((node) => node.meta?.level)).toEqual([0, 1, 1, 0, 1])
        expect(
            opened.filter((node) => node.meta?.level === 1).every((node) => !node.meta?.expandable)
        ).toBe(true)
    })

    it('never lets a source row through, whatever is opened', () => {
        const grid = build({ rows: ['region', 'product'] })
        openEverything(grid)
        openEverything(grid)

        expect(grid.preWindowNodes.every((node) => node.id.startsWith('group:'))).toBe(true)
    })

    it('still sorts the groups by a crossing, though none of them opens', () => {
        const grid = build({ sortableColumns: true }, [sorting()])

        grid.api.setSort?.([{ columnId: '__pv:c:Q1::0', direction: 'asc' }])
        expect(shape(grid)).toEqual(['0:North', '0:South'])

        grid.api.setSort?.([{ columnId: '__pv:c:Q1::0', direction: 'desc' }])
        expect(shape(grid)).toEqual(['0:South', '0:North'])
    })
})

describe('grouping keeps opening onto its rows', () => {
    it('leaves the innermost group of grouping() able to show the rows themselves', () => {
        const grid = createDataGrid<Sale>({
            data: sales,
            columns,
            getRowId: (sale) => String(sale.id),
            features: [grouping<Sale>({ by: ['region'], aggregations: { amount: 'sum' } })]
        })

        expect(grid.preWindowNodes[0]!.meta?.expandable).toBe(true)

        grid.expansion.setExpanded(
            grid.preWindowNodes.filter((node) => node.meta?.expandable).map((node) => node.id)
        )

        expect(grid.preWindowNodes.some((node) => !node.id.startsWith('group:'))).toBe(true)
    })
})
