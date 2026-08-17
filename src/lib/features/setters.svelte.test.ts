import { flushSync } from 'svelte'
import { describe, expect, it } from 'vitest'
import { createDataGrid, type GridState } from '../core/grid/index.js'
import type { ColumnDef, GridFeature } from '../core/types/index.js'
import { columnOps, getColumnOps } from './column-ops/index.js'
import { editing, getEditing } from './editing/index.js'
import { getRowPinning, rowPinning } from './row-pinning/index.js'
import { getRowReorder, rowReorder } from './row-reorder/index.js'
import { getSelection, selection } from './selection/index.js'
import { getSorting, sorting } from './sorting/index.js'

interface Person {
    id: number
    name: string
    dept: string
}

const people: Person[] = [
    { id: 1, name: 'Alice', dept: 'Core' },
    { id: 2, name: 'Bob', dept: 'Data' },
    { id: 3, name: 'Carol', dept: 'Core' }
]

const columns: ColumnDef<Person>[] = [
    { id: 'name', sortable: true, editable: true },
    { id: 'dept', sortable: true }
]

/**
 * Calls a setter from inside an `$effect` and reports how many times the effect
 * ran. One means the setter read nothing the effect could subscribe to; more
 * means the effect saw its own write, and an unbounded loop throws outright.
 */
function effectRuns(
    features: GridFeature<Person>[],
    call: (grid: GridState<Person>) => void
): number {
    let runs = 0
    const cleanup = $effect.root(() => {
        const grid = createDataGrid<Person>({
            columns,
            data: people,
            getRowId: (person) => String(person.id),
            features
        })
        $effect(() => {
            runs += 1
            call(grid)
        })
        flushSync()
    })
    cleanup()
    return runs
}

describe('no setter subscribes its caller', () => {
    it('sorting.toggleSort', () => {
        expect(effectRuns([sorting()], (grid) => getSorting(grid)!.toggleSort('name'))).toBe(1)
    })

    it('sorting.setSort', () => {
        expect(
            effectRuns([sorting()], (grid) =>
                getSorting(grid)!.setSort([{ columnId: 'name', direction: 'asc' }])
            )
        ).toBe(1)
    })

    it('selection.select', () => {
        expect(effectRuns([selection()], (grid) => getSelection(grid)!.select('1'))).toBe(1)
    })

    it('selection.selectAll', () => {
        expect(effectRuns([selection()], (grid) => getSelection(grid)!.selectAll())).toBe(1)
    })

    it('selection.toggleAll', () => {
        expect(effectRuns([selection()], (grid) => getSelection(grid)!.toggleAll())).toBe(1)
    })

    it('selection.clear', () => {
        expect(effectRuns([selection()], (grid) => getSelection(grid)!.clear())).toBe(1)
    })

    it('expansion.toggle', () => {
        expect(effectRuns([], (grid) => grid.expansion.toggle('1'))).toBe(1)
    })

    it('expansion.expandAll', () => {
        expect(effectRuns([], (grid) => grid.expansion.expandAll(['1', '2']))).toBe(1)
    })

    it('rowPinning.pinRow', () => {
        expect(effectRuns([rowPinning()], (grid) => getRowPinning(grid)!.pinRow('1', 'top'))).toBe(
            1
        )
    })

    it('rowReorder.moveRow', () => {
        expect(effectRuns([rowReorder()], (grid) => getRowReorder(grid)!.moveRow('1', 2))).toBe(1)
    })

    it('rowReorder.nudge', () => {
        expect(effectRuns([rowReorder()], (grid) => getRowReorder(grid)!.nudge('1', 1))).toBe(1)
    })

    it('columnOps.setColumnWidth', () => {
        expect(
            effectRuns([columnOps()], (grid) => getColumnOps(grid)!.setColumnWidth('name', 200))
        ).toBe(1)
    })

    it('columnOps.toggleHidden', () => {
        expect(effectRuns([columnOps()], (grid) => getColumnOps(grid)!.toggleHidden('dept'))).toBe(
            1
        )
    })

    it('columnOps.pinColumn', () => {
        expect(
            effectRuns([columnOps()], (grid) => getColumnOps(grid)!.pinColumn('name', 'left'))
        ).toBe(1)
    })

    it('columnOps.moveColumn', () => {
        expect(effectRuns([columnOps()], (grid) => getColumnOps(grid)!.moveColumn('name', 1))).toBe(
            1
        )
    })

    it('editing.startEdit', () => {
        expect(effectRuns([editing()], (grid) => getEditing(grid)!.startEdit('1', 'name'))).toBe(1)
    })

    it('editing.setDraft', () => {
        expect(effectRuns([editing()], (grid) => getEditing(grid)!.setDraft('x'))).toBe(1)
    })
})
