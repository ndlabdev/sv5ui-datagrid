import { describe, expect, it, vi } from 'vitest'
import {
    createDataGrid,
    getSelection,
    getShowValuesAs,
    selection,
    serverRowModel,
    showValuesAs,
    virtualization,
    type ColumnDef,
    type GridFeature,
    type GridState
} from '$lib/index.js'

interface Row {
    id: number
    amount: number
    other: number
}

const columns: ColumnDef<Row>[] = [{ id: 'amount' }, { id: 'other' }]

const TOTAL = 40
const table: Row[] = Array.from({ length: TOTAL }, (_, index) => ({
    id: index + 1,
    amount: 10,
    other: 30
}))

function serverGrid(extra: GridFeature<Row>[], block: number): GridState<Row> {
    return createDataGrid<Row>({
        columns,
        data: [],
        getRowId: (row) => String(row.id),
        rowModel: 'server',
        features: [
            virtualization(),
            serverRowModel<Row>(
                {
                    getRows: async ({ startRow, endRow }) => ({
                        rows: table.slice(startRow, endRow),
                        rowCount: TOTAL
                    })
                },
                {
                    mode: 'infinite',
                    blockSize: block,
                    placeholder: (index) => ({ id: -index - 1, amount: 0, other: 0 })
                }
            ),
            ...extra
        ]
    })
}

async function loaded(grid: GridState<Row>): Promise<GridState<Row>> {
    grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
    await expect.poll(() => grid.data.length).toBe(TOTAL)
    return grid
}

const amountOf = (grid: GridState<Row>, node = 0) =>
    grid.getValue(grid.preWindowNodes[node]!, grid.columns.all[0]!)

describe('a share of a total the client does not hold', () => {
    it('is left alone rather than measured against the loaded block', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = await loaded(
            serverGrid([showValuesAs<Row>({ columns: { amount: 'percentOfGrandTotal' } })], 10)
        )

        expect(amountOf(grid)).toBe(10)
        expect(getShowValuesAs(grid)!.skippedColumns).toEqual(['amount'])
        expect(warn).toHaveBeenCalledTimes(1)
        expect(String(warn.mock.calls[0]![0])).toContain('skippedColumns')
        warn.mockRestore()
    })

    it('reads the same whether ten rows or forty have arrived', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const ten = await loaded(
            serverGrid([showValuesAs<Row>({ columns: { amount: 'percentOfGrandTotal' } })], 10)
        )
        const forty = await loaded(
            serverGrid([showValuesAs<Row>({ columns: { amount: 'percentOfGrandTotal' } })], 40)
        )
        expect(amountOf(ten)).toBe(amountOf(forty))
        vi.restoreAllMocks()
    })

    it('still divides across a row, which needs nothing the client lacks', async () => {
        vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = await loaded(
            serverGrid(
                [
                    showValuesAs<Row>({
                        columns: { amount: { kind: 'percentOfRow', of: ['amount', 'other'] } }
                    })
                ],
                10
            )
        )
        expect(amountOf(grid)).toBeCloseTo(10 / 40)
        expect(getShowValuesAs(grid)!.skippedColumns).toEqual([])
        vi.restoreAllMocks()
    })
})

describe('select all on a grid still loading', () => {
    it('selects the rows that arrived and none of the placeholders', async () => {
        const grid = await loaded(serverGrid([selection<Row>()], 10))
        const state = getSelection(grid)!

        state.selectAll()

        expect(state.count).toBe(10)
        expect(state.getSelectedRows().every((row) => row.id > 0)).toBe(true)
        expect(state.allState).toBe('all')
    })
})
