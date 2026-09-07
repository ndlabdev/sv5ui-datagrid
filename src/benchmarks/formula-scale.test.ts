import { createDataGrid, sorting } from '../lib/index.js'
import { describe, expect, it } from 'vitest'
import { formula } from '../lib/features/formula/index.js'
import { wideBenchColumns, benchRowId, makeBenchRows, type BenchRow } from './data.js'

const ROWS = 100_000

const SIMPLE_BUDGET_MS = 400
const NESTED_BUDGET_MS = 900
const CHAINED_BUDGET_MS = 1_200
const PER_ROW_BUDGET_US = 1

function measure(run: () => void): number {
    run()
    let best = Number.POSITIVE_INFINITY
    for (let sample = 0; sample < 3; sample++) {
        const start = performance.now()
        run()
        best = Math.min(best, performance.now() - start)
    }
    return best
}

function withFormulas(columns: Record<string, string>) {
    const grid = createDataGrid<BenchRow>({
        columns: [...wideBenchColumns, { id: 'computed', header: 'Computed' }],
        data: makeBenchRows(ROWS),
        getRowId: benchRowId,
        features: [sorting(), formula<BenchRow>({ columns })]
    })
    return () => {
        grid.data = grid.data.slice()
        void grid.preWindowNodes
    }
}

function report(name: string, ms: number, budget: number): void {
    const headroom = Math.round((1 - ms / budget) * 100)
    console.info(
        `  ${name.padEnd(40)} ${ms.toFixed(1).padStart(8)}ms / ${budget}ms  (${headroom}% spare)`
    )
}

describe('formula columns at scale', () => {
    it('evaluates one arithmetic expression over every row', () => {
        const ms = measure(withFormulas({ computed: 'salary * 2' }))
        report(`${ROWS} rows, salary * 2`, ms, SIMPLE_BUDGET_MS)
        expect(ms).toBeLessThan(SIMPLE_BUDGET_MS)
    }, 120_000)

    it('evaluates a nested conditional over every row', () => {
        const ms = measure(
            withFormulas({
                computed: 'IF(salary > 5000, "high", IF(salary > 2000, "mid", "low")) & "-" & dept'
            })
        )
        report(`${ROWS} rows, nested IF`, ms, NESTED_BUDGET_MS)
        expect(ms).toBeLessThan(NESTED_BUDGET_MS)
    }, 120_000)

    it('evaluates a formula that builds on another formula', () => {
        const ms = measure(
            withFormulas({
                computed: 'ROUND(base * 1.1, 2)',
                base: 'salary + LEN(name)'
            })
        )
        report(`${ROWS} rows, two chained formulas`, ms, CHAINED_BUDGET_MS)
        expect(ms).toBeLessThan(CHAINED_BUDGET_MS)
    }, 120_000)

    it('costs nothing measurable when no formula is declared', () => {
        const bare = createDataGrid<BenchRow>({
            columns: wideBenchColumns,
            data: makeBenchRows(ROWS),
            getRowId: benchRowId,
            features: [sorting(), formula<BenchRow>()]
        })

        const ms = measure(() => {
            bare.data = bare.data.slice()
            void bare.preWindowNodes
        })
        report(`${ROWS} rows, feature present but idle`, ms, SIMPLE_BUDGET_MS)
        expect(ms).toBeLessThan(SIMPLE_BUDGET_MS)
    }, 120_000)

    it('costs well under a microsecond per row', () => {
        const ms = measure(withFormulas({ computed: 'salary * 2' }))
        const perRow = (ms * 1000) / ROWS

        console.info(
            `  ${perRow.toFixed(2)}us per row / ${PER_ROW_BUDGET_US}us` +
                `  (${ROWS} rows in ${ms.toFixed(0)}ms)`
        )
        expect(perRow).toBeLessThan(PER_ROW_BUDGET_US)
    }, 120_000)
})
