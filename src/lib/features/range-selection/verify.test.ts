import { createDataGrid, type GridState } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { editing } from '../../features/editing/index.js'
import { sorting } from '../../features/sorting/index.js'
import { virtualization } from '../../features/virtualization/index.js'
import { describe, expect, it } from 'vitest'
import { grouping } from '../grouping/index.js'
import { masterDetail } from '../master-detail/index.js'
import { serverRowModel } from '../server-row-model/index.js'
import { tree } from '../tree/index.js'
import { getRangeSelection, rangeSelection } from './range-selection.svelte.js'

interface Row {
    id: number
    parentId: number | null
    dept: string
    n: number
}

const columns: ColumnDef<Row>[] = [
    { id: 'dept', header: 'Dept' },
    { id: 'n', header: 'N', editable: true, parse: Number }
]

function rows(): Row[] {
    return [
        { id: 1, parentId: null, dept: 'Core', n: 1 },
        { id: 2, parentId: 1, dept: 'Core', n: 2 },
        { id: 3, parentId: null, dept: 'Data', n: 100 },
        { id: 4, parentId: 3, dept: 'Data', n: 200 }
    ]
}

function fillDown(grid: GridState<Row>, from: number, to: number, at: number) {
    const state = getRangeSelection(grid)!
    state.startRange(from, 1)
    state.extendTo(to, 1)
    state.endRange()
    state.startFill()
    state.extendFill(at, 1)
    state.endFill()
    return grid.data.map((row) => row.n)
}

describe('I1 verified across every synthetic row shape', () => {
    it('group headers', () => {
        const grid = createDataGrid<Row>({
            columns,
            data: rows(),
            getRowId: (row) => String(row.id),
            features: [sorting(), editing(), grouping<Row>({ by: ['dept'] }), rangeSelection()]
        })

        expect(fillDown(grid, 1, 2, 5)).toEqual([1, 2, 3, 4])
    })

    it('group footers and the grand total', () => {
        const grid = createDataGrid<Row>({
            columns,
            data: rows(),
            getRowId: (row) => String(row.id),
            features: [
                sorting(),
                editing(),
                grouping<Row>({
                    by: ['dept'],
                    aggregations: { n: 'sum' },
                    groupFooters: true,
                    grandTotal: true
                }),
                rangeSelection()
            ]
        })
        const ids = grid.preWindowNodes.map((node) => node.id)

        expect(ids.filter((id) => grid.nodeById(id) === undefined)).toHaveLength(5)
        expect(fillDown(grid, 1, 2, ids.length - 1)).toEqual([1, 2, 3, 4])
    })

    it('master-detail panels', () => {
        const grid = createDataGrid<Row>({
            columns,
            data: rows(),
            getRowId: (row) => String(row.id),
            features: [sorting(), editing(), masterDetail<Row>(), rangeSelection()]
        })
        ;(grid.api.toggleDetail as (id: string) => void)('2')
        const detail = grid.preWindowNodes.filter((node) => node.meta?.fullWidth)
        expect(detail).toHaveLength(1)

        expect(fillDown(grid, 0, 1, 4)).toEqual([1, 2, 3, 4])
    })

    it('tree rows stay fillable, because they are data', () => {
        const grid = createDataGrid<Row>({
            columns,
            data: rows(),
            getRowId: (row) => String(row.id),
            features: [
                sorting(),
                editing(),
                tree<Row>({
                    getParentId: (row) => (row.parentId ? String(row.parentId) : null),
                    defaultExpandedDepth: 1
                }),
                rangeSelection()
            ]
        })
        expect(grid.preWindowNodes).toHaveLength(4)
        expect(fillDown(grid, 0, 1, 3)).toEqual([1, 2, 3, 4])
    })

    it('server placeholder rows', async () => {
        const grid = createDataGrid<Row>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                virtualization(),
                editing(),
                serverRowModel<Row>(
                    {
                        getRows: async ({ startRow, endRow }) => ({
                            rows: rows().slice(startRow, Math.min(endRow, 4)),
                            rowCount: 8
                        })
                    },
                    {
                        mode: 'infinite',
                        blockSize: 4,
                        placeholder: (index) => ({
                            id: -index - 1,
                            parentId: null,
                            dept: '',
                            n: 0
                        })
                    }
                ),
                rangeSelection()
            ]
        })
        const model = grid.feature<{ refresh: () => void }>('serverRowModel')!
        model.refresh()
        await expect.poll(() => grid.data.length).toBe(8)

        const state = getRangeSelection(grid)!
        state.startRange(0, 1)
        state.extendTo(1, 1)
        state.endRange()
        state.startFill()
        state.extendFill(7, 1)
        state.endFill()

        expect(grid.data.slice(0, 4).map((row) => row.n)).toEqual([1, 2, 3, 4])

        expect(grid.data.slice(4).map((row) => row.n)).toEqual([0, 0, 0, 0])
    })
})

describe('cut and move on a server row model', () => {
    async function serverGrid() {
        const grid = createDataGrid<Row>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                virtualization(),
                editing(),
                serverRowModel<Row>(
                    {
                        getRows: async ({ startRow, endRow }) => ({
                            rows: rows().slice(startRow, Math.min(endRow, 4)),
                            rowCount: 8
                        })
                    },
                    {
                        mode: 'infinite',
                        blockSize: 4,
                        placeholder: (index) => ({ id: -index - 1, parentId: null, dept: '', n: 0 })
                    }
                ),
                rangeSelection()
            ]
        })
        const model = grid.feature<{ refresh: () => void }>('serverRowModel')!
        model.refresh()
        await expect.poll(() => grid.data.length).toBe(8)
        return grid
    }

    it('copies a blank for a row the server has not sent, not the placeholder value', async () => {
        const grid = await serverGrid()
        const state = getRangeSelection(grid)!
        state.startRange(2, 1)
        state.extendTo(5, 1)
        state.endRange()

        expect(state.getRangeTsv()).toBe('100\n200\n\n')
    })

    it('refuses to move onto rows that are still loading', async () => {
        const grid = await serverGrid()
        const state = getRangeSelection(grid)!
        state.cutSource = { top: 0, left: 1, bottom: 1, right: 1 }

        expect(state.moveRange(4, 1)).toBe(false)
        expect(grid.data.slice(0, 2).map((row) => row.n)).toEqual([1, 2])
    })

    it('refuses to move a placeholder onto a real row, rather than writing its zeros there', async () => {
        const grid = await serverGrid()
        const state = getRangeSelection(grid)!
        state.cutSource = { top: 4, left: 1, bottom: 5, right: 1 }

        expect(state.moveRange(0, 1)).toBe(false)
        expect(grid.data.slice(0, 2).map((row) => row.n)).toEqual([1, 2])
    })
})

describe('a cut that outlives the rows it was taken from', () => {
    it('refuses the move once the rows under it are different rows', () => {
        const grid = createDataGrid<Row>({
            columns,
            data: rows(),
            getRowId: (row) => String(row.id),
            features: [sorting(), editing(), rangeSelection()]
        })
        const state = getRangeSelection(grid)!
        state.startRange(0, 1)
        state.endRange()
        state.cutRange()
        expect(state.cutSource).not.toBeNull()

        const setSort = grid.api.setSort as (
            state: { columnId: string; direction: 'desc' }[]
        ) => void
        setSort([{ columnId: 'n', direction: 'desc' }])

        expect(state.moveRange(3, 1)).toBe(false)
        expect(state.cutSource).toBeNull()
        expect(grid.data.map((row) => row.n)).toEqual([1, 2, 100, 200])
    })
})
