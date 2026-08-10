import { describe, expect, it, vi } from 'vitest'
import { createDataGrid, type GridState } from '../../core/grid/grid.svelte.js'
import { SELECTION_COLUMN_ID, type ColumnDef } from '../../core/types/index.js'
import { columnOps, getColumnOps } from '../column-ops/index.js'
import { filtering, getFiltering } from '../filtering/index.js'
import { getSorting, sorting } from '../sorting/index.js'
import { getSelection, selection } from './index.js'
import type { SelectionOptions } from './selection.types.js'

interface Person {
    id: number
    name: string
    dept: string
    active: boolean
}

const people: Person[] = [
    { id: 1, name: 'Alice', dept: 'Core', active: true },
    { id: 2, name: 'Bob', dept: 'Data', active: false },
    { id: 3, name: 'Carol', dept: 'Core', active: true },
    { id: 4, name: 'Dave', dept: 'Infra', active: false },
    { id: 5, name: 'Erin', dept: 'Core', active: true }
]

const columns: ColumnDef<Person>[] = [
    { id: 'name', header: 'Name', sortable: true, filter: 'text' },
    { id: 'dept', header: 'Dept', filter: 'set' },
    { id: 'active', header: 'Active' }
]

function createGrid(options: SelectionOptions<Person> = {}): GridState<Person> {
    return createDataGrid<Person>({
        columns,
        data: people,
        getRowId: (person) => String(person.id),
        features: [filtering(), sorting(), columnOps(), selection(options)]
    })
}

describe('Selection', () => {
    it('toggles rows, tracks count and exposes rows in view order', () => {
        const grid = createGrid()
        const state = getSelection(grid)!

        state.toggle('3')
        state.toggle('1')
        expect(state.isSelected('1')).toBe(true)
        expect(state.count).toBe(2)
        expect(state.getSelectedRows().map((row) => row.name)).toEqual(['Alice', 'Carol'])

        state.toggle('1')
        expect(state.count).toBe(1)
    })

    it('keeps a single row in single mode', () => {
        const grid = createGrid({ mode: 'single' })
        const state = getSelection(grid)!

        state.select('1')
        state.select('2')
        expect([...state.selectedIds]).toEqual(['2'])

        state.selectAll()
        expect(state.count).toBe(1)
    })

    it('selects a shift range from the anchor in current view order', () => {
        const grid = createGrid()
        const state = getSelection(grid)!

        state.toggle('2')
        state.toggleWithModifiers('4', { shift: true })
        expect([...state.selectedIds].toSorted()).toEqual(['2', '3', '4'])
    })

    it('ranges follow the sorted order, not the data order', () => {
        const grid = createGrid()
        const state = getSelection(grid)!
        getSorting(grid)!.setSort([{ columnId: 'name', direction: 'desc' }])

        state.toggle('5')
        state.selectRangeTo('3')
        expect([...state.selectedIds].toSorted()).toEqual(['3', '4', '5'])
    })

    it('select-all targets filtered rows and reports allState for the header checkbox', () => {
        const grid = createGrid()
        const state = getSelection(grid)!
        expect(state.allState).toBe('none')

        getFiltering(grid)!.setColumnFilter('dept', { kind: 'set', values: ['Core'] })
        state.selectAll()
        expect(state.count).toBe(3)
        expect(state.allState).toBe('all')

        getFiltering(grid)!.setColumnFilter('dept', null)
        expect(state.allState).toBe('some')
    })

    it('keeps selection across filters and restores visibility', () => {
        const grid = createGrid()
        const state = getSelection(grid)!

        state.select('2')
        getFiltering(grid)!.setColumnFilter('dept', { kind: 'set', values: ['Core'] })
        expect(state.getSelectedRows()).toHaveLength(0)
        expect(state.count).toBe(1)

        getFiltering(grid)!.setColumnFilter('dept', null)
        expect(state.getSelectedRows().map((row) => row.name)).toEqual(['Bob'])
    })

    it('respects isRowSelectable in toggle, range and select-all', () => {
        const grid = createGrid({ isRowSelectable: (row) => row.active })
        const state = getSelection(grid)!

        state.toggle('2')
        expect(state.count).toBe(0)

        state.toggle('1')
        state.selectRangeTo('5')
        expect([...state.selectedIds].toSorted()).toEqual(['1', '3', '5'])
        expect(state.allState).toBe('all')
    })

    it('toggleAll flips between all and none', () => {
        const grid = createGrid()
        const state = getSelection(grid)!

        state.toggleAll()
        expect(state.allState).toBe('all')
        state.toggleAll()
        expect(state.count).toBe(0)
    })

    it('toggleAll leaves the rows it does not speak for alone', () => {
        const grid = createGrid()
        const state = getSelection(grid)!

        // The header checkbox reports on the rows in view, so toggling it must
        // add and remove those rows rather than replace the whole selection —
        // under a filter here, and one page of a server model in a real app.
        state.select('2')
        getFiltering(grid)!.setColumnFilter('dept', { kind: 'set', values: ['Core'] })

        state.toggleAll()
        expect([...state.selectedIds].toSorted()).toEqual(['1', '2', '3', '5'])
        expect(state.allState).toBe('all')

        state.toggleAll()
        expect([...state.selectedIds]).toEqual(['2'])
    })

    it('clear drops the whole selection, view or no view', () => {
        const grid = createGrid()
        const state = getSelection(grid)!

        state.select('2')
        getFiltering(grid)!.setColumnFilter('dept', { kind: 'set', values: ['Core'] })
        state.select('1')
        state.clear()

        expect(state.count).toBe(0)
    })

    it('emits selectionChanged with the id payload', () => {
        const grid = createGrid()
        const handler = vi.fn()
        grid.events.on('selectionChanged', handler)

        getSelection(grid)!.select('1')
        expect(handler).toHaveBeenCalledWith({ selectedIds: ['1'] })

        getSelection(grid)!.clear()
        expect(handler).toHaveBeenLastCalledWith({ selectedIds: [] })
    })

    it('builds TSV from the selection and honors the headers option', () => {
        const grid = createGrid()
        const state = getSelection(grid)!

        expect(state.copyText()).toBeNull()

        state.select('1')
        state.select('3')
        expect(state.copyText()).toBe('Alice\tCore\ttrue\nCarol\tCore\ttrue')
        expect(state.copyText({ headers: true })).toBe(
            'Name\tDept\tActive\nAlice\tCore\ttrue\nCarol\tCore\ttrue'
        )
    })

    it('announces selection and copy counts', () => {
        const grid = createGrid()
        getSelection(grid)!.select('1')
        expect(grid.announcer.message).toBe('1 row selected')

        getSelection(grid)!.select('3')
        expect(grid.announcer.message).toBe('2 rows selected')

        grid.events.emit('rowsCopied', { count: 3 })
        expect(grid.announcer.message).toBe('3 rows copied')

        grid.events.emit('rowsCopied', { count: 1 })
        expect(grid.announcer.message).toBe('1 row copied')
    })
})

describe('selection keybindings', () => {
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

    it('Space toggles and Shift+Space range-selects the focused row', () => {
        const grid = createGrid()
        const state = getSelection(grid)!

        grid.focus.focusCell({ row: 1, col: 0 })
        grid.focus.handleKeydown(keydown(' '))
        expect([...state.selectedIds]).toEqual(['2'])

        grid.focus.focusCell({ row: 3, col: 0 })
        grid.focus.handleKeydown(keydown(' ', { shiftKey: true }))
        expect([...state.selectedIds].toSorted()).toEqual(['2', '3', '4'])
    })

    it('Ctrl+A selects all selectable rows', () => {
        const grid = createGrid()
        grid.focus.focusCell({ row: 0, col: 0 })
        grid.focus.handleKeydown(keydown('a', { ctrlKey: true }))
        expect(getSelection(grid)!.count).toBe(5)
    })
})

describe('synthetic selection column', () => {
    it('prepends a pinned checkbox column excluded from ops and snapshots', () => {
        const grid = createGrid()
        const ops = getColumnOps(grid)!

        expect(grid.columns.visible[0].id).toBe(SELECTION_COLUMN_ID)
        expect(grid.columns.visible[0].pinned).toBe('left')

        expect(ops.moveColumn(SELECTION_COLUMN_ID, 2)).toBe(-1)
        ops.pinColumn(SELECTION_COLUMN_ID, 'right')
        ops.setColumnHidden(SELECTION_COLUMN_ID, true)
        expect(grid.columns.visible[0].id).toBe(SELECTION_COLUMN_ID)
        expect(grid.columns.visible[0].pinned).toBe('left')

        // Move a real column so the snapshot has an order to inspect at all.
        ops.moveColumn('dept', 1)
        const snapshot = grid.getState().columns!
        expect(snapshot.order).not.toContain(SELECTION_COLUMN_ID)
        expect(snapshot.pinned ?? {}).not.toHaveProperty(SELECTION_COLUMN_ID)
    })

    it('keeps the selection column first when other columns move', () => {
        const grid = createGrid()
        const ops = getColumnOps(grid)!

        ops.moveColumn('dept', 1)
        expect(grid.columns.visible.map((column) => column.id)).toEqual([
            SELECTION_COLUMN_ID,
            'dept',
            'name',
            'active'
        ])
    })

    it('is absent without the selection feature', () => {
        const grid = createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (person) => String(person.id),
            features: [sorting()]
        })
        expect(grid.columns.visible.map((column) => column.id)).toEqual(['name', 'dept', 'active'])
    })
})
