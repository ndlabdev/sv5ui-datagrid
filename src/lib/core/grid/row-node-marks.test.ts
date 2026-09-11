import { describe, expect, it } from 'vitest'
import type { RowNode } from '../types/index.js'
import {
    isDataRow,
    isLoadingRow,
    isSyntheticRow,
    LOADING_KEY,
    markSyntheticRow
} from './row-node.js'

interface Row {
    id: number
    name: string
}

const nodeOf = (row: unknown, meta?: RowNode<Row>['meta']): RowNode<Row> =>
    ({ id: '1', row, index: 0, meta }) as RowNode<Row>

describe('isDataRow', () => {
    it('takes an ordinary row', () => {
        expect(isDataRow(nodeOf({ id: 1, name: 'Ann' }))).toBe(true)
    })

    it('takes a row a structural feature nested rather than listed', () => {
        expect(isDataRow(nodeOf({ id: 2, name: 'child' }, { level: 1 }))).toBe(true)
    })

    it('leaves out a row a feature synthesized', () => {
        expect(isDataRow(nodeOf(markSyntheticRow({ id: 0, name: 'Total' })))).toBe(false)
    })

    it('leaves out a placeholder waiting on a server', () => {
        expect(isDataRow(nodeOf({ id: -1, [LOADING_KEY]: true }))).toBe(false)
    })

    it('leaves out a full-width row, which is a panel rather than a row of values', () => {
        expect(isDataRow(nodeOf({ id: 1, name: 'Ann' }, { fullWidth: true }))).toBe(false)
    })
})

describe('markSyntheticRow', () => {
    it('marks a copy rather than the row it was given', () => {
        const row = { id: 1, name: 'Ann' }
        expect(isSyntheticRow(markSyntheticRow(row))).toBe(true)
        expect(isSyntheticRow(row)).toBe(false)
    })
})

describe('isLoadingRow', () => {
    it('says no for null, which a grid holds while it has nothing', () => {
        expect(isLoadingRow(null)).toBe(false)
    })
})
