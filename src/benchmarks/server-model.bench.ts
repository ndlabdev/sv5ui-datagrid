import { bench, describe } from 'vitest'
import { createDataGrid } from '../lib/core/grid/grid.svelte.js'
import { pagination } from '../lib/features/pagination/index.js'
import { sorting } from '../lib/features/sorting/index.js'
import { benchColumns, serverPageOf, type BenchRow } from './data.js'

const pageOf = serverPageOf

function serverGrid(pageSize: number, rowCount: number) {
    const grid = createDataGrid<BenchRow>({
        columns: benchColumns,
        data: pageOf(1, pageSize),
        getRowId: (row) => String(row.id),
        rowModel: 'server',
        features: [sorting(), pagination({ pageSize, rowCount })]
    })
    void grid.nodes
    return grid
}

/**
 * What a page turn costs the grid under a server model: swap `data`, then read
 * the pipeline output the renderer will iterate. The size of the set behind it
 * is the variable being held up against the page size — one of them matters.
 */
describe('server row model — a page turn', () => {
    const page50of100k = serverGrid(50, 100_000)
    const page50of10m = serverGrid(50, 10_000_000)
    const page1000of10m = serverGrid(1000, 10_000_000)
    let turn = 0

    bench('50 rows out of 100k', () => {
        page50of100k.data = pageOf((turn++ % 500) + 1, 50)
        void page50of100k.nodes
    })

    bench('50 rows out of 10m', () => {
        page50of10m.data = pageOf((turn++ % 500) + 1, 50)
        void page50of10m.nodes
    })

    bench('1000 rows out of 10m', () => {
        page1000of10m.data = pageOf((turn++ % 500) + 1, 1000)
        void page1000of10m.nodes
    })
})
