import { bench, describe } from 'vitest'
import { createColumnState, prefixSums, resolveColumnWidths } from '../lib/core/column-sizing.js'
import { buildRowNodes } from '../lib/core/row-node.js'
import { variableRowLayout } from '../lib/core/row-layout.js'
import {
    compileColumnFilters,
    distinctValues,
    quickFilterNodes
} from '../lib/features/filtering/index.js'
import { sortNodes } from '../lib/features/sorting/index.js'
import { benchColumns, makeBenchNodes, makeBenchRows } from './data.js'

const rows100k = makeBenchRows(100_000)
const nodes100k = makeBenchNodes(100_000)
const manyColumns = Array.from({ length: 100 }, (_, i) =>
    createColumnState({ id: `col${i}`, flex: (i % 3) + 1, minWidth: 60 })
)

describe('pipeline @ 100k rows', () => {
    bench('buildRowNodes', () => {
        buildRowNodes(rows100k, (row) => String(row.id))
    })

    bench('sort by number', () => {
        sortNodes(nodes100k, benchColumns, [{ columnId: 'score', direction: 'asc' }])
    })

    bench('sort by string', () => {
        sortNodes(nodes100k, benchColumns, [{ columnId: 'name', direction: 'asc' }])
    })

    bench('quick filter', () => {
        quickFilterNodes(nodes100k, benchColumns, 'person 12')
    })

    bench('multi-sort (string + number)', () => {
        sortNodes(nodes100k, benchColumns, [
            { columnId: 'name', direction: 'asc' },
            { columnId: 'score', direction: 'desc' }
        ])
    })

    bench('compiled column filters (number between + boolean)', () => {
        const predicate = compileColumnFilters(benchColumns, {
            score: { kind: 'number', op: 'between', value: 100, to: 800 },
            active: { kind: 'boolean', value: true }
        })!
        nodes100k.filter(predicate)
    })

    bench('distinct values', () => {
        distinctValues(nodes100k, benchColumns[0])
    })
})

describe('layout math', () => {
    bench('variableRowLayout build @ 100k', () => {
        variableRowLayout(100_000, (i) => 40 + (i % 3) * 24)
    })

    bench('resolveColumnWidths + prefixSums @ 100 cols', () => {
        prefixSums(resolveColumnWidths(manyColumns, 1600))
    })
})
