import type { StandardSchemaV1 } from '@standard-schema/spec'
import { describe, expect, it, vi } from 'vitest'
import { createDataGrid, type GridState } from '../../core/grid.svelte.js'
import type { ColumnDef } from '../../core/types.js'
import { editing, getEditing } from './index.js'
import type { EditingOptions } from './editing.types.js'

interface Person {
    id: number
    name: string
    age: number
    dept: string
    active: boolean
}

const minLen: StandardSchemaV1 = {
    '~standard': {
        version: 1,
        vendor: 'test',
        validate: (value: unknown) =>
            String(value).trim().length >= 2
                ? { value: String(value).trim() }
                : { issues: [{ message: 'Too short' }] }
    }
}

function people(): Person[] {
    return [
        { id: 1, name: 'Alice', age: 30, dept: 'Core', active: true },
        { id: 2, name: 'Bob', age: 25, dept: 'Data', active: false },
        { id: 3, name: 'Carol', age: 45, dept: 'Core', active: true }
    ]
}

const columns: ColumnDef<Person>[] = [
    { id: 'name', editable: true, schema: minLen },
    { id: 'age', editable: true, editor: 'number', parse: (input) => Number(input) },
    { id: 'dept', editable: (ctx) => ctx.row.active, editor: 'select' },
    { id: 'active', editor: 'checkbox' }
]

function createGrid(options: EditingOptions = {}): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people(),
        getRowId: (person) => String(person.id),
        features: [editing(options)]
    })
}

describe('Editing — cell mode', () => {
    it('seeds the draft on startEdit and commits a valid value', () => {
        const grid = createGrid()
        const state = getEditing(grid)!
        const events: unknown[] = []
        grid.events.on('cellEdited', (payload) => events.push(payload))

        state.startEdit('1', 'name')
        expect(state.draft).toBe('Alice')

        state.setDraft('Alicia')
        expect(state.commit()).toBe(true)
        expect(grid.data[0].name).toBe('Alicia')
        expect(state.active).toBeNull()
        expect(events).toEqual([
            { rowId: '1', columnId: 'name', oldValue: 'Alice', newValue: 'Alicia' }
        ])
    })

    it('blocks an invalid commit, keeps editing and sets the error', () => {
        const grid = createGrid()
        const state = getEditing(grid)!

        state.startEdit('1', 'name')
        state.setDraft('x')
        expect(state.commit()).toBe(false)
        expect(state.error).toBe('Too short')
        expect(state.active).toEqual({ rowId: '1', columnId: 'name' })
        expect(grid.data[0].name).toBe('Alice')
        expect(grid.announcer.message).toBe('Too short')
    })

    it('parses editor output before writing', () => {
        const grid = createGrid()
        const state = getEditing(grid)!
        state.startEdit('2', 'age')
        state.setDraft('40')
        state.commit()
        expect(grid.data[1].age).toBe(40)
    })

    it('respects an editable predicate', () => {
        const grid = createGrid()
        const state = getEditing(grid)!
        state.startEdit('2', 'dept')
        expect(state.active).toBeNull()

        state.startEdit('1', 'dept')
        expect(state.active).toEqual({ rowId: '1', columnId: 'dept' })
    })

    it('cancels without writing', () => {
        const grid = createGrid()
        const state = getEditing(grid)!
        state.startEdit('1', 'name')
        state.setDraft('Zzz')
        state.cancel()
        expect(state.active).toBeNull()
        expect(grid.data[0].name).toBe('Alice')
    })

    it('type-to-edit seeds the draft with the typed character', () => {
        const grid = createGrid()
        const state = getEditing(grid)!
        state.startEditWith('1', 'name', 'Q')
        expect(state.draft).toBe('Q')
    })

    it('commitAndMove writes then moves focus down/right', () => {
        const grid = createGrid()
        const state = getEditing(grid)!
        grid.focus.focusCell({ row: 0, col: 0 })

        state.startEdit('1', 'name')
        state.setDraft('Alan')
        state.commitAndMove('down')
        expect(grid.data[0].name).toBe('Alan')
        expect(grid.focus.active).toEqual({ row: 1, col: 0 })
    })

    it('awaits async schemas before applying', async () => {
        const asyncSchema: StandardSchemaV1 = {
            '~standard': {
                version: 1,
                vendor: 'test',
                validate: (value: unknown) =>
                    Promise.resolve(value === 'bad' ? { issues: [{ message: 'no' }] } : { value })
            }
        }
        const grid = createDataGrid<Person>({
            columns: [{ id: 'name', editable: true, schema: asyncSchema }],
            data: people(),
            getRowId: (person) => String(person.id),
            features: [editing()]
        })
        const state = getEditing(grid)!
        state.startEdit('1', 'name')
        state.setDraft('good')
        await state.commit()
        expect(grid.data[0].name).toBe('good')
    })
})

describe('Editing — undo/redo', () => {
    it('undoes and redoes a committed edit', () => {
        const grid = createGrid()
        const state = getEditing(grid)!

        state.startEdit('1', 'name')
        state.setDraft('Alicia')
        state.commit()
        expect(state.canUndo).toBe(true)

        state.undo()
        expect(grid.data[0].name).toBe('Alice')
        expect(state.canRedo).toBe(true)

        state.redo()
        expect(grid.data[0].name).toBe('Alicia')
    })

    it('truncates redo after a fresh edit', () => {
        const grid = createGrid()
        const state = getEditing(grid)!

        state.startEdit('1', 'name')
        state.setDraft('Alicia')
        state.commit()
        state.undo()

        state.startEdit('2', 'name')
        state.setDraft('Bobby')
        state.commit()
        expect(state.canRedo).toBe(false)
        expect(grid.data[0].name).toBe('Alice')
        expect(grid.data[1].name).toBe('Bobby')
    })
})

describe('Editing — applyEdits', () => {
    it('writes many cells across rows as one undo step', () => {
        const grid = createGrid()
        const state = getEditing(grid)!
        const events: unknown[] = []
        grid.events.on('cellEdited', (payload) => events.push(payload))

        expect(
            state.applyEdits([
                { rowId: '1', changes: { name: 'Alina', age: 31 } },
                { rowId: '2', changes: { name: 'Bobby' } }
            ])
        ).toBe(true)

        expect(grid.data[0]).toMatchObject({ name: 'Alina', age: 31 })
        expect(grid.data[1].name).toBe('Bobby')
        expect(events).toHaveLength(3)

        state.undo()
        expect(grid.data[0]).toMatchObject({ name: 'Alice', age: 30 })
        expect(grid.data[1].name).toBe('Bob')

        state.redo()
        expect(grid.data[0].name).toBe('Alina')
        expect(grid.data[1].name).toBe('Bobby')
    })

    it('runs each column parse and validation', () => {
        const grid = createGrid()
        getEditing(grid)!.applyEdits([{ rowId: '2', changes: { age: '44' } }])
        expect(grid.data[1].age).toBe(44)
    })

    it('rejects the whole batch when one cell is invalid', () => {
        const grid = createGrid()
        const state = getEditing(grid)!

        expect(
            state.applyEdits([
                { rowId: '1', changes: { name: 'Fine' } },
                { rowId: '2', changes: { name: 'x' } }
            ])
        ).toBe(false)
        expect(grid.data[0].name).toBe('Alice')
        expect(state.error).toBe('Too short')
        expect(state.canUndo).toBe(false)
    })

    it('skips unknown rows and non-editable columns', () => {
        const grid = createGrid()
        const state = getEditing(grid)!

        expect(state.applyEdits([{ rowId: 'nope', changes: { name: 'X' } }])).toBe(false)
        // `active` is not editable on this column set
        expect(state.applyEdits([{ rowId: '1', changes: { active: false } }])).toBe(false)
        expect(grid.data[0].active).toBe(true)
    })
})

describe('Editing — row mode', () => {
    it('edits several cells of a row as one transaction and undo', () => {
        const grid = createGrid({ mode: 'row' })
        const state = getEditing(grid)!
        const rowEvents: unknown[] = []
        grid.events.on('rowEdited', (payload) => rowEvents.push(payload))

        state.startRowEdit('1')
        expect(state.drafts).toMatchObject({ name: 'Alice', age: 30, dept: 'Core' })

        state.setRowDraft('name', 'Alina')
        state.setRowDraft('age', 31)
        expect(state.commitRow()).toBe(true)
        expect(grid.data[0]).toMatchObject({ name: 'Alina', age: 31 })
        expect(rowEvents).toHaveLength(1)

        state.undo()
        expect(grid.data[0]).toMatchObject({ name: 'Alice', age: 30 })
    })

    it('blocks the whole row when one field is invalid', () => {
        const grid = createGrid({ mode: 'row' })
        const state = getEditing(grid)!
        state.startRowEdit('1')
        state.setRowDraft('name', 'x')
        state.setRowDraft('age', 99)
        expect(state.commitRow()).toBe(false)
        expect(state.rowErrors.name).toBe('Too short')
        expect(grid.data[0].age).toBe(30)
    })
})

describe('Editing keybindings', () => {
    function keydown(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
        return {
            key,
            ctrlKey: false,
            metaKey: false,
            altKey: false,
            shiftKey: false,
            preventDefault: vi.fn(),
            ...modifiers
        } as unknown as KeyboardEvent
    }

    it('Enter and F2 start editing an editable focused cell', () => {
        const grid = createGrid()
        grid.focus.focusCell({ row: 0, col: 0 })
        grid.focus.handleKeydown(keydown('F2'))
        expect(getEditing(grid)!.active).toEqual({ rowId: '1', columnId: 'name' })
    })

    it('Enter on a non-editable cell does not start editing', () => {
        const grid = createGrid()
        grid.focus.focusCell({ row: 0, col: 3 })
        grid.focus.handleKeydown(keydown('Enter'))
        expect(getEditing(grid)!.active).toBeNull()
    })

    it('Ctrl+Z undoes and Ctrl+Shift+Z redoes', () => {
        const grid = createGrid()
        const state = getEditing(grid)!
        state.startEdit('1', 'name')
        state.setDraft('Alicia')
        state.commit()

        grid.focus.handleKeydown(keydown('z', { ctrlKey: true }))
        expect(grid.data[0].name).toBe('Alice')
        grid.focus.handleKeydown(keydown('Z', { ctrlKey: true, shiftKey: true }))
        expect(grid.data[0].name).toBe('Alicia')
    })
})
