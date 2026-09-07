import { describe, expect, it, vi } from 'vitest'
import { createDataGrid, editing, getCellValue, virtualization } from '../lib/index.js'
import {
    columnMap,
    computeStats,
    conditionalFormatting,
    getConditionalFormatting,
    hasNumbers,
    paintOf,
    sampleDataRows,
    type FormatRule
} from '../lib/features/conditional-formatting/index.js'
import { parse } from '../lib/features/formula/index.js'
import { findReplace, getFindReplace } from '../lib/features/find-replace/index.js'
import { advancedFilter, getAdvancedFilter } from '../lib/features/advanced-filter/index.js'
import { grouping } from '../lib/features/grouping/index.js'
import { showValuesAs } from '../lib/features/show-values-as/index.js'
import {
    buildMoveEdits,
    getRangeSelection,
    rangeSelection
} from '../lib/features/range-selection/index.js'
import {
    getServerRowModel,
    serverRowModel,
    type DataSource
} from '../lib/features/server-row-model/index.js'
import {
    buildGridXlsx,
    createZip,
    deflateEntries,
    workbookEntries
} from '../lib/features/xlsx/index.js'
import {
    wideBenchColumns,
    benchRowId,
    makeBenchNodes,
    makeBenchRows,
    type BenchRow
} from './data.js'

const SAMPLES = 3

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

const BUDGET_TIMEOUT = 60_000

function report(name: string, ms: number, budget: number): number {
    const headroom = Math.round((1 - ms / budget) * 100)
    console.info(
        `  ${name.padEnd(46)} ${ms.toFixed(1).padStart(8)}ms  / ${budget}ms  (${headroom}% spare)`
    )
    return ms
}

const rows100k = makeBenchRows(100_000)

function groupedGrid(by: string[], data: BenchRow[]) {
    return createDataGrid<BenchRow>({
        columns: wideBenchColumns,
        data,
        getRowId: benchRowId,
        features: [grouping<BenchRow>({ by, aggregations: { salary: 'sum' } })]
    })
}

describe('performance budgets', () => {
    it(
        'groups 100k rows on one level inside its budget',
        () => {
            const grid = groupedGrid(['dept'], rows100k)
            const ms = measure(() => {
                void grid.preWindowNodes
            })

            expect(report('grouping 100k rows, one level', ms, 1_500)).toBeLessThan(1_500)
        },
        BUDGET_TIMEOUT
    )

    it(
        'groups 100k rows on two levels inside its budget',
        () => {
            const grid = groupedGrid(['dept', 'country'], rows100k)
            const ms = measure(() => {
                void grid.preWindowNodes
            })

            expect(report('grouping 100k rows, two levels', ms, 2_500)).toBeLessThan(2_500)
        },
        BUDGET_TIMEOUT
    )

    it(
        'builds a 100k-row grid without grouping inside its budget',
        () => {
            const grid = createDataGrid<BenchRow>({
                columns: wideBenchColumns,
                data: rows100k,
                getRowId: benchRowId
            })
            const ms = measure(() => {
                void grid.preWindowNodes
            })

            expect(report('baseline: 100k rows, no grouping', ms, 500)).toBeLessThan(500)
        },
        BUDGET_TIMEOUT
    )
})

describe('show values as budgets', () => {
    const sharesGrid = (
        by: string[],
        shown: Record<string, 'percentOfGrandTotal' | 'percentOfParent'>
    ) =>
        createDataGrid<BenchRow>({
            columns: wideBenchColumns,
            data: rows100k,
            getRowId: benchRowId,
            features: [
                grouping<BenchRow>({ by, aggregations: { salary: 'sum' } }),
                showValuesAs<BenchRow>({ columns: shown })
            ]
        })

    it(
        'shares 100k flat rows against the column total inside its budget',
        () => {
            const grid = sharesGrid([], { salary: 'percentOfGrandTotal' })
            const ms = measure(() => {
                void grid.preWindowNodes
            })

            expect(report('show values as, 100k flat rows', ms, 200)).toBeLessThan(200)
        },
        BUDGET_TIMEOUT
    )

    it(
        'shares 100k grouped rows against their own group inside its budget',
        () => {
            const grid = sharesGrid(['dept', 'country'], { salary: 'percentOfParent' })
            const ms = measure(() => {
                void grid.preWindowNodes
            })

            expect(report('show values as, 100k grouped rows', ms, 600)).toBeLessThan(600)
        },
        BUDGET_TIMEOUT
    )
})

describe('range selection budgets', () => {
    it(
        'drags a range across 10k cells inside its budget',
        () => {
            const grid = createDataGrid<BenchRow>({
                columns: wideBenchColumns,
                data: rows100k,
                getRowId: benchRowId,
                features: [rangeSelection()]
            })
            const state = getRangeSelection(grid)!
            void grid.preWindowNodes

            const ms = measure(() => {
                state.startRange(0, 0)
                state.extendTo(1_999, 4)
                void state.selectedValues
            })

            expect(report('range drag across 10k cells', ms, 400)).toBeLessThan(400)
        },
        BUDGET_TIMEOUT
    )
})

describe('range overlay budgets', () => {
    it(
        'decorates 10k cells with a cut and a move preview inside its budget',
        () => {
            const grid = createDataGrid<BenchRow>({
                columns: wideBenchColumns,
                data: rows100k,
                getRowId: benchRowId,
                features: [rangeSelection()]
            })
            const state = getRangeSelection(grid)!
            void grid.preWindowNodes

            state.startRange(0, 0)
            state.extendTo(1_999, 4)
            state.endRange()
            state.startMove(0, 0)
            state.extendMove(500, 0)

            const ms = measure(() => {
                for (let row = 0; row < 2_000; row++) {
                    for (let col = 0; col < 5; col++) state.cellDecoration(row, col)
                }
            })

            expect(report('cell decoration over 10k cells', ms, 260)).toBeLessThan(260)
        },
        BUDGET_TIMEOUT
    )

    it(
        'builds the edits for a 10k-cell move inside its budget',
        () => {
            const grid = createDataGrid<BenchRow>({
                columns: wideBenchColumns,
                data: rows100k,
                getRowId: benchRowId,
                features: [editing(), rangeSelection()]
            })
            const nodes = grid.preWindowNodes
            const columns = grid.columns.visible

            const ms = measure(() => {
                buildMoveEdits({ top: 0, left: 0, bottom: 1_999, right: 4 }, 2_000, 0, {
                    canRead: (row, col) => Boolean(nodes[row] && columns[col]),
                    read: (row, col) => {
                        const node = nodes[row]
                        const column = columns[col]
                        return node && column ? getCellValue(node.row, column.def) : null
                    },
                    resolve: (row, col) => {
                        const node = nodes[row]
                        const column = columns[col]
                        return node && column ? { rowId: node.id, columnId: column.id } : null
                    }
                })
            })

            expect(report('build edits for a 10k-cell move', ms, 60)).toBeLessThan(60)
        },
        BUDGET_TIMEOUT
    )
})

describe('advanced filter budgets', () => {
    it(
        'filters 100k rows through a five-condition tree inside its budget',
        () => {
            const grid = createDataGrid<BenchRow>({
                columns: wideBenchColumns,
                data: rows100k,
                getRowId: benchRowId,
                features: [
                    advancedFilter<BenchRow>({
                        model: {
                            kind: 'group',
                            join: 'or',
                            children: [
                                {
                                    kind: 'group',
                                    join: 'and',
                                    children: [
                                        {
                                            kind: 'condition',
                                            columnId: 'dept',
                                            op: 'equals',
                                            value: 'Core'
                                        },
                                        {
                                            kind: 'condition',
                                            columnId: 'salary',
                                            op: 'gte',
                                            value: 50_000
                                        },
                                        {
                                            kind: 'condition',
                                            columnId: 'name',
                                            op: 'contains',
                                            value: 'a'
                                        }
                                    ]
                                },
                                {
                                    kind: 'condition',
                                    columnId: 'country',
                                    op: 'in',
                                    values: ['VN']
                                },
                                { kind: 'condition', columnId: 'salary', op: 'blank' }
                            ]
                        }
                    })
                ]
            })

            const ms = measure(() => {
                void grid.preWindowNodes.length
                const state = getAdvancedFilter(grid)!
                state.setModel({ ...state.model })
            })

            expect(report('advanced filter over 100k rows', ms, 400)).toBeLessThan(400)
        },
        BUDGET_TIMEOUT
    )
})

describe('find budgets', () => {
    it(
        'scans 100k rows for a query inside its budget',
        () => {
            const grid = createDataGrid<BenchRow>({
                columns: wideBenchColumns,
                data: rows100k,
                getRowId: benchRowId,
                features: [findReplace()]
            })
            const state = getFindReplace(grid)!
            state.show()
            void grid.preWindowNodes

            const ms = measure(() => {
                state.query = state.query === 'Core' ? 'Data' : 'Core'
                void state.matches
            })

            expect(report('find: 100k rows, 5 columns', ms, 600)).toBeLessThan(600)
        },
        BUDGET_TIMEOUT
    )
})

function formattedGridFor(rules: FormatRule[]) {
    const grid = createDataGrid<BenchRow>({
        columns: wideBenchColumns,
        data: rows100k,
        getRowId: benchRowId,
        features: [conditionalFormatting<BenchRow>({ rules })]
    })
    void grid.preWindowNodes
    return grid
}

describe('conditional formatting budgets', () => {
    function formattedGrid(rules: FormatRule[]) {
        const grid = createDataGrid<BenchRow>({
            columns: wideBenchColumns,
            data: rows100k,
            getRowId: benchRowId,
            features: [conditionalFormatting<BenchRow>({ rules })]
        })
        void grid.preWindowNodes
        return grid
    }

    it(
        'reads the column stats of three rules over 100k rows inside its budget',
        () => {
            const grid = formattedGrid([
                { kind: 'colorScale', column: 'salary' },
                { kind: 'duplicates', column: 'dept' },
                { kind: 'topN', column: 'salary', n: 100 }
            ])
            const state = getConditionalFormatting(grid)!
            const node = grid.preWindowNodes[0]!
            const column = grid.columns.visible.find((entry) => entry.id === 'salary')!

            let flip = 0
            const ms = measure(() => {
                flip++
                state.setRules([
                    { kind: 'colorScale', column: 'salary', max: 100_000 + flip },
                    { kind: 'duplicates', column: 'dept' },
                    { kind: 'topN', column: 'salary', n: 100 }
                ])
                state.decoration(node, column)
            })

            expect(report('formatting: stats for 3 rules, 100k rows', ms, 150)).toBeLessThan(150)
        },
        BUDGET_TIMEOUT
    )

    it(
        'paints a rendered window of cells inside its budget',
        () => {
            const rules: FormatRule[] = [
                { kind: 'colorScale', column: 'salary' },
                { kind: 'dataBar', column: 'salary' },
                { kind: 'expression', when: 'salary > 80000 AND active' }
            ]
            const columns = columnMap(formattedGrid(rules).columns.all)
            const stats = computeStats(rules, makeBenchNodes(rows100k.length), columns)
            const node = parse('salary > 80000 AND active')
            const window = rows100k.slice(0, 100)

            const ms = measure(() => {
                for (const row of window) {
                    const read = (id: string) => (row as unknown as Record<string, unknown>)[id]
                    for (const rule of rules) {
                        for (let cell = 0; cell < 5; cell++) {
                            paintOf(rule, stats[rules.indexOf(rule)]!, {
                                value: row.salary,
                                rowId: String(row.id),
                                read,
                                node,
                                highlight: 'x'
                            })
                        }
                    }
                }
            })

            expect(report('formatting: 500 cells, 3 rules', ms, 5)).toBeLessThan(5)
        },
        BUDGET_TIMEOUT
    )
})

describe('conditional formatting panel budgets', () => {
    it(
        'probes which columns a rule can read without walking the grid',
        () => {
            const grid = formattedGridFor([])
            const nodes = grid.preWindowNodes
            const columns = grid.columns.visible

            const ms = measure(() => {
                const sample = sampleDataRows(nodes, 50)
                for (const column of columns) hasNumbers(sample, column)
            })

            expect(report('formatting: column probe, 100k rows', ms, 2)).toBeLessThan(2)
        },
        BUDGET_TIMEOUT
    )
})

describe('xlsx export budgets', () => {
    const rows50k = makeBenchRows(50_000)

    function xlsxGrid() {
        const grid = createDataGrid<BenchRow>({
            columns: wideBenchColumns,
            data: rows50k,
            getRowId: benchRowId
        })
        void grid.preWindowNodes
        return grid
    }

    it(
        'writes the formatting rules without paying for them per row',
        () => {
            const grid = createDataGrid<BenchRow>({
                columns: wideBenchColumns,
                data: rows50k,
                getRowId: benchRowId,
                features: [
                    conditionalFormatting<BenchRow>({
                        rules: [
                            { kind: 'colorScale', column: 'salary' },
                            { kind: 'dataBar', column: 'salary' },
                            { kind: 'duplicates', column: 'dept' }
                        ]
                    })
                ]
            })
            void grid.preWindowNodes

            const ms = measure(() => {
                buildGridXlsx(grid)
            })

            expect(report('xlsx: 50k rows, 3 rules', ms, 4_000)).toBeLessThan(4_000)
        },
        BUDGET_TIMEOUT
    )

    it(
        'writes a 50k-row workbook inside its budget',
        () => {
            const grid = xlsxGrid()
            const ms = measure(() => {
                buildGridXlsx(grid)
            })

            expect(report('xlsx: 50k rows, stored', ms, 4_000)).toBeLessThan(4_000)
        },
        BUDGET_TIMEOUT
    )

    it(
        'deflates a 50k-row workbook inside its budget, and it is worth it',
        async () => {
            const options = {
                columns: wideBenchColumns.map((column) => ({ header: String(column.id) })),
                rows: rows50k.map((row) => [
                    row.name,
                    row.dept,
                    row.country,
                    row.salary,
                    row.active
                ])
            }

            const stored = createZip(workbookEntries(options)).byteLength
            const start = performance.now()
            const compressed = createZip(await deflateEntries(workbookEntries(options))).byteLength
            const ms = performance.now() - start

            expect(report('xlsx: 50k rows, deflated', ms, 4_000)).toBeLessThan(4_000)
            console.info(
                `  ${''.padEnd(46)} ${(stored / 1024 / 1024).toFixed(1)}MB stored → ` +
                    `${(compressed / 1024 / 1024).toFixed(1)}MB deflated`
            )

            expect(compressed).toBeLessThan(stored * 0.25)
        },
        BUDGET_TIMEOUT
    )
})

describe('server row model budgets', () => {
    function infiniteGrid(total: number, blockSize: number) {
        const source: DataSource<BenchRow> = {
            getRows: async (request) => ({
                rows: makeBenchRows(request.endRow - request.startRow),
                rowCount: total
            })
        }
        return createDataGrid<BenchRow>({
            columns: wideBenchColumns,
            data: [],
            getRowId: benchRowId,
            rowModel: 'server',
            features: [
                virtualization(),
                serverRowModel(source, {
                    mode: 'infinite',
                    blockSize,
                    placeholder: (index) => ({
                        id: -index - 1,
                        name: '',
                        email: '',
                        score: 0,
                        dept: '',
                        country: '',
                        salary: 0,
                        active: false
                    })
                })
            ]
        })
    }

    it(
        'takes the first block of a 1M-row scroll inside its budget',
        async () => {
            const grid = infiniteGrid(1_000_000, 100)
            const model = getServerRowModel<BenchRow>(grid)!

            const start = performance.now()
            model.refresh()
            await vi.waitUntil(() => grid.data.length === 1_000_000, { timeout: 30_000 })
            const ms = performance.now() - start

            expect(report('infinite: first block of 1M rows', ms, 3_000)).toBeLessThan(3_000)
        },
        BUDGET_TIMEOUT
    )

    it(
        'takes a later block of a 1M-row scroll inside its budget',
        async () => {
            const grid = infiniteGrid(1_000_000, 100)
            const model = getServerRowModel<BenchRow>(grid)!
            model.refresh()
            await vi.waitUntil(() => grid.data.length === 1_000_000, { timeout: 30_000 })

            const start = performance.now()
            model.ensureRange(500_000, 500_100)
            await vi.waitUntil(() => grid.data[500_000]?.name !== '', { timeout: 30_000 })
            const ms = performance.now() - start

            expect(report('infinite: later block of 1M rows', ms, 500)).toBeLessThan(500)
        },
        BUDGET_TIMEOUT
    )
})
