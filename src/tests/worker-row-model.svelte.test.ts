import { describe, expect, it } from 'vitest'
import { workerDataSource } from '../lib/features/worker-row-model/index.js'
import { benchColumns, makeBenchRows, type BenchRow } from '../benchmarks/data.js'

const rows: BenchRow[] = makeBenchRows(150_000)

const emptyRequest = {
    startRow: 0,
    endRow: 50,
    sortModel: [],
    filterModel: { quick: 'person 1', quickFields: benchColumns.map((c) => c.id), columns: {} },
    groupKeys: [],
    groupBy: []
}

async function longestBlock(run: () => Promise<unknown>): Promise<number> {
    let longest = 0
    let previous = performance.now()
    let watching = true

    const tick = () => {
        const now = performance.now()
        longest = Math.max(longest, now - previous)
        previous = now
        if (watching) setTimeout(tick, 0)
    }
    setTimeout(tick, 0)

    await run()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
    watching = false
    return longest
}

describe('the worker row model keeps the filtering off the main thread', () => {
    it('really is on a worker in a browser', async () => {
        const source = workerDataSource<BenchRow>(rows, { columns: benchColumns })
        expect(source.usingWorker).toBe(true)

        const result = await source.getRows(emptyRequest)
        expect(result.rowCount).toBeGreaterThan(0)
        expect(result.rows.length).toBe(50)
        source.dispose()
    })

    it('leaves the calling thread free while it filters', async () => {
        const fresh = {
            ...emptyRequest,
            filterModel: { ...emptyRequest.filterModel, quick: 'person 2' }
        }

        const onWorker = workerDataSource<BenchRow>(rows, { columns: benchColumns })
        await onWorker.getRows(emptyRequest)
        const workerBlock = await longestBlock(() => onWorker.getRows(fresh))
        onWorker.dispose()

        const inline = workerDataSource<BenchRow>(rows, { columns: benchColumns, inline: true })
        await inline.getRows(emptyRequest)
        const inlineBlock = await longestBlock(() => inline.getRows(fresh))

        // eslint-disable-next-line no-console
        console.info(
            `  longest blocked task: worker ${workerBlock.toFixed(1)}ms vs inline ` +
                `${inlineBlock.toFixed(1)}ms over ${rows.length} rows`
        )

        expect(workerBlock).toBeLessThan(16)
        expect(inlineBlock).toBeGreaterThan(5)
    })

    it('answers the same rows either way', async () => {
        const onWorker = workerDataSource<BenchRow>(rows, { columns: benchColumns })
        const inline = workerDataSource<BenchRow>(rows, { columns: benchColumns, inline: true })

        const [a, b] = await Promise.all([
            onWorker.getRows(emptyRequest),
            inline.getRows(emptyRequest)
        ])
        onWorker.dispose()

        expect(a.rowCount).toBe(b.rowCount)
        expect(a.rows.map((row) => row.id)).toEqual(b.rows.map((row) => row.id))
    })

    it('never spends a whole frame handing the rows over', async () => {
        const longest = await longestBlock(async () => {
            const source = workerDataSource<BenchRow>(rows, { columns: benchColumns })
            await source.getRows(emptyRequest)
            source.dispose()
        })

        // eslint-disable-next-line no-console
        console.info(`  longest load task over ${rows.length} rows: ${longest.toFixed(1)}ms`)
        expect(longest).toBeLessThan(16)
    })
})
