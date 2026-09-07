import { createDataGrid, filtering, sorting, toFilterRequest } from '../lib/index.js'
import { describe, expect, it } from 'vitest'
import { buildStore, runQuery } from '../lib/features/worker-row-model/index.js'
import { wideBenchColumns, benchRowId, makeBenchRows, type BenchRow } from './data.js'

const ROWS = 200_000
const SAMPLES = 3
const TIMEOUT = 120_000

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

function report(name: string, ms: number, budget: number): number {
    console.info(`  ${name.padEnd(46)} ${ms.toFixed(1).padStart(8)}ms  / ${budget}ms`)
    return ms
}

const rows = makeBenchRows(ROWS)
const fields = wideBenchColumns.map((column) => column.id)
function valuesOf(source: BenchRow[]): Record<string, unknown[]> {
    const values: Record<string, unknown[]> = {}
    for (const field of fields) {
        values[field] = source.map((row) => (row as unknown as Record<string, unknown>)[field])
    }
    return values
}

const columnValues = valuesOf(rows)

const emptyFilter = toFilterRequest({ quick: '', columns: {} })

function quickRequest(query: string) {
    const request = toFilterRequest({ quick: '', columns: {} })
    request.quick = query
    request.quickFields = fields
    return request
}

function mainThreadGrid() {
    return createDataGrid<BenchRow>({
        columns: wideBenchColumns,
        data: rows,
        getRowId: benchRowId,
        features: [filtering(), sorting()]
    })
}

describe('worker row model at scale', () => {
    it(
        'loads the columnar store inside its budget',
        () => {
            const ms = report(
                `builds ${ROWS / 1000}k x ${fields.length} columnar store`,
                measure(() => void buildStore(columnValues, rows.length)),
                300
            )
            expect(ms).toBeLessThan(300)
        },
        TIMEOUT
    )

    const store = buildStore(columnValues, rows.length)

    it(
        'quick filters the whole store inside its budget',
        () => {
            const query = quickRequest('person 1')
            const ms = report(
                'quick filter over the columnar store',
                measure(() => void runQuery(store, { filter: query, sort: [] })),
                60
            )
            expect(ms).toBeLessThan(60)
        },
        TIMEOUT
    )

    it(
        'answers a low-cardinality column far faster than the main thread does',
        () => {
            const filter = toFilterRequest({
                quick: '',
                columns: { dept: { kind: 'text', op: 'contains', value: 'core' } }
            })

            const worker = measure(() => void runQuery(store, { filter, sort: [] }))

            const grid = mainThreadGrid()
            const main = measure(() => {
                grid.api.setColumnFilter!('dept', null)
                grid.api.setColumnFilter!('dept', { kind: 'text', op: 'contains', value: 'core' })
                void grid.preWindowNodes.length
            })

            console.info(
                `  dept contains: worker ${worker.toFixed(1)}ms vs main thread ` +
                    `${main.toFixed(1)}ms  (${(main / worker).toFixed(1)}x)`
            )
            expect(main / worker).toBeGreaterThan(4)
        },
        TIMEOUT
    )

    it(
        'sorts a text column inside its budget',
        () => {
            const ms = report(
                'sort by name, dictionary ranked',
                measure(
                    () =>
                        void runQuery(store, {
                            filter: emptyFilter,
                            sort: [{ columnId: 'name', direction: 'asc' }]
                        })
                ),
                150
            )
            expect(ms).toBeLessThan(150)
        },
        TIMEOUT
    )
})
