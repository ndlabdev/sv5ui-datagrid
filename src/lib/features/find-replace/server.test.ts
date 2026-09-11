import { createDataGrid, type GridState } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { editing } from '../../features/editing/index.js'
import { pagination } from '../../features/pagination/index.js'
import { virtualization } from '../../features/virtualization/index.js'
import { describe, expect, it } from 'vitest'
import { serverRowModel } from '../server-row-model/index.js'
import { findReplace, getFindReplace } from './find-replace.svelte.js'
import type { FindReplaceOptions } from './find-replace.types.js'

interface Row {
    id: number
    name: string
}

const columns: ColumnDef<Row>[] = [{ id: 'name', header: 'Name', editable: true }]
const TOTAL = 100

const source = {
    getRows: async ({ startRow, endRow }: { startRow: number; endRow: number }) => ({
        rows: Array.from({ length: Math.min(endRow, TOTAL) - startRow }, (_, k) => ({
            id: startRow + k + 1,
            name: `Anna ${startRow + k + 1}`
        })),
        rowCount: TOTAL
    })
}

function pagedGrid(options: FindReplaceOptions = {}): GridState<Row> {
    return createDataGrid<Row>({
        columns,
        data: [],
        getRowId: (row) => String(row.id),
        rowModel: 'server',
        features: [
            editing(),
            pagination<Row>({ pageSize: 10 }),
            serverRowModel<Row>(source, { mode: 'paged' }),
            findReplace(options)
        ]
    })
}

async function loaded(grid: GridState<Row>, rows: number) {
    grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
    await expect.poll(() => grid.data.length).toBe(rows)
    return getFindReplace(grid)!
}

describe('find over rows the server owns', () => {
    it('sees the page it has, not the hundred the server has', async () => {
        const grid = pagedGrid()
        const state = await loaded(grid, 10)
        state.show()
        state.query = 'Anna'

        expect(state.total).toBe(10)

        expect(state.partial).toBe(true)
    })

    it('sees only the blocks an infinite scroll has pulled', async () => {
        const grid = createDataGrid<Row>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                editing(),
                virtualization(),
                serverRowModel<Row>(source, {
                    mode: 'infinite',
                    blockSize: 10,
                    placeholder: (index) => ({ id: -index - 1, name: '' })
                }),
                findReplace()
            ]
        })
        const state = await loaded(grid, TOTAL)
        state.show()
        state.query = 'Anna'

        expect(grid.data).toHaveLength(TOTAL)
        expect(state.total).toBe(10)
    })

    it('refuses to replace, because the next fetch would undo it', async () => {
        const grid = pagedGrid()
        const state = await loaded(grid, 10)
        state.show()
        state.query = 'Anna'
        state.replacement = 'Bình'
        state.step(1)

        expect(state.replaceAvailable).toBe(false)
        expect(state.canReplaceAll).toBe(false)
        expect(state.replaceAll()).toBe(false)
        expect(state.replaceCurrent()).toBe(false)
        expect(grid.data[0]!.name).toBe('Anna 1')
    })

    it('allows it when the app says its edits survive a refetch', async () => {
        const grid = pagedGrid({ serverReplace: true })
        const state = await loaded(grid, 10)
        state.show()
        state.query = 'Anna'
        state.replacement = 'Bình'

        expect(state.replaceAvailable).toBe(true)
        expect(state.replaceAll()).toBe(true)
        expect(grid.data[0]!.name).toBe('Bình 1')
    })

    it('is exactly the write the default is protecting against', async () => {
        const grid = pagedGrid({ serverReplace: true })
        const state = await loaded(grid, 10)
        state.show()
        state.query = 'Anna'
        state.replacement = 'Bình'
        state.replaceAll()
        expect(state.replaced).toBe(10)

        const setPage = grid.api.setPage as (page: number) => void
        setPage(2)
        await expect.poll(() => grid.data[0]!.id).toBe(11)
        setPage(1)
        await expect.poll(() => grid.data[0]!.id).toBe(1)

        expect(grid.data[0]!.name).toBe('Anna 1')
    })
})
