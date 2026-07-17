import { describe, expect, it, vi } from 'vitest'
import { createDataGrid, type GridState } from '../../core/grid.svelte.js'
import { HEADER_ROW } from '../../core/focus-model.svelte.js'
import type { ColumnDef } from '../../core/types.js'
import { sorting } from '../sorting/index.js'
import { columnOps, getColumnOps } from './index.js'
import { dropTargetIndex } from './drag.js'

interface Row {
    [key: string]: unknown
}

const groupedDefs: ColumnDef<Row>[] = [
    {
        id: 'identity',
        header: 'Identity',
        children: [
            { id: 'a', header: 'A', width: 100, sortable: true },
            { id: 'b', header: 'B', width: 100 }
        ]
    },
    {
        id: 'metrics',
        header: 'Metrics',
        children: [
            { id: 'c', header: 'C', width: 100 },
            { id: 'd', header: 'D', width: 100 }
        ]
    }
]

function createGrid(defs: ColumnDef<Row>[] = groupedDefs): GridState<Row> {
    return createDataGrid<Row>({
        columns: defs,
        data: [{ a: 1, b: 2, c: 3, d: 4 }],
        getRowId: () => '1',
        features: [sorting(), columnOps()]
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

describe('ColumnOps', () => {
    it('exposes the column-ops api on grid.api', () => {
        const grid = createGrid()
        expect(Object.keys(grid.api)).toEqual(
            expect.arrayContaining([
                'setColumnWidth',
                'autoSizeColumns',
                'moveColumn',
                'pinColumn',
                'setColumnHidden',
                'getColumnState',
                'applyColumnState'
            ])
        )
    })

    it('resizes with clamping and emits columnResized', () => {
        const grid = createGrid()
        const events: number[] = []
        grid.events.on('columnResized', ({ width }) => events.push(width))

        getColumnOps(grid)!.setColumnWidth('a', 220)
        expect(grid.columns.widthOf('a')).toBe(220)
        expect(events).toEqual([220])
    })

    it('constrains reorder to siblings of the same group', () => {
        const grid = createGrid()
        const ops = getColumnOps(grid)!

        expect(ops.moveColumn('a', 3)).toBe(1)
        expect(grid.columns.visible.map((column) => column.id)).toEqual(['b', 'a', 'c', 'd'])

        expect(ops.moveColumn('d', 0)).toBe(2)
        expect(grid.columns.visible.map((column) => column.id)).toEqual(['b', 'a', 'd', 'c'])
    })

    it('pins, hides and refuses to hide the last visible column', () => {
        const grid = createGrid([{ id: 'only', width: 100 }])
        const ops = getColumnOps(grid)!

        ops.setColumnHidden('only', true)
        expect(grid.columns.visible).toHaveLength(1)

        const grouped = createGrid()
        const groupedOps = getColumnOps(grouped)!
        groupedOps.pinColumn('d', 'left')
        expect(grouped.columns.visible[0].id).toBe('d')
        groupedOps.toggleHidden('b')
        expect(grouped.columns.visible.map((column) => column.id)).toEqual(['d', 'a', 'c'])
    })

    it('round-trips column state through the api', () => {
        const grid = createGrid()
        const ops = getColumnOps(grid)!
        ops.moveColumn('a', 1)
        ops.pinColumn('c', 'right')
        ops.setColumnWidth('b', 150)
        const snapshot = ops.getColumnState()

        const fresh = createGrid()
        getColumnOps(fresh)!.applyColumnState(snapshot)
        expect(fresh.columns.visible.map((column) => column.id)).toEqual(
            grid.columns.visible.map((column) => column.id)
        )
        expect(fresh.columns.widthOf('b')).toBe(150)
    })

    it('keyboard: Shift+Arrow resizes, Alt+Arrow reorders and follows focus', () => {
        const grid = createGrid()
        grid.focus.focusCell({ row: HEADER_ROW, col: 0 })

        grid.focus.handleKeydown(keyEvent('ArrowRight', { shiftKey: true }))
        expect(grid.columns.widthOf('a')).toBe(116)

        grid.focus.handleKeydown(keyEvent('ArrowRight', { altKey: true }))
        expect(grid.columns.visible.map((column) => column.id)).toEqual(['b', 'a', 'c', 'd'])
        expect(grid.focus.active).toEqual({ row: HEADER_ROW, col: 1 })

        grid.focus.handleKeydown(keyEvent('ArrowDown', { altKey: true }))
        expect(getColumnOps(grid)!.menuFor).toBe('a')
    })

    it('keyboard: header bindings do not swallow body-cell keys', () => {
        const grid = createGrid()
        grid.focus.focusCell({ row: 0, col: 0 })

        const event = keyEvent('ArrowRight', { shiftKey: true })
        expect(grid.focus.handleKeydown(event)).toBe(false)
        expect(grid.columns.widthOf('a')).toBe(100)
    })

    it('updateDrag/commitDrag applies the drop target', () => {
        const grid = createGrid()
        const ops = getColumnOps(grid)!

        ops.updateDrag('a', 190)
        expect(ops.drag).toMatchObject({ sourceId: 'a', targetIndex: 1 })

        ops.commitDrag()
        expect(ops.drag).toBeNull()
        expect(grid.columns.visible.map((column) => column.id)).toEqual(['b', 'a', 'c', 'd'])
    })
})

describe('dropTargetIndex', () => {
    const offsets = [0, 100, 200, 300, 400]

    it('picks the slot whose midpoint the pointer passed', () => {
        expect(dropTargetIndex(40, offsets, 0, { start: 0, end: 4 }).index).toBe(0)
        expect(dropTargetIndex(160, offsets, 0, { start: 0, end: 4 }).index).toBe(1)
        expect(dropTargetIndex(390, offsets, 0, { start: 0, end: 4 }).index).toBe(3)
    })

    it('clamps to the sibling range', () => {
        expect(dropTargetIndex(390, offsets, 0, { start: 0, end: 2 }).index).toBe(1)
        expect(dropTargetIndex(0, offsets, 3, { start: 2, end: 4 }).index).toBe(2)
    })
})
