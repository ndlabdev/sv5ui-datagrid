import { describe, expect, it } from 'vitest'
import type { ColumnDef } from '$lib/index.js'
import { createDataGrid, editing, getEditing, sorting } from '$lib/index.js'
import { toDateValue } from '../lib/components/internal/index.js'
import { sortNodes } from '../lib/features/sorting/index.js'
import { buildRowNodes } from '../lib/core/grid/index.js'

interface Row {
    id: string
    when: unknown
    amount: unknown
}

const JAN_10 = new Date(2024, 0, 10)

function gridOf(columns: ColumnDef<Row>[], rows: Row[]) {
    return createDataGrid<Row>({
        columns,
        data: rows,
        getRowId: (row) => row.id,
        features: [editing(), sorting()]
    })
}

describe('an editor opens on the value its cell is showing', () => {
    it('reads a plain date string', () => {
        expect(toDateValue('2024-01-10')?.toString()).toBe('2024-01-10')
    })

    it('reads a timestamp string', () => {
        expect(toDateValue('2024-01-10T09:30:00Z')?.toString()).toBe('2024-01-10')
    })

    it('reads a Date object', () => {
        expect(toDateValue(JAN_10)?.toString()).toBe('2024-01-10')
    })

    it('reads an epoch number', () => {
        expect(toDateValue(JAN_10.getTime())?.toString()).toBe('2024-01-10')
    })
})

describe('a commit leaves the row usable by the rest of the grid', () => {
    const columns: ColumnDef<Row>[] = [
        { id: 'when', type: 'date', editor: 'date', editable: true, sortable: true },
        { id: 'amount', type: 'number', editor: 'number', editable: true, sortable: true }
    ]

    it('writes a date the column still orders as a date', () => {
        const grid = gridOf(columns, [
            { id: '1', when: new Date(2024, 5, 1), amount: 1 },
            { id: '2', when: new Date(2024, 0, 10), amount: 2 }
        ])
        const state = getEditing(grid)!
        state.startEdit('1', 'when')
        state.setDraft('2023-01-01')
        state.commit()

        const sorted = sortNodes(grid.preWindowNodes, grid.columns.leafDefs, [
            { columnId: 'when', direction: 'asc' }
        ])
        expect(sorted.map((node) => node.id)).toEqual(['1', '2'])
    })

    it('writes a number rather than the text that was typed', () => {
        const grid = gridOf(columns, [{ id: '1', when: JAN_10, amount: 5 }])
        const state = getEditing(grid)!
        state.startEdit('1', 'amount')
        state.setDraft(42)
        state.commit()
        expect(grid.data[0].amount).toBe(42)
    })

    it('orders a column edited through the keyboard against one that was not', () => {
        const grid = gridOf(columns, [
            { id: '1', when: JAN_10, amount: 10 },
            { id: '2', when: JAN_10, amount: 9 },
            { id: '3', when: JAN_10, amount: 100 }
        ])
        const state = getEditing(grid)!
        state.startEdit('2', 'amount')
        state.setDraft(90)
        state.commit()

        const sorted = sortNodes(grid.preWindowNodes, grid.columns.leafDefs, [
            { columnId: 'amount', direction: 'asc' }
        ])
        expect(sorted.map((node) => node.row.amount)).toEqual([10, 90, 100])
    })
})

describe('pasting spreads text into the columns it lands on', () => {
    const columns: ColumnDef<Row>[] = [
        { id: 'when', type: 'date', editable: true, sortable: true },
        { id: 'amount', type: 'number', editable: true, sortable: true }
    ]

    it('leaves a number column holding numbers', () => {
        const grid = gridOf(columns, [{ id: '1', when: JAN_10, amount: 5 }])
        grid.focus.focusCell({ row: 0, col: 1 })
        getEditing(grid)!.pasteText('42')
        expect(grid.data[0].amount).toBe(42)
    })

    it('leaves the column ordering as numbers after a paste', () => {
        const grid = gridOf(columns, [
            { id: '1', when: JAN_10, amount: 10 },
            { id: '2', when: JAN_10, amount: 9 }
        ])
        grid.focus.focusCell({ row: 0, col: 1 })
        getEditing(grid)!.pasteText('100')

        const sorted = sortNodes(grid.preWindowNodes, grid.columns.leafDefs, [
            { columnId: 'amount', direction: 'asc' }
        ])
        expect(sorted.map((node) => node.row.amount)).toEqual([9, 100])
    })
})

describe('undo puts back what was there', () => {
    it('restores a Date object, not the text that replaced it', () => {
        const columns: ColumnDef<Row>[] = [
            { id: 'when', type: 'date', editor: 'date', editable: true, sortable: true }
        ]
        const grid = gridOf(columns, [{ id: '1', when: JAN_10, amount: 1 }])
        const state = getEditing(grid)!
        state.startEdit('1', 'when')
        state.setDraft('2023-01-01')
        state.commit()
        state.undo()

        expect(grid.data[0].when).toBeInstanceOf(Date)
        expect((grid.data[0].when as Date).getTime()).toBe(JAN_10.getTime())
    })
})

describe('sorting a column where one row was edited and the others were not', () => {
    it('keeps every form of a date in one order', () => {
        const nodes = buildRowNodes<Row>(
            [
                { id: '1', when: new Date(2024, 5, 1), amount: 0 },
                { id: '2', when: '2024-01-10', amount: 0 },
                { id: '3', when: new Date(2024, 2, 15), amount: 0 }
            ],
            (row) => row.id
        )
        const sorted = sortNodes(
            nodes,
            [{ id: 'when', type: 'date', sortable: true }],
            [{ columnId: 'when', direction: 'asc' }]
        )
        expect(sorted.map((node) => node.id)).toEqual(['2', '3', '1'])
    })
})
