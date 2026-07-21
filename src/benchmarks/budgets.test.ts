import { describe, expect, it } from 'vitest'
import { createColumnState } from '../lib/core/column-sizing.js'
import { variableRowLayout } from '../lib/core/row-layout.js'
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

function measure(run: () => void): number {
    run()
    const start = performance.now()
    run()
    return performance.now() - start
}

describe('performance budgets (coarse regression ceilings; PLAN §8 targets are stricter)', () => {
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
        expect(elapsed).toBeLessThan(1000)
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
        expect(elapsed).toBeLessThan(1000)
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
})
