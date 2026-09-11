import { createDataGrid, type GridState } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { filtering } from '../../features/filtering/index.js'
import { sorting } from '../../features/sorting/index.js'
import { virtualization } from '../../features/virtualization/index.js'
import { describe, expect, it, vi } from 'vitest'
import { formula } from '../formula/index.js'
import { getServerRowModel, serverRowModel } from '../server-row-model/index.js'
import { workerDataSource } from './worker-row-model.js'

interface Line {
    id: number
    unit: number
    qty: number
    total?: number
}

const lines: Line[] = Array.from({ length: 40 }, (_, i) => ({
    id: i + 1,
    unit: (i % 8) * 100,
    qty: (i % 5) + 1
}))

const columns: ColumnDef<Line>[] = [
    { id: 'unit', header: 'Unit', filter: 'number' },
    { id: 'qty', header: 'Qty', filter: 'number' },
    { id: 'total', header: 'Total', filter: 'number' }
]

function grid(supplyComputed = true): GridState<Line> {
    const source = workerDataSource<Line>(lines, {
        columns,
        inline: true,
        readValue: supplyComputed
            ? (row, column) => (column.id === 'total' ? row.unit * row.qty : undefined)
            : undefined
    })
    const built = createDataGrid<Line>({
        columns,
        data: [],
        rowModel: 'server',
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            filtering(),
            formula<Line>({ columns: { total: 'unit * qty' } }),
            virtualization({ rowHeight: 40 }),
            serverRowModel<Line>(source, {
                mode: 'infinite',
                blockSize: 20,
                placeholder: (index) => ({ id: -(index + 1) }) as Line
            })
        ]
    })
    getServerRowModel(built)!.start()
    return built
}

describe('a formula column on a worker row model', () => {
    it('filters by the computed value rather than ignoring the condition', async () => {
        const built = grid()
        await vi.waitFor(() => expect(built.data.length).toBeGreaterThan(0))

        built.api.setColumnFilter!('total', { kind: 'number', op: 'gt', value: 1000 })

        const model = getServerRowModel(built)!
        const expected = lines.filter((line) => line.unit * line.qty > 1000).length
        await vi.waitFor(() => expect(model.rowCount).toBe(expected))
    })

    it('says so when nobody gave it the computed value', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const built = grid(false)
        await vi.waitFor(() => expect(built.data.length).toBeGreaterThan(0))

        built.api.setColumnFilter!('total', { kind: 'number', op: 'gt', value: 1000 })
        await vi.waitFor(() => expect(warn).toHaveBeenCalled())
        expect(String(warn.mock.calls[0]?.[0])).toContain('readValue')
        warn.mockRestore()
    })

    it('sorts by the computed value', async () => {
        const built = grid()
        await vi.waitFor(() => expect(built.data.length).toBeGreaterThan(0))

        built.api.setSort!([{ columnId: 'total', direction: 'desc' }])
        const best = Math.max(...lines.map((line) => line.unit * line.qty))

        await vi.waitFor(() =>
            expect(built.data[0] && built.data[0].unit * built.data[0].qty).toBe(best)
        )
    })
})

describe('a saved view restored onto a worker row model', () => {
    it('refetches so the grid shows what the view described', async () => {
        const source = workerDataSource<Line>(lines, { columns, inline: true })
        const built = createDataGrid<Line>({
            columns,
            data: [],
            rowModel: 'server',
            getRowId: (row) => String(row.id),
            features: [
                sorting(),
                filtering(),
                virtualization({ rowHeight: 40 }),
                serverRowModel<Line>(source, {
                    mode: 'infinite',
                    blockSize: 20,
                    placeholder: (index) => ({ id: -(index + 1) }) as Line
                })
            ]
        })
        const model = getServerRowModel(built)!
        model.start()
        await vi.waitFor(() => expect(model.rowCount).toBe(lines.length))

        const snapshot = built.getState()
        built.setState({
            ...snapshot,
            features: {
                ...snapshot.features,
                filtering: { quick: '', columns: { qty: { kind: 'number', op: 'eq', value: 3 } } }
            }
        })

        const expected = lines.filter((line) => line.qty === 3).length
        await vi.waitFor(() => expect(model.rowCount).toBe(expected))
    })
})
