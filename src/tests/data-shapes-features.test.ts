import { describe, expect, it } from 'vitest'
import type { ColumnDef, ColumnFilterEntry, GridSnapshot } from '$lib/index.js'
import { createDataGrid, filtering, getFiltering, sorting } from '$lib/index.js'
import { buildRowNodes } from '../lib/core/grid/index.js'
import { createColumnState } from '../lib/core/columns/index.js'
import { sortNodes } from '../lib/features/sorting/sort.js'
import { compileColumnFilters } from '../lib/features/filtering/filter-predicates.js'
import { rowsToMatrix, toCsv } from '../lib/features/selection/clipboard.js'

/**
 * The features that read a value, against the shapes an API delivers. The
 * matrix beside this one asks what a cell draws; this one asks whether the
 * rest of the grid agrees with it.
 */
interface Row {
    id: string
    value: unknown
}

const rowsOf = (values: unknown[]) =>
    buildRowNodes(
        values.map((value, index) => ({ id: String(index + 1), value })),
        (row) => row.id
    )

const JAN_10 = new Date(2024, 0, 10)
const JUN_01 = new Date(2024, 5, 1)

describe('sorting a date column, whatever form the dates arrived in', () => {
    const column: ColumnDef<Row> = { id: 'value', type: 'date', sortable: true }
    const ascending = [{ columnId: 'value', direction: 'asc' as const }]

    const order = (values: unknown[]) =>
        sortNodes(rowsOf(values), [column], ascending).map((node) => node.id)

    it('orders Date objects', () => {
        expect(order([JUN_01, JAN_10])).toEqual(['2', '1'])
    })

    it('orders plain date strings', () => {
        expect(order(['2024-06-01', '2024-01-10'])).toEqual(['2', '1'])
    })

    it('orders epoch numbers', () => {
        expect(order([JUN_01.getTime(), JAN_10.getTime()])).toEqual(['2', '1'])
    })

    it('orders Date objects mixed with strings', () => {
        expect(order(['2024-06-01', JAN_10])).toEqual(['2', '1'])
    })

    it('orders epoch numbers mixed with strings', () => {
        expect(order(['2024-06-01', JAN_10.getTime()])).toEqual(['2', '1'])
    })

    it('puts holes together whichever kind they are', () => {
        expect(order([JUN_01, null, JAN_10, undefined, ''])).toEqual(['2', '4', '5', '3', '1'])
    })
})

describe('sorting a number column that arrived as text', () => {
    const column: ColumnDef<Row> = { id: 'value', type: 'number', sortable: true }

    it('orders numbers written as strings', () => {
        const sorted = sortNodes(
            rowsOf(['10', '9', '100']),
            [column],
            [{ columnId: 'value', direction: 'asc' }]
        )
        expect(sorted.map((node) => node.row.value)).toEqual(['9', '10', '100'])
    })

    it('orders numbers mixed with numbers written as strings', () => {
        const sorted = sortNodes(
            rowsOf([10, '9', 100]),
            [column],
            [{ columnId: 'value', direction: 'asc' }]
        )
        expect(sorted.map((node) => node.row.value)).toEqual(['9', 10, 100])
    })
})

describe('a column filter finds the row by what the cell draws', () => {
    function found(column: ColumnDef<Row>, values: unknown[], filter: ColumnFilterEntry): number {
        const predicate = compileColumnFilters([column], { value: filter })!
        return rowsOf(values).filter(predicate).length
    }

    it('date: a Date object, by its day', () => {
        const column: ColumnDef<Row> = { id: 'value', type: 'date', filter: 'date' }
        expect(found(column, [JAN_10], { kind: 'date', op: 'equals', value: '2024-01-10' })).toBe(1)
    })

    it('date: an epoch number, by its day', () => {
        const column: ColumnDef<Row> = { id: 'value', type: 'date', filter: 'date' }
        expect(
            found(column, [JAN_10.getTime()], { kind: 'date', op: 'equals', value: '2024-01-10' })
        ).toBe(1)
    })

    it('number: a number that arrived as text', () => {
        const column: ColumnDef<Row> = { id: 'value', type: 'number', filter: 'number' }
        expect(found(column, ['1234.5'], { kind: 'number', op: 'eq', value: 1234.5 })).toBe(1)
    })

    it('text: a number, searched as the text it draws', () => {
        const column: ColumnDef<Row> = { id: 'value', type: 'number', filter: 'text' }
        expect(found(column, [1234.5], { kind: 'text', op: 'contains', value: '1234' })).toBe(1)
    })

    it('set: a Date object among the values it offers', () => {
        const column: ColumnDef<Row> = { id: 'value', type: 'date', filter: 'set' }
        expect(found(column, [JAN_10, JUN_01], { kind: 'set', values: [JAN_10 as never] })).toBe(1)
    })
})

describe('a filter survives being written to a snapshot and read back', () => {
    function roundTrip(column: ColumnDef<Row>, values: unknown[], filter: ColumnFilterEntry) {
        const grid = createDataGrid<Row>({
            columns: [column],
            data: values.map((value, index) => ({ id: String(index + 1), value })),
            getRowId: (row) => row.id,
            features: [filtering(), sorting()]
        })
        getFiltering(grid)!.setColumnFilter('value', filter)
        const before = grid.nodes.length

        // What `persistState` does: through JSON and back, not by reference.
        const snapshot = JSON.parse(JSON.stringify(grid.api.getState())) as GridSnapshot

        const restored = createDataGrid<Row>({
            columns: [column],
            data: values.map((value, index) => ({ id: String(index + 1), value })),
            getRowId: (row) => row.id,
            features: [filtering(), sorting()]
        })
        restored.api.setState(snapshot)
        return { before, after: restored.nodes.length }
    }

    it('keeps a number filter', () => {
        const column: ColumnDef<Row> = { id: 'value', type: 'number', filter: 'number' }
        const { before, after } = roundTrip(column, [1, 2, 3], {
            kind: 'number',
            op: 'eq',
            value: 2
        })
        expect(after).toBe(before)
    })

    it('keeps a date filter', () => {
        const column: ColumnDef<Row> = { id: 'value', type: 'date', filter: 'date' }
        const { before, after } = roundTrip(column, [JAN_10, JUN_01], {
            kind: 'date',
            op: 'equals',
            value: '2024-01-10'
        })
        expect(after).toBe(before)
    })

    it('keeps a set filter over Date objects', () => {
        const column: ColumnDef<Row> = { id: 'value', type: 'date', filter: 'set' }
        const { before, after } = roundTrip(column, [JAN_10, JUN_01], {
            kind: 'set',
            values: [JAN_10 as never]
        })
        expect(after).toBe(before)
    })
})

describe('an export carries the options it was given', () => {
    const column = createColumnState<Row>({ id: 'value', header: 'Value' })

    it('quotes a cell holding the delimiter in use', () => {
        const csv = toCsv(rowsToMatrix(rowsOf(['Hanoi, VN']), [column]), ',')
        expect(csv).toBe('"Hanoi, VN"')
    })

    it('leaves a comma alone in a semicolon file', () => {
        const csv = toCsv(rowsToMatrix(rowsOf(['Hanoi, VN']), [column]), ';')
        expect(csv).toBe('Hanoi, VN')
    })

    it('keeps a newline inside its quotes', () => {
        const csv = toCsv(rowsToMatrix(rowsOf(['a\nb']), [column]))
        expect(csv).toBe('"a\nb"')
    })

    it('refuses to hand a spreadsheet a formula', () => {
        for (const attack of ['=1+1', '+1', '-1', '@SUM(A1)']) {
            expect(toCsv(rowsToMatrix(rowsOf([attack]), [column]))).toContain(`'${attack}`)
        }
    })

    it('doubles a quote rather than losing it', () => {
        const csv = toCsv(rowsToMatrix(rowsOf(['say "hi"']), [column]))
        expect(csv).toBe('"say ""hi"""')
    })
})
