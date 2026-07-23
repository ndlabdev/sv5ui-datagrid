import { describe, expect, it } from 'vitest'
import { createDataGrid, type GridState } from '../../core/grid/grid.svelte.js'
import type { ColumnDef } from '../../core/types/index.js'
import { parseClipboardMatrix } from './edit-batch.js'
import { editing, getEditing } from './index.js'

interface Person {
    id: number
    name: string
    age: number
    dept: string
    active: boolean
}

function people(): Person[] {
    return [
        { id: 1, name: 'Alice', age: 30, dept: 'Core', active: true },
        { id: 2, name: 'Bob', age: 25, dept: 'Data', active: true },
        { id: 3, name: 'Carol', age: 45, dept: 'Core', active: false }
    ]
}

const columns: ColumnDef<Person>[] = [
    { id: 'name', editable: true },
    { id: 'age', editable: true, parse: (input) => Number(input) },
    { id: 'dept', editable: (ctx) => ctx.row.active }
]

function grid(): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people(),
        getRowId: (person) => String(person.id),
        features: [editing()]
    })
}

describe('parseClipboardMatrix', () => {
    it('splits rows on newlines and cells on tabs', () => {
        expect(parseClipboardMatrix('a\tb\nc\td')).toEqual([
            ['a', 'b'],
            ['c', 'd']
        ])
    })

    it('drops one trailing newline and normalizes CRLF', () => {
        expect(parseClipboardMatrix('a\tb\r\nc\td\r\n')).toEqual([
            ['a', 'b'],
            ['c', 'd']
        ])
    })

    it('treats a plain value as a single cell', () => {
        expect(parseClipboardMatrix('hello')).toEqual([['hello']])
    })

    it('is empty for empty text', () => {
        expect(parseClipboardMatrix('')).toEqual([])
    })
})

describe('pasteText', () => {
    it('fills from the focused cell rightward and downward', () => {
        const g = grid()
        const edit = getEditing(g)!
        g.focus.focusCell({ row: 0, col: 0 })

        edit.pasteText('Alicia\t31\nBobby\t26')

        expect(g.data[0]).toMatchObject({ name: 'Alicia', age: 31 })
        expect(g.data[1]).toMatchObject({ name: 'Bobby', age: 26 })
        // `parse` ran, so ages are numbers, not the pasted strings.
        expect(typeof g.data[0].age).toBe('number')
    })

    it('lands the whole paste as one undo step', () => {
        const g = grid()
        const edit = getEditing(g)!
        g.focus.focusCell({ row: 0, col: 0 })

        edit.pasteText('Alicia\t31\nBobby\t26')
        expect(edit.canUndo).toBe(true)
        edit.undo()

        expect(g.data[0]).toMatchObject({ name: 'Alice', age: 30 })
        expect(g.data[1]).toMatchObject({ name: 'Bob', age: 25 })
    })

    it('skips cells on a non-editable column', () => {
        const g = grid()
        const edit = getEditing(g)!
        // Carol (row 2) is inactive, so her dept column is not editable.
        g.focus.focusCell({ row: 2, col: 2 })
        edit.pasteText('Ops')

        expect(g.data[2].dept).toBe('Core')
    })

    it('stops at the last row instead of creating rows', () => {
        const g = grid()
        const edit = getEditing(g)!
        g.focus.focusCell({ row: 2, col: 0 })
        edit.pasteText('X\nY\nZ')

        expect(g.data).toHaveLength(3)
        expect(g.data[2].name).toBe('X')
    })

    it('does nothing when focus is on the header', () => {
        const g = grid()
        const edit = getEditing(g)!
        g.focus.focusCell({ row: -1, col: 0 })
        expect(edit.pasteText('X')).toBe(false)
        expect(g.data[0].name).toBe('Alice')
    })
})
