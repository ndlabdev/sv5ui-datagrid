import { createDataGrid } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { editing } from '../../features/editing/index.js'
import { describe, expect, it } from 'vitest'
import { formula } from './formula.svelte.js'

interface Row {
    id: number
    a: number
    b: number
    total?: number
    note?: string
}

function grid(editable: boolean | undefined, data?: Row[]) {
    const columns: ColumnDef<Row>[] = [
        { id: 'a', header: 'A', editable: true },
        { id: 'b', header: 'B' },
        { id: 'total', header: 'Total', editable },
        { id: 'note', header: 'Note', editable: true }
    ]

    return createDataGrid<Row>({
        columns,
        data: data ?? [{ id: 1, a: 2, b: 3 }],
        getRowId: (row) => String(row.id),
        features: [editing(), formula<Row>({ columns: { total: 'a * b' } })]
    })
}

describe('a formula column the app left open for editing', () => {
    it('takes no write, and leaves nothing behind in the row', () => {
        const built = grid(true)
        void built.preWindowNodes

        built.api.applyEdits?.([{ rowId: '1', changes: { total: 999 } }])

        expect(built.data[0]!.total).toBeUndefined()
        expect(built.preWindowNodes[0]?.row.total).toBe(6)
    })

    it('opens no editor on it', () => {
        const built = grid(true)
        void built.preWindowNodes

        built.api.startEditing?.('1', 'total')

        expect(built.api.getEditingCell?.()).toBeNull()
    })

    it('still writes the plain columns in the same batch', () => {
        const built = grid(true)
        void built.preWindowNodes

        built.api.applyEdits?.([{ rowId: '1', changes: { total: 999, note: 'kept' } }])

        expect(built.data[0]!.note).toBe('kept')
        expect(built.data[0]!.total).toBeUndefined()
    })

    it('refuses the write whatever the formula computed, blank included', () => {
        const built = createDataGrid<Row>({
            columns: [
                { id: 'a', header: 'A' },
                { id: 'b', header: 'B' },
                { id: 'total', header: 'Total', editable: true }
            ],
            data: [{ id: 1, a: 2, b: 3 }],
            getRowId: (row) => String(row.id),
            features: [
                editing(),
                formula<Row>({ columns: { total: { expression: 'nope(', onError: 'blank' } } })
            ]
        })
        void built.preWindowNodes

        built.api.applyEdits?.([{ rowId: '1', changes: { total: 999 } }])

        expect(built.data[0]!.total).toBeUndefined()
    })

    it('leaves a column with no formula on it editable', () => {
        const built = grid(undefined)
        void built.preWindowNodes

        built.api.applyEdits?.([{ rowId: '1', changes: { a: 7 } }])

        expect(built.data[0]!.a).toBe(7)
    })
})
