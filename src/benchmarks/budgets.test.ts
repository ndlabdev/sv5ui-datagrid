import { describe, expect, it } from 'vitest'
import { createColumnState } from '../lib/core/columns/index.js'
import { createDataGrid, type GridState } from '../lib/core/grid/index.js'
import { pagination } from '../lib/features/pagination/index.js'
import { variableRowLayout } from '../lib/core/virtual/index.js'
import {
    compileColumnFilters,
    distinctValues,
    quickFilterNodes
} from '../lib/features/filtering/index.js'
import { rowsToMatrix, toCsv, toTsv } from '../lib/features/selection/index.js'
import { sortNodes } from '../lib/features/sorting/index.js'
import { benchColumns, makeBenchNodes, makeBenchRows, serverPageOf, type BenchRow } from './data.js'

const nodes100k = makeBenchNodes(100_000)
const benchColumnStates = benchColumns.map((def) => createColumnState(def))

const SAMPLES = 3

/** A grid on one page of a backend it never sees the rest of. */
function serverGrid(pageSize: number, rowCount: number): GridState<BenchRow> {
    const grid = createDataGrid<BenchRow>({
        columns: benchColumns,
        data: serverPageOf(1, pageSize),
        getRowId: (row) => String(row.id),
        rowModel: 'server',
        features: [pagination({ pageSize, rowCount })]
    })
    void grid.nodes
    return grid
}

/** Swapping `data` and reading the output is the whole of a page turn. */
function turnPages(grid: GridState<BenchRow>, count: number, pageSize: number): void {
    for (let page = 1; page <= count; page++) {
        grid.data = serverPageOf(page, pageSize)
        void grid.nodes
    }
}

/**
 * `measure` runs an operation SAMPLES + 1 times, so a test here costs several
 * times what it asserts. On the CI runner a multi-sort of 100k rows measures
 * about 1.2s, which is four seconds of work against vitest's 5s default and
 * timed the suite out even with the ceilings sized correctly. A benchmark is
 * not a unit test and should not borrow its timeout.
 */
const BUDGET_TIMEOUT = 60_000

/**
 * The fastest of several samples, after a warm-up. A genuine regression slows
 * every sample, so the ceiling still catches it; background load on the
 * machine only slows some, which is what made a single-sample measurement
 * fail this suite intermittently.
 */
function measure(run: () => void): number {
    run()

    let best = Number.POSITIVE_INFINITY
    for (let sample = 0; sample < SAMPLES; sample++) {
        const start = performance.now()
        run()
        best = Math.min(best, performance.now() - start)
    }
    return best
}

/**
 * Every ceiling here is sized for the slowest machine the suite runs on, which
 * is the two-core CI runner rather than a development machine. The runner
 * measures about 3.7x slower: a string sort of 100k rows takes 325ms locally
 * and 1172ms there. A ceiling calibrated locally therefore passes for whoever
 * writes it and fails for everyone else, which is what these two did.
 *
 * The point is to catch a regression, not to state a performance target, so
 * each ceiling is roughly double what the runner already measures. Anything
 * that slows an operation by half again is caught; a fast machine reporting a
 * number far under the ceiling is expected, not slack to be tightened up.
 * PLAN section 8 holds the real targets.
 */

describe(
    'performance budgets (coarse regression ceilings; PLAN §8 targets are stricter)',
    { timeout: BUDGET_TIMEOUT },
    () => {
        it('sorts 100k rows by number within budget', () => {
            const elapsed = measure(() =>
                sortNodes(nodes100k, benchColumns, [{ columnId: 'score', direction: 'asc' }])
            )
            expect(elapsed).toBeLessThan(500)
        })

        it('sorts 100k rows by string within budget', () => {
            const elapsed = measure(() =>
                sortNodes(nodes100k, benchColumns, [{ columnId: 'name', direction: 'asc' }])
            )
            expect(elapsed).toBeLessThan(2500)
        })

        it('quick-filters 100k rows within budget', () => {
            const elapsed = measure(() => quickFilterNodes(nodes100k, benchColumns, 'person 12'))
            expect(elapsed).toBeLessThan(300)
        })

        it('builds a 100k variable-row layout within budget', () => {
            const elapsed = measure(() => variableRowLayout(100_000, (i) => 40 + (i % 3) * 24))
            expect(elapsed).toBeLessThan(100)
        })

        it('multi-sorts 100k rows within budget', () => {
            const elapsed = measure(() =>
                sortNodes(nodes100k, benchColumns, [
                    { columnId: 'name', direction: 'asc' },
                    { columnId: 'score', direction: 'desc' }
                ])
            )
            expect(elapsed).toBeLessThan(2500)
        })

        it('applies compiled column filters to 100k rows within budget', () => {
            const predicate = compileColumnFilters(benchColumns, {
                score: { kind: 'number', op: 'between', value: 100, to: 800 },
                active: { kind: 'boolean', value: true }
            })!
            const elapsed = measure(() => nodes100k.filter(predicate))
            expect(elapsed).toBeLessThan(300)
        })

        it('collects distinct values from 100k rows within budget', () => {
            const elapsed = measure(() => distinctValues(nodes100k, benchColumns[0]))
            expect(elapsed).toBeLessThan(200)
        })

        it('applies a single-cell transaction to a 100k array within budget', () => {
            const rows = makeBenchRows(100_000)
            const elapsed = measure(() => {
                const index = 50_000
                const next = rows.slice()
                next[index] = { ...next[index], name: 'Edited' }
                void next
            })
            expect(elapsed).toBeLessThan(20)
        })

        it('flattens 100k rows with structural meta and expanded details within budget', () => {
            const expanded = new Set(
                nodes100k.filter((_, index) => index % 10 === 0).map((node) => node.id)
            )
            const elapsed = measure(() =>
                nodes100k.flatMap((node) => {
                    const parent = { ...node, meta: { expandable: true, level: 0 } }
                    if (!expanded.has(node.id)) return [parent]
                    return [
                        parent,
                        {
                            id: `${node.id}:detail`,
                            row: node.row,
                            index: node.index,
                            meta: { fullWidth: true, level: 1 }
                        }
                    ]
                })
            )
            expect(elapsed).toBeLessThan(150)
        })

        /**
         * A server model holds one page, so a page turn should cost what the
         * page costs and nothing for the set behind it. The two backends here
         * differ by a factor of a hundred and are measured against the same
         * ceiling on purpose: if the set ever starts to count, only the second
         * one breaks.
         */
        it('turns 200 pages of 50 rows within budget, whatever the backend holds', () => {
            const small = serverGrid(50, 100_000)
            const huge = serverGrid(50, 10_000_000)

            expect(measure(() => turnPages(small, 200, 50))).toBeLessThan(150)
            expect(measure(() => turnPages(huge, 200, 50))).toBeLessThan(150)
        })

        it('turns 20 pages of 1000 rows within budget', () => {
            const grid = serverGrid(1000, 10_000_000)
            expect(measure(() => turnPages(grid, 20, 1000))).toBeLessThan(250)
        })

        it('serializes 10k selected rows to TSV and CSV within budget', () => {
            const nodes10k = nodes100k.slice(0, 10_000)
            const elapsed = measure(() => {
                const matrix = rowsToMatrix(nodes10k, benchColumnStates)
                toTsv(matrix)
                toCsv(matrix)
            })
            expect(elapsed).toBeLessThan(200)
        })
    }
)
