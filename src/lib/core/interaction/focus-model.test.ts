import { describe, expect, it, vi } from 'vitest'
import { columnOps } from '../../features/column-ops/index.js'
import { filtering } from '../../features/filtering/index.js'
import { pagination } from '../../features/pagination/index.js'
import { getSorting, sorting } from '../../features/sorting/index.js'
import { HEADER_ROW } from './focus-model.svelte.js'
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

    it('stands where the grid still draws, when a column goes out from under it', () => {
        const grid = createGrid()
        grid.focus.focusCell({ row: 5, col: 1 })

        // The Column chooser putting that column away, or a header group
        // folding it away: neither calls back into the focus model, and a
        // position past the last column claims no roving tabindex at all.
        grid.columns.hiddenOverrides = { age: true }

        expect(grid.focus.active).toEqual({ row: 5, col: 0 })
    })

    it('stands where the grid still draws, when the rows go', () => {
        const grid = createGrid()
        grid.focus.focusCell({ row: 25, col: 0 })

        grid.data = []
        // Nothing left below the header, so that is where it stands.
        expect(grid.focus.active.row).toBe(HEADER_ROW)
    })
})

describe('FocusModel across the header levels', () => {
    /** Two levels: an outer group over an inner one, beside a lone column. */
    function groupedGrid() {
        return createDataGrid<Person>({
            columns: [
                { id: 'name', header: 'Name' },
                {
                    id: 'pay',
                    header: 'Pay',
                    children: [
                        { id: 'total', header: 'Total', columnGroupShow: 'closed' },
                        {
                            id: 'detail',
                            header: 'Detail',
                            columnGroupShow: 'open',
                            children: [
                                { id: 'base', header: 'Base' },
                                { id: 'bonus', header: 'Bonus' }
                            ]
                        }
                    ]
                }
            ],
            data: people,
            getRowId: (person) => String(person.id),
            features: [columnOps()]
        })
    }

    it('walks up out of the leaf row, one level at a time', () => {
        const grid = groupedGrid()
        const { focus } = grid
        // Column 1 is `base`, which sits under Detail, which sits under Pay.
        focus.focusCell({ row: HEADER_ROW, col: 1 })

        focus.handleKeydown(keyEvent('ArrowUp'))
        expect(focus.active).toEqual({ row: 1, col: 1, section: 'header' })

        focus.handleKeydown(keyEvent('ArrowUp'))
        expect(focus.active).toEqual({ row: 0, col: 1, section: 'header' })

        // And no further: the grid has no fourth line above the top group.
        focus.handleKeydown(keyEvent('ArrowUp'))
        expect(focus.active).toEqual({ row: 0, col: 1, section: 'header' })
    })

    it('walks back down, and out into the body', () => {
        const grid = groupedGrid()
        const { focus } = grid
        focus.focusCell({ row: 0, col: 1, section: 'header' })

        focus.handleKeydown(keyEvent('ArrowDown'))
        expect(focus.active).toEqual({ row: 1, col: 1, section: 'header' })

        focus.handleKeydown(keyEvent('ArrowDown'))
        expect(focus.active).toEqual({ row: HEADER_ROW, col: 1 })

        focus.handleKeydown(keyEvent('ArrowDown'))
        expect(focus.active).toEqual({ row: 0, col: 1 })
    })

    it('stays put where a column has no group above it', () => {
        const grid = groupedGrid()
        const { focus } = grid
        // `name` belongs to no group, so the level above it holds a
        // placeholder, which names nothing and takes no focus.
        focus.focusCell({ row: HEADER_ROW, col: 0 })

        focus.handleKeydown(keyEvent('ArrowUp'))
        expect(focus.active).toEqual({ row: HEADER_ROW, col: 0 })
    })

    it('lands on the cell covering the column, not on the column', () => {
        const grid = groupedGrid()
        // Column 2 is `bonus`; Detail starts at column 1.
        grid.focus.focusCell({ row: 1, col: 2, section: 'header' })
        expect(grid.focus.active).toEqual({ row: 1, col: 1, section: 'header' })
    })

    it('steps sideways between the groups of its own level', () => {
        const grid = groupedGrid()
        const { focus } = grid
        // Level 1 holds Detail only; level 0 holds Pay only. Add a second
        // group at level 0 by folding nothing: the walk still has one stop.
        focus.focusCell({ row: 0, col: 1, section: 'header' })

        focus.handleKeydown(keyEvent('ArrowRight'))
        expect(focus.active).toEqual({ row: 0, col: 1, section: 'header' })

        focus.handleKeydown(keyEvent('ArrowLeft'))
        expect(focus.active).toEqual({ row: 0, col: 1, section: 'header' })
    })

    it('folds the group under the caret with Enter, and unfolds it with Space', () => {
        const grid = groupedGrid()
        grid.focus.focusCell({ row: 0, col: 1, section: 'header' })

        grid.focus.handleKeydown(keyEvent('Enter'))
        expect(grid.columns.isCollapsed('pay')).toBe(true)
        expect(grid.columns.visible.map((column) => column.id)).toEqual(['name', 'total'])

        grid.focus.handleKeydown(keyEvent(' '))
        expect(grid.columns.isCollapsed('pay')).toBe(false)
    })

    it('leaves Enter alone on a group that cannot fold', () => {
        const grid = createDataGrid<Person>({
            columns: [{ id: 'who', header: 'Who', children: [{ id: 'name', header: 'Name' }] }],
            data: people,
            getRowId: (person) => String(person.id),
            features: [columnOps()]
        })
        grid.focus.focusCell({ row: 0, col: 0, section: 'header' })

        grid.focus.handleKeydown(keyEvent('Enter'))
        expect(grid.columns.isCollapsed('who')).toBe(false)
    })
})
