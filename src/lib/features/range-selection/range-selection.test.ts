import { createDataGrid, type GridState } from '../../core/grid/index.js'
import { type ColumnDef, SELECTION_COLUMN_ID } from '../../core/types/index.js'
import { editing, getEditing } from '../../features/editing/index.js'
import { filtering } from '../../features/filtering/index.js'
import { selection } from '../../features/selection/index.js'
import { sorting } from '../../features/sorting/index.js'
import { describe, expect, it, vi } from 'vitest'
import { grouping } from '../grouping/index.js'
import { getRangeSelection, rangeSelection } from './range-selection.svelte.js'
import type { RangeSelectionOptions } from './range-selection.types.js'

interface Cell {
    id: number
    a: string
    b: string
    n: number
}

const columns: ColumnDef<Cell>[] = [
    { id: 'a', header: 'A', editable: true },
    { id: 'b', header: 'B', editable: true },
    { id: 'n', header: 'N', editable: true, editor: 'number', parse: (v) => Number(v) }
]

function makeData(): Cell[] {
    return [
        { id: 1, a: 'a1', b: 'b1', n: 10 },
        { id: 2, a: 'a2', b: 'b2', n: 20 },
        { id: 3, a: 'a3', b: 'b3', n: 30 }
    ]
}

function createGrid(options: RangeSelectionOptions = {}): GridState<Cell> {
    return createDataGrid<Cell>({
        columns,
        data: makeData(),
        getRowId: (row) => String(row.id),
        features: [sorting(), filtering(), editing(), rangeSelection(options)]
    })
}

describe('range state', () => {
    it('starts, extends and clears a range', () => {
        const state = getRangeSelection(createGrid())!

        state.startRange(0, 0)
        expect(state.ranges).toEqual([{ top: 0, left: 0, bottom: 0, right: 0 }])

        state.extendTo(2, 1)
        expect(state.ranges).toEqual([{ top: 0, left: 0, bottom: 2, right: 1 }])
        expect(state.cellCount).toBe(6)

        state.clear()
        expect(state.ranges).toEqual([])
    })

    it('replaces the range unless the gesture is additive', () => {
        const state = getRangeSelection(createGrid())!

        state.startRange(0, 0)
        state.startRange(2, 2)
        expect(state.ranges).toHaveLength(1)

        state.startRange(0, 0, { additive: true })
        expect(state.ranges).toHaveLength(2)
        expect(state.cellCount).toBe(2)
    })

    it('ignores additive gestures when multiple is off', () => {
        const state = getRangeSelection(createGrid({ multiple: false }))!
        state.startRange(0, 0)
        state.startRange(2, 2, { additive: true })
        expect(state.ranges).toHaveLength(1)
    })

    it('reports which cells are selected', () => {
        const state = getRangeSelection(createGrid())!
        state.startRange(1, 0)
        state.extendTo(2, 1)

        expect(state.isSelected(1, 0)).toBe(true)
        expect(state.isSelected(2, 1)).toBe(true)
        expect(state.isSelected(0, 0)).toBe(false)
    })

    it('selects every cell', () => {
        const state = getRangeSelection(createGrid())!
        state.selectAll()
        expect(state.ranges).toEqual([{ top: 0, left: 0, bottom: 2, right: 2 }])
        expect(state.cellCount).toBe(9)
    })
})

describe('keyboard extension', () => {
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

    it('grows the range with Shift+Arrow and carries the focus', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        grid.focus.focusCell({ row: 0, col: 0 })

        grid.focus.handleKeydown(keydown('ArrowDown', { shiftKey: true }))
        expect(grid.focus.active).toEqual({ row: 1, col: 0 })
        expect(state.ranges).toEqual([{ top: 0, left: 0, bottom: 1, right: 0 }])

        grid.focus.handleKeydown(keydown('ArrowRight', { shiftKey: true }))
        expect(state.ranges).toEqual([{ top: 0, left: 0, bottom: 1, right: 1 }])
    })

    it('stops at the grid edges', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        grid.focus.focusCell({ row: 0, col: 0 })

        grid.focus.handleKeydown(keydown('ArrowUp', { shiftKey: true }))
        expect(state.ranges).toEqual([{ top: 0, left: 0, bottom: 0, right: 0 }])
    })

    it('clears with Escape', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)

        grid.focus.handleKeydown(keydown('Escape'))
        expect(state.ranges).toEqual([])
    })
})

describe('copy', () => {
    it('builds TSV for the range', () => {
        const state = getRangeSelection(createGrid())!
        state.startRange(0, 0)
        state.extendTo(1, 1)

        expect(state.getRangeTsv()).toBe('a1\tb1\na2\tb2')
    })

    it('can prefix the column headers', () => {
        const state = getRangeSelection(createGrid())!
        state.startRange(0, 1)
        state.extendTo(1, 2)

        expect(state.getRangeTsv({ headers: true })).toBe('B\tN\nb1\t10\nb2\t20')
    })

    it('returns nothing without a range', () => {
        expect(getRangeSelection(createGrid())!.getRangeTsv()).toBe('')
    })

    it('clamps a range that outgrew the data', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.selectAll()
        grid.data = grid.data.slice(0, 1)

        expect(state.getRangeTsv()).toBe('a1\tb1\t10')
    })

    it('copies the raw value by default and the rendered text on request', () => {
        const grid = createDataGrid<Cell>({
            columns: [
                { id: 'a', header: 'A' },
                { id: 'n', header: 'N', type: 'currency', typeOptions: { currency: 'USD' } }
            ],
            data: [{ id: 1, a: 'a1', b: 'b1', n: 204_000 }],
            getRowId: (row) => String(row.id),
            locale: 'en-US',
            features: [rangeSelection()]
        })
        const state = getRangeSelection(grid)!
        state.selectAll()

        expect(state.getRangeTsv()).toBe('a1\t204000')
        expect(state.getRangeTsv({ formatted: true })).toBe('a1\t$204,000.00')
    })

    it('skips the selection column a range happens to span', () => {
        const grid = createDataGrid<Cell>({
            columns,
            data: makeData(),
            getRowId: (row) => String(row.id),
            features: [selection(), rangeSelection()]
        })
        const state = getRangeSelection(grid)!
        state.selectAll()

        expect(grid.columns.visible[0]?.id).toBe(SELECTION_COLUMN_ID)
        expect(state.getRangeTsv({ headers: true }).split('\n')[0]).toBe('A\tB\tN')
    })
})

describe('paste', () => {
    it('writes a block starting at the range anchor', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)

        expect(state.pasteText('x1\ty1\nx2\ty2')).toBe(true)
        expect(grid.data[0]).toMatchObject({ a: 'x1', b: 'y1' })
        expect(grid.data[1]).toMatchObject({ a: 'x2', b: 'y2' })
    })

    it('repeats the block across a larger range', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)
        state.extendTo(2, 0)

        expect(state.pasteText('z')).toBe(true)
        expect(grid.data.map((row) => row.a)).toEqual(['z', 'z', 'z'])
    })

    it('runs the column parse so numbers land as numbers', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 2)

        state.pasteText('99')
        expect(grid.data[0]!.n).toBe(99)
    })

    it('undoes the whole paste in one step', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)
        state.pasteText('x1\ty1\nx2\ty2')

        const undo = grid.api.undo as () => void
        undo()
        expect(grid.data[0]).toMatchObject({ a: 'a1', b: 'b1' })
        expect(grid.data[1]).toMatchObject({ a: 'a2', b: 'b2' })
    })

    it('does nothing without a range or with empty text', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        expect(state.pasteText('x')).toBe(false)

        state.startRange(0, 0)
        expect(state.pasteText('')).toBe(false)
    })

    it('stays out of the way when paste is disabled', () => {
        const grid = createGrid({ paste: false })
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)

        expect(state.pasteText('x')).toBe(false)
        expect(grid.data[0]!.a).toBe('a1')
    })
})

describe('status bar values', () => {
    it('collects the numeric cells of every range', () => {
        const state = getRangeSelection(createGrid())!
        state.startRange(0, 2)
        state.extendTo(2, 2)

        expect(state.selectedValues).toEqual([10, 20, 30])
    })

    it('skips non-numeric cells', () => {
        const state = getRangeSelection(createGrid())!
        state.selectAll()
        expect(state.selectedValues).toEqual([10, 20, 30])
    })

    it('reports the shape of the primary range', () => {
        const state = getRangeSelection(createGrid())!
        state.startRange(0, 0)
        state.extendTo(1, 2)
        expect(state.shape).toEqual({ rows: 2, cols: 3 })
    })
})

describe('cell decoration', () => {
    it('decorates only cells inside a range', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)
        state.extendTo(1, 1)

        const feature = grid.features.find((entry) => entry.id === 'rangeSelection')!
        const decorate = (rowIndex: number, colIndex: number) =>
            feature.cellDecoration!({
                grid,
                node: grid.preWindowNodes[rowIndex]!,
                column: grid.columns.visible[colIndex]!,
                rowIndex,
                colIndex
            })

        expect(decorate(0, 0)).toMatchObject({ selected: true })
        expect(decorate(2, 2)).toBeUndefined()
    })
})

describe('fill handle', () => {
    it('offers the handle on the range corner, and hides it mid-drag', () => {
        const state = getRangeSelection(createGrid())!
        expect(state.fillHandleAt).toBeNull()

        state.startRange(0, 0)
        state.extendTo(1, 1)

        expect(state.fillHandleAt).toBeNull()

        state.endRange()
        expect(state.fillHandleAt).toEqual({ row: 1, col: 1 })
    })

    it('previews without writing, and writes on release', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!

        state.startRange(0, 2)
        state.endRange()

        state.startFill()
        state.extendFill(2, 2)
        expect(state.fillTarget).toEqual({
            axis: 'down',
            range: { top: 1, left: 2, bottom: 2, right: 2 }
        })
        expect(grid.data.map((row) => row.n)).toEqual([10, 20, 30])

        expect(state.endFill()).toBe(true)
        expect(grid.data.map((row) => row.n)).toEqual([10, 10, 10])
        expect(state.fillTarget).toBeNull()
    })

    it('continues a numeric run down the column', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 2)
        state.extendTo(1, 2)
        state.endRange()

        state.startFill()
        state.extendFill(2, 2)
        expect(state.endFill()).toBe(true)
        expect(grid.data.map((row) => row.n)).toEqual([10, 20, 30])
    })

    it('selects what it filled, the way releasing the handle does', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 2)
        state.extendTo(1, 2)
        state.endRange()

        state.startFill()
        state.extendFill(2, 2)
        state.endFill()
        expect(state.ranges).toEqual([{ top: 0, left: 2, bottom: 2, right: 2 }])
    })

    it('writes nothing when the pointer never left the source', () => {
        const grid = createGrid()
        const before = grid.data.map((row) => row.a)
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)
        state.extendTo(1, 0)
        state.endRange()

        state.startFill()
        state.extendFill(1, 0)
        expect(state.endFill()).toBe(false)
        expect(grid.data.map((row) => row.a)).toEqual(before)
    })

    it('undoes a whole fill in one step', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 2)
        state.endRange()

        state.startFill()
        state.extendFill(2, 2)
        state.endFill()
        expect(grid.data.map((row) => row.n)).toEqual([10, 10, 10])
        ;(grid.api.undo as () => void)()
        expect(grid.data.map((row) => row.n)).toEqual([10, 20, 30])
    })

    it('does nothing at all when fill is switched off', () => {
        const grid = createGrid({ fill: false })
        const state = getRangeSelection(grid)!
        state.startRange(0, 2)
        state.extendTo(1, 2)
        state.endRange()

        expect(state.fillHandleAt).toBeNull()
        state.startFill()
        state.extendFill(2, 2)
        expect(state.endFill()).toBe(false)
        expect(grid.data.map((row) => row.n)).toEqual([10, 20, 30])
    })
})

describe('Ctrl+D and Ctrl+R', () => {
    it('fills the leading row down the range', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)
        state.extendTo(2, 0)

        expect(state.fillWithin('down')).toBe(true)
        expect(grid.data.map((row) => row.a)).toEqual(['a1', 'a1', 'a1'])
    })

    it('fills the leading column across the range', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)
        state.extendTo(0, 1)

        expect(state.fillWithin('right')).toBe(true)
        expect(grid.data[0]).toMatchObject({ a: 'a1', b: 'a1' })
    })

    it('refuses a range with nothing to fill into', () => {
        const state = getRangeSelection(createGrid())!
        state.startRange(0, 0)
        expect(state.fillWithin('down')).toBe(false)
        expect(state.fillWithin('right')).toBe(false)
    })
})

describe('fill across rows that are not data', () => {
    interface Grouped {
        id: number
        dept: string
        n: number
    }

    function groupedGrid() {
        return createDataGrid<Grouped>({
            columns: [
                { id: 'dept', header: 'Dept' },
                { id: 'n', header: 'N', editable: true, parse: Number }
            ],
            data: [
                { id: 1, dept: 'Core', n: 1 },
                { id: 2, dept: 'Core', n: 2 },
                { id: 3, dept: 'Data', n: 100 },
                { id: 4, dept: 'Data', n: 200 }
            ],
            getRowId: (row) => String(row.id),
            features: [sorting(), editing(), grouping<Grouped>({ by: ['dept'] }), rangeSelection()]
        })
    }

    it('a group row inside the target does not eat a step', () => {
        const grid = groupedGrid()
        const state = getRangeSelection(grid)!

        state.startRange(1, 1)
        state.extendTo(2, 1)
        state.endRange()

        state.startFill()
        state.extendFill(5, 1)
        state.endFill()

        expect(grid.data.map((row) => row.n)).toEqual([1, 2, 3, 4])
    })

    it('skips a group row on the paste path too, keeping the block aligned', () => {
        const grid = groupedGrid()
        const state = getRangeSelection(grid)!

        state.startRange(1, 1)
        state.extendTo(5, 1)
        state.pasteText('7\n8\n9\n10\n11')

        expect(grid.data.map((row) => row.n)).toEqual([7, 8, 10, 11])
    })

    it('a group row inside the source does not poison the run', () => {
        const grid = groupedGrid()
        const state = getRangeSelection(grid)!
        state.startRange(2, 1)
        state.extendTo(3, 1)
        state.endRange()

        state.startFill()
        state.extendFill(5, 1)
        state.endFill()

        expect(grid.data.every((row) => Number.isFinite(row.n))).toBe(true)
    })
})

describe('a range with nothing writable in it', () => {
    function readOnlyGrid() {
        return createDataGrid<Cell>({
            columns: [
                { id: 'a', header: 'A' },
                { id: 'b', header: 'B' },
                { id: 'n', header: 'N', editable: true, parse: Number }
            ],
            data: makeData(),
            getRowId: (row) => String(row.id),
            features: [sorting(), editing(), rangeSelection()]
        })
    }

    it('offers no handle, because the gesture would do nothing', () => {
        const state = getRangeSelection(readOnlyGrid())!
        state.startRange(0, 0)
        state.extendTo(1, 0)
        state.endRange()

        expect(state.fillHandleAt).toBeNull()
    })

    it('still offers one when part of the range can take a write', () => {
        const state = getRangeSelection(readOnlyGrid())!
        state.startRange(0, 1)
        state.extendTo(1, 2)
        state.endRange()

        expect(state.fillHandleAt).toEqual({ row: 1, col: 2 })
    })

    it('previews nothing over a target it cannot write', () => {
        const state = getRangeSelection(readOnlyGrid())!
        state.startRange(0, 0)
        state.endRange()

        state.startFill()
        state.extendFill(2, 0)
        expect(state.fillTarget).toBeNull()
    })
})

describe('a range that spans the selection checkbox column', () => {
    function checkboxGrid() {
        return createDataGrid<Cell>({
            columns,
            data: makeData(),
            getRowId: (row) => String(row.id),
            features: [sorting(), editing(), selection(), rangeSelection()]
        })
    }

    it('round-trips copy then paste, instead of shifting every column left', () => {
        const grid = checkboxGrid()
        const state = getRangeSelection(grid)!
        state.selectAll()

        expect(grid.columns.visible[0]?.id).toBe(SELECTION_COLUMN_ID)
        expect(state.pasteText(state.getRangeTsv())).toBe(true)
        expect(grid.data).toEqual(makeData())
    })

    it('spills a block wider than the range onto the next data columns', () => {
        const grid = checkboxGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 1)
        state.endRange()

        expect(state.pasteText('p\tq')).toBe(true)
        expect(grid.data[0]).toMatchObject({ a: 'p', b: 'q' })
    })

    it('writes nothing when the checkbox column is all the range holds', () => {
        const grid = checkboxGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)
        state.endRange()

        expect(state.buildPasteEdits([['zzz']])).toEqual([])
        expect(grid.data[0]).toMatchObject({ a: 'a1' })
    })
})

describe('a range left behind by the data', () => {
    it('counts the cells that are still there, not the ones it was drawn over', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.selectAll()
        expect(state.cellCount).toBe(9)
        expect(state.shape).toEqual({ rows: 3, cols: 3 })

        const setQuickFilter = grid.api.setQuickFilter as (text: string) => void
        setQuickFilter('a1')

        expect(grid.totalRows).toBe(1)
        expect(state.cellCount).toBe(3)
        expect(state.shape).toEqual({ rows: 1, cols: 3 })
    })
})

describe('range editing with Ctrl+Enter', () => {
    function editingGrid(options: RangeSelectionOptions = {}) {
        const grid = createGrid(options)
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)
        state.extendTo(2, 1)
        state.endRange()
        return { grid, state, edit: getEditing(grid)! }
    }

    it('writes the open draft into every cell of the selection', () => {
        const { grid, state, edit } = editingGrid()
        edit.startEdit('1', 'a')
        edit.setDraft('same')

        expect(state.commitDraftToRange()).toBe(true)
        expect(grid.data.map((row) => [row.a, row.b])).toEqual([
            ['same', 'same'],
            ['same', 'same'],
            ['same', 'same']
        ])
    })

    it('closes the editor rather than leaving a draft behind it', () => {
        const { state, edit } = editingGrid()
        edit.startEdit('1', 'a')
        edit.setDraft('same')
        state.commitDraftToRange()

        expect(edit.active).toBeNull()
    })

    it('is one undo step, like a paste', () => {
        const { grid, state, edit } = editingGrid()
        edit.startEdit('1', 'a')
        edit.setDraft('same')
        state.commitDraftToRange()

        edit.undo()
        expect(grid.data.map((row) => row.a)).toEqual(['a1', 'a2', 'a3'])
    })

    it('runs the column parse, so a number column takes a number', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 2)
        state.extendTo(1, 2)
        state.endRange()

        const edit = getEditing(grid)!
        edit.startEdit('1', 'n')
        edit.setDraft('77')
        expect(state.commitDraftToRange()).toBe(true)
        expect(grid.data.map((row) => row.n)).toEqual([77, 77, 30])
    })

    it("leaves a single selected cell to the grid's plain commit", () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)
        state.endRange()

        const edit = getEditing(grid)!
        edit.startEdit('1', 'a')
        edit.setDraft('only')
        expect(state.commitDraftToRange()).toBe(false)
        expect(edit.active).not.toBeNull()
    })

    it('stands aside when the edited cell is outside the selection', () => {
        const { state, edit } = editingGrid()
        edit.startEdit('1', 'n')
        edit.setDraft('99')

        expect(state.commitDraftToRange()).toBe(false)
    })

    it('does nothing when the option is off', () => {
        const { state, edit } = editingGrid({ rangeEdit: false })
        edit.startEdit('1', 'a')
        edit.setDraft('same')

        expect(state.commitDraftToRange()).toBe(false)
    })

    it('applies a value straight through the api, with no editor open', () => {
        const { grid, state } = editingGrid()
        expect(state.applyToRange('api')).toBe(true)
        expect(grid.data[1]).toMatchObject({ a: 'api', b: 'api' })

        const applyToRange = grid.api.applyToRange as (value: unknown) => boolean
        expect(applyToRange('again')).toBe(true)
        expect(grid.data[2]).toMatchObject({ a: 'again', b: 'again' })
    })

    it('skips rows that are not data', () => {
        const grid = createDataGrid<Cell>({
            columns,
            data: makeData(),
            getRowId: (row) => String(row.id),
            features: [sorting(), editing(), grouping({ by: ['b'] }), rangeSelection()]
        })
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)
        state.extendTo(grid.preWindowNodes.length - 1, 1)
        state.endRange()

        expect(state.applyToRange('flat')).toBe(true)
        expect(grid.data.every((row) => row.a === 'flat')).toBe(true)
    })
})

describe('cut and move', () => {
    function cutGrid() {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)
        state.extendTo(0, 1)
        state.endRange()
        return { grid, state }
    }

    it('moves the block and clears where it came from, in one undo step', () => {
        const { grid, state } = cutGrid()
        state.cutSource = { top: 0, left: 0, bottom: 0, right: 1 }

        expect(state.moveRange(2, 0)).toBe(true)
        expect(grid.data[2]).toMatchObject({ a: 'a1', b: 'b1' })
        expect(grid.data[0]).toMatchObject({ a: null, b: null })

        const undo = grid.api.undo as () => void
        undo()
        expect(grid.data.map((row) => [row.a, row.b])).toEqual([
            ['a1', 'b1'],
            ['a2', 'b2'],
            ['a3', 'b3']
        ])
    })

    it('selects what it moved, so the next gesture works on it', () => {
        const { state } = cutGrid()
        state.cutSource = { top: 0, left: 0, bottom: 0, right: 1 }
        state.moveRange(1, 0)

        expect(state.ranges).toEqual([{ top: 1, left: 0, bottom: 1, right: 1 }])
        expect(state.cutSource).toBeNull()
    })

    it('keeps the overlap rather than clearing what it just wrote', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.cutSource = { top: 0, left: 0, bottom: 1, right: 0 }

        state.moveRange(1, 0)
        expect(grid.data.map((row) => row.a)).toEqual([null, 'a1', 'a2'])
    })

    it('clears through the column parse, so an unguarded parse decides what empty is', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.cutSource = { top: 0, left: 2, bottom: 0, right: 2 }

        state.moveRange(1, 2)
        expect(grid.data[1]!.n).toBe(10)
        expect(grid.data[0]!.n).toBe(0)
    })

    it('does nothing without a cut, and nothing when the block lands off the grid', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        expect(state.moveRange(1, 0)).toBe(false)

        state.cutSource = { top: 0, left: 0, bottom: 0, right: 0 }
        expect(state.moveRange(9, 0)).toBe(false)
        expect(grid.data[0]).toMatchObject({ a: 'a1' })
    })

    it('stays out of the way when cut is switched off', () => {
        const grid = createGrid({ cut: false })
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)
        state.endRange()

        expect(state.cutRange()).toBe(false)
        expect(state.cutSource).toBeNull()
        expect(state.moveBorderAt(0, 0)).toBeNull()
    })

    it('drags the border: preview follows, drop moves, and a drop in place writes nothing', () => {
        const { grid, state } = cutGrid()

        expect(state.moveBorderAt(0, 0)).toEqual({
            top: true,
            bottom: true,
            start: true,
            end: false
        })
        expect(state.moveBorderAt(2, 2)).toBeNull()

        state.startMove(0, 0)
        expect(state.moving).toBe(true)
        state.extendMove(1, 0)
        expect(state.moveTarget).toEqual({ top: 1, left: 0, bottom: 1, right: 1 })

        expect(state.endMove()).toBe(true)
        expect(grid.data[1]).toMatchObject({ a: 'a1', b: 'b1' })
        expect(state.moving).toBe(false)

        state.startRange(0, 0)
        state.endRange()
        state.startMove(0, 0)
        state.extendMove(0, 0)
        expect(state.endMove()).toBe(false)
    })

    it('names only the edges that sit on the range boundary', () => {
        const grid = createGrid()
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)
        state.extendTo(2, 2)
        state.endRange()

        expect(state.moveBorderAt(1, 0)).toEqual({
            top: false,
            bottom: false,
            start: true,
            end: false
        })
        expect(state.moveBorderAt(1, 1)).toBeNull()
        expect(state.moveBorderAt(2, 2)).toEqual({
            top: false,
            bottom: true,
            start: false,
            end: true
        })
    })

    it('forgets the cut marks when a drop cannot be written', () => {
        const grid = createDataGrid<Cell>({
            columns,
            data: makeData(),
            getRowId: (row) => String(row.id),
            features: [sorting(), rangeSelection()]
        })
        const state = getRangeSelection(grid)!
        state.startRange(0, 0)
        state.endRange()

        state.startMove(0, 0)
        state.extendMove(1, 0)
        expect(state.endMove()).toBe(false)
        expect(state.cutSource).toBeNull()
    })

    it('moves past a group row without writing to it or losing the value', () => {
        const grid = createDataGrid<Cell>({
            columns,
            data: makeData(),
            getRowId: (row) => String(row.id),
            features: [sorting(), editing(), grouping<Cell>({ by: ['b'] }), rangeSelection()]
        })
        const state = getRangeSelection(grid)!
        const groupRows = grid.preWindowNodes.filter((node) => node.meta?.expandable).length
        expect(groupRows).toBeGreaterThan(0)

        state.cutSource = { top: 1, left: 0, bottom: 1, right: 0 }
        state.moveRange(0, 0)

        expect(grid.data.map((row) => row.a)).toEqual(['a1', 'a2', 'a3'])
    })

    it('keeps the source when the target column refuses the write', () => {
        const grid = createDataGrid<Cell>({
            columns: columns.map((column) =>
                column.id === 'b' ? { ...column, editable: false } : column
            ),
            data: makeData(),
            getRowId: (row) => String(row.id),
            features: [sorting(), editing(), rangeSelection()]
        })
        const state = getRangeSelection(grid)!

        state.cutSource = { top: 0, left: 0, bottom: 0, right: 0 }
        expect(state.moveRange(0, 1)).toBe(false)
        expect(grid.data[0]).toMatchObject({ a: 'a1', b: 'b1' })
    })

    it('keeps the dragged block inside the grid', () => {
        const { state } = cutGrid()
        state.startMove(0, 1)
        state.extendMove(9, 9)

        expect(state.moveTarget).toEqual({ top: 2, left: 1, bottom: 2, right: 2 })
    })

    it('clearing the selection forgets the cut', () => {
        const { state } = cutGrid()
        state.cutRange()
        state.clear()
        expect(state.cutSource).toBeNull()
    })
})
