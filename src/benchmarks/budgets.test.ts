import { describe, expect, it } from 'vitest'
import { createColumnState } from '../lib/core/columns/column-sizing.js'
import { variableRowLayout } from '../lib/core/virtual/row-layout.js'
import {
    compileColumnFilters,
    distinctValues,
    quickFilterNodes
} from '../lib/features/filtering/index.js'
import { rowsToMatrix, toCsv, toTsv } from '../lib/features/selection/index.js'
import { sortNodes } from '../lib/features/sorting/index.js'
import { benchColumns, makeBenchNodes, makeBenchRows } from './data.js'

const nodes100k = makeBenchNodes(100_000)
const benchColumnStates = benchColumns.map((def) => createColumnState(def))

const SAMPLES = 3

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
