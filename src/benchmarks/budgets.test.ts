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

const maskReader = () => '***'

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

function turnPages(grid: GridState<BenchRow>, count: number, pageSize: number): void {
    for (let page = 1; page <= count; page++) {
        grid.data = serverPageOf(page, pageSize)
        void grid.nodes
    }
}

const BUDGET_TIMEOUT = 60_000

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

        it('quick-filters 100k rows through a value gate within budget', () => {
            const elapsed = measure(() =>
                quickFilterNodes(nodes100k, benchColumns, 'person 12', {
                    read: (def) => (def.id === 'score' ? maskReader : undefined)
                })
            )
            expect(elapsed).toBeLessThan(400)
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

        it('serializes 10k rows through a value gate within budget', () => {
            const nodes10k = nodes100k.slice(0, 10_000)
            const elapsed = measure(() => {
                toCsv(
                    rowsToMatrix(nodes10k, benchColumnStates, undefined, {
                        read: (column) => (column.id === 'score' ? maskReader : undefined)
                    })
                )
            })
            expect(elapsed).toBeLessThan(250)
        })
    }
)
