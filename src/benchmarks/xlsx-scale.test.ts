import { createDataGrid } from '../lib/index.js'
import { describe, expect, it } from 'vitest'
import { buildGridXlsx, buildGridXlsxAsync, type XlsxStyle } from '../lib/features/xlsx/index.js'
import { sheetChunks } from '../lib/features/xlsx/sheet.js'
import { wideBenchColumns, benchRowId, makeBenchRows } from './data.js'

const ROWS = 200_000

const ROWS_PER_CHUNK = 500
const PEAK_STRING_RATIO = 50
const LONGEST_BLOCK_BUDGET_MS = 250
const COMPRESSION_RATIO_BUDGET = 4
const STYLE_SPREAD_BUDGET = 1.6

function grid(rows: number) {
    const built = createDataGrid({
        columns: wideBenchColumns,
        data: makeBenchRows(rows),
        getRowId: benchRowId
    })
    void built.preWindowNodes
    return built
}

const mb = (bytes: number) => bytes / 1024 / 1024

describe('xlsx export at scale', () => {
    it('stays linear as rows grow', async () => {
        const perRow: number[] = []

        for (const rows of [25_000, 100_000]) {
            const built = grid(rows)
            const start = performance.now()
            await buildGridXlsxAsync(built)
            const ms = performance.now() - start
            perRow.push((ms * 1000) / rows)

            console.info(`  ${String(rows).padStart(7)} rows  ${ms.toFixed(0).padStart(5)}ms`)
        }

        expect(perRow[1]! / perRow[0]!).toBeLessThan(2)
    }, 600_000)

    it('never builds a string anywhere near the size of the sheet', () => {
        const rows = Array.from({ length: ROWS }, (_, i) => [i, `row ${i}`, i * 3, true])
        const columns = [{ header: 'a' }, { header: 'b' }, { header: 'c' }, { header: 'd' }]

        let total = 0
        let largest = 0
        let count = 0
        for (const chunk of sheetChunks({ columns, rows })) {
            total += chunk.length
            largest = Math.max(largest, chunk.length)
            count++
        }

        console.info(
            `  ${count} chunks, largest ${(largest / 1024).toFixed(0)}KB of a` +
                ` ${mb(total).toFixed(0)}MB sheet (${(total / largest).toFixed(0)}x smaller)`
        )
        expect(count).toBeGreaterThan(ROWS / ROWS_PER_CHUNK)
        expect(largest).toBeLessThan(total / PEAK_STRING_RATIO)
    }, 600_000)

    it('never holds the main thread for longer than a dropped frame budget', async () => {
        const built = grid(ROWS)

        let last = performance.now()
        let longest = 0
        let turns = 0

        const beat = () => {
            const now = performance.now()
            longest = Math.max(longest, now - last)
            last = now
            turns++
            handle = setTimeout(beat, 0)
        }
        let handle = setTimeout(beat, 0)

        last = performance.now()
        await buildGridXlsxAsync(built)
        clearTimeout(handle)

        console.info(
            `  ${turns} loop turns, longest block ${longest.toFixed(0)}ms` +
                ` / ${LONGEST_BLOCK_BUDGET_MS}ms`
        )
        expect(turns).toBeGreaterThan(50)
        expect(longest).toBeLessThan(LONGEST_BLOCK_BUDGET_MS)
    }, 600_000)

    it('compresses, where the synchronous builder can only store', async () => {
        const built = grid(50_000)

        const stored = buildGridXlsx(built)
        const streamed = await buildGridXlsxAsync(built)
        const ratio = stored.byteLength / streamed.byteLength

        console.info(
            `  stored ${mb(stored.byteLength).toFixed(1)}MB` +
                ` → streamed ${mb(streamed.byteLength).toFixed(1)}MB  (${ratio.toFixed(1)}x)`
        )
        expect(ratio).toBeGreaterThan(COMPRESSION_RATIO_BUDGET)
    }, 600_000)
})

describe('per-cell styling does not slow down as the palette grows', () => {
    const STYLED_ROWS = 50_000

    function timeWith(distinct: number): number {
        const built = grid(STYLED_ROWS)
        let call = 0
        const cellStyle = (): XlsxStyle => ({
            fill: (call++ % distinct).toString(16).padStart(6, '0')
        })

        const start = performance.now()
        buildGridXlsx(built, { cellStyle })
        return performance.now() - start
    }

    it('costs about the same for one look as for a thousand', () => {
        const one = timeWith(1)
        const many = timeWith(1_000)
        const spread = many / one

        console.info(
            `  ${STYLED_ROWS} rows: 1 look ${one.toFixed(0)}ms,` +
                ` 1000 looks ${many.toFixed(0)}ms  (${spread.toFixed(2)}x / ${STYLE_SPREAD_BUDGET}x)`
        )
        expect(spread).toBeLessThan(STYLE_SPREAD_BUDGET)
    }, 600_000)
})
