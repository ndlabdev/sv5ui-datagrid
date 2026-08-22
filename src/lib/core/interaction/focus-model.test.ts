import { describe, expect, it, vi } from 'vitest'
import { filtering } from '../../features/filtering/index.js'
import { pagination } from '../../features/pagination/index.js'
import { getSorting, sorting } from '../../features/sorting/index.js'
import { rowPinning } from '../../features/row-pinning/index.js'
import { FILTER_ROW, HEADER_ROW } from './focus-model.svelte.js'
import { createDataGrid, type GridState } from '../grid/grid.svelte.js'
import type { GridFeature } from '../types/index.js'

interface Person {
    id: number
    name: string
    age: number
}

const people: Person[] = Array.from({ length: 30 }, (_, i) => ({
    id: i + 1,
    name: `Person ${i + 1}`,
    age: 20 + i
}))

function createGrid(features: GridFeature<Person>[] = [sorting()]): GridState<Person> {
    return createDataGrid<Person>({
        columns: [
            { id: 'name', sortable: true },
            { id: 'age', sortable: true }
        ],
        data: people,
        getRowId: (person) => String(person.id),
        features
    })
}

function keyEvent(key: string, modifiers: Partial<KeyboardEvent> = {}): KeyboardEvent {
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

describe('FocusModel', () => {
    it('starts on the first header cell so the grid is always tabbable', () => {
        const grid = createGrid()
        expect(grid.focus.active).toEqual({ row: HEADER_ROW, col: 0 })
    })

    it('moves with arrows and clamps at the edges', () => {
        const grid = createGrid()
        const { focus } = grid

        focus.handleKeydown(keyEvent('ArrowDown'))
        expect(focus.active).toEqual({ row: 0, col: 0 })

        focus.handleKeydown(keyEvent('ArrowRight'))
        expect(focus.active).toEqual({ row: 0, col: 1 })

        focus.handleKeydown(keyEvent('ArrowRight'))
        expect(focus.active).toEqual({ row: 0, col: 1 })

        focus.handleKeydown(keyEvent('ArrowUp'))
        focus.handleKeydown(keyEvent('ArrowUp'))
        expect(focus.active).toEqual({ row: HEADER_ROW, col: 1 })
    })

    it('supports Home/End within a row and Ctrl+Home/End across the grid', () => {
        const grid = createGrid()
        const { focus } = grid

        focus.focusCell({ row: 5, col: 1 })
        focus.handleKeydown(keyEvent('Home'))
        expect(focus.active).toEqual({ row: 5, col: 0 })

        focus.handleKeydown(keyEvent('End'))
        expect(focus.active).toEqual({ row: 5, col: 1 })

        focus.handleKeydown(keyEvent('Home', { ctrlKey: true }))
        expect(focus.active).toEqual({ row: 0, col: 0 })

        focus.handleKeydown(keyEvent('End', { metaKey: true }))
        expect(focus.active).toEqual({ row: 29, col: 1 })
    })

    it('steps by pageSize on PageDown/PageUp when pagination is registered', () => {
        const grid = createGrid([sorting(), pagination({ pageSize: 7 })])
        const { focus } = grid

        focus.focusCell({ row: 0, col: 0 })
        focus.handleKeydown(keyEvent('PageDown'))
        expect(focus.active.row).toBe(7)

        focus.handleKeydown(keyEvent('PageUp'))
        expect(focus.active.row).toBe(0)
    })

    it('toggles sort with Enter on a header cell', () => {
        const grid = createGrid()
        grid.focus.focusCell({ row: HEADER_ROW, col: 1 })

        grid.focus.handleKeydown(keyEvent('Enter'))
        expect(getSorting(grid)!.sort).toEqual([{ columnId: 'age', direction: 'asc' }])
    })

    it('ignores unbound keys and reports handled state', () => {
        const grid = createGrid()
        const event = keyEvent('x')

        expect(grid.focus.handleKeydown(event)).toBe(false)
        expect(event.preventDefault).not.toHaveBeenCalled()

        const handled = keyEvent('ArrowDown')
        expect(grid.focus.handleKeydown(handled)).toBe(true)
        expect(handled.preventDefault).toHaveBeenCalled()
    })

    it('gives feature keybindings priority over defaults', () => {
        const custom: GridFeature<Person> = {
            id: 'custom',
            keybindings: [
                { key: 'ArrowDown', handler: (grid) => grid.focus.focusCell({ row: 9, col: 0 }) }
            ]
        }
        const grid = createGrid([custom])

        grid.focus.handleKeydown(keyEvent('ArrowDown'))
        expect(grid.focus.active).toEqual({ row: 9, col: 0 })
    })

    it('clamps focus when the row count shrinks below the active row', () => {
        const grid = createGrid([filtering()])
        grid.focus.focusCell({ row: 25, col: 0 })

        grid.data = people.slice(0, 3)
        grid.focus.focusCell({ row: 25, col: 0 })
        expect(grid.focus.active.row).toBe(2)
    })

    it('leaves the filter row out of the way of a grid without one', () => {
        const grid = createGrid([sorting(), filtering()])

        expect(grid.focus.headerLines).toBe(1)
        expect(grid.focus.minRow).toBe(HEADER_ROW)

        // Asking for it anyway lands on the header rather than above it.
        grid.focus.focusCell({ row: FILTER_ROW, col: 0 })
        expect(grid.focus.active).toEqual({ row: HEADER_ROW, col: 0 })
    })
})

describe('FocusModel with a filter row', () => {
    const withRow = (extra: GridFeature<Person>[] = []) =>
        createGrid([sorting(), filtering({ floatingRow: true }), ...extra])

    it('sits between the header and the first row, both ways', () => {
        const grid = withRow()
        const { focus } = grid

        expect(focus.headerLines).toBe(2)

        focus.handleKeydown(keyEvent('ArrowDown'))
        expect(focus.active).toEqual({ row: FILTER_ROW, col: 0 })

        focus.handleKeydown(keyEvent('ArrowDown'))
        expect(focus.active).toEqual({ row: 0, col: 0 })

        focus.handleKeydown(keyEvent('ArrowUp'))
        expect(focus.active).toEqual({ row: FILTER_ROW, col: 0 })

        focus.handleKeydown(keyEvent('ArrowUp'))
        expect(focus.active).toEqual({ row: HEADER_ROW, col: 0 })

        // And no further: it is the top of the grid.
        focus.handleKeydown(keyEvent('ArrowUp'))
        expect(focus.active).toEqual({ row: HEADER_ROW, col: 0 })
    })

    it('moves along its own line, and Enter on it sorts nothing', () => {
        const grid = withRow()
        grid.focus.focusCell({ row: FILTER_ROW, col: 0 })

        grid.focus.handleKeydown(keyEvent('ArrowRight'))
        expect(grid.focus.active).toEqual({ row: FILTER_ROW, col: 1 })

        grid.focus.handleKeydown(keyEvent('Enter'))
        expect(getSorting(grid)!.sort).toEqual([])
    })

    it('keeps the pinned rows in order below it', () => {
        const grid = withRow([rowPinning({ isRowPinned: (row) => (row.id === 1 ? 'top' : null) })])
        const { focus } = grid

        focus.focusCell({ row: HEADER_ROW, col: 0 })
        focus.handleKeydown(keyEvent('ArrowDown'))
        expect(focus.active).toEqual({ row: FILTER_ROW, col: 0 })

        focus.handleKeydown(keyEvent('ArrowDown'))
        expect(focus.active).toEqual({ row: 0, col: 0, section: 'top' })

        focus.handleKeydown(keyEvent('ArrowDown'))
        expect(focus.active).toEqual({ row: 0, col: 0 })
    })

    it('reaches the top of the grid from a body row with Ctrl+Home unchanged', () => {
        const grid = withRow()
        grid.focus.focusCell({ row: 12, col: 1 })

        grid.focus.handleKeydown(keyEvent('Home', { ctrlKey: true }))
        expect(grid.focus.active).toEqual({ row: 0, col: 0 })
    })
})
