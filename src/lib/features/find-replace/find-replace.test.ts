import { createDataGrid, type GridState } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { editing } from '../../features/editing/index.js'
import { filtering } from '../../features/filtering/index.js'
import { sorting } from '../../features/sorting/index.js'
import { describe, expect, it } from 'vitest'
import { grouping } from '../grouping/index.js'
import { tree } from '../tree/index.js'
import { findReplace, getFindReplace } from './find-replace.svelte.js'
import type { FindReplaceOptions } from './find-replace.types.js'

interface Row {
    id: number
    dept: string
    city: string
    note: string
}

const columns: ColumnDef<Row>[] = [
    { id: 'dept', header: 'Dept' },
    { id: 'city', header: 'City', editable: true, filter: 'text' },
    { id: 'note', header: 'Note', editable: true }
]

function makeData(): Row[] {
    return [
        { id: 1, dept: 'Core', city: 'Hà Nội', note: 'ship 2026' },
        { id: 2, dept: 'Core', city: 'Đà Nẵng', note: 'hold 2026' },
        { id: 3, dept: 'Data', city: 'Hà Nội', note: 'ship 2025' }
    ]
}

function makeGrid(options: FindReplaceOptions = {}, extra: unknown[] = []): GridState<Row> {
    return createDataGrid<Row>({
        columns,
        data: makeData(),
        getRowId: (row) => String(row.id),
        features: [sorting(), filtering(), editing(), ...(extra as never[]), findReplace(options)]
    })
}

function open(grid: GridState<Row>, query: string) {
    const state = getFindReplace(grid)!
    state.show()
    state.query = query
    return state
}

describe('finding', () => {
    it('finds nothing until it is open, so a closed panel costs nothing', () => {
        const grid = makeGrid()
        const state = getFindReplace(grid)!
        state.query = 'Hà Nội'
        expect(state.total).toBe(0)

        state.show()
        expect(state.total).toBe(2)
    })

    it('steps forward and wraps at the end', () => {
        const state = open(makeGrid(), 'Hà Nội')
        expect(state.current).toBe(-1)

        state.step(1)
        expect(state.active).toMatchObject({ rowId: '1', columnId: 'city' })
        state.step(1)
        expect(state.active).toMatchObject({ rowId: '3', columnId: 'city' })
        state.step(1)
        expect(state.active).toMatchObject({ rowId: '1', columnId: 'city' })
    })

    it('steps backward from nowhere to the last match, not the first', () => {
        const state = open(makeGrid(), 'Hà Nội')
        state.step(-1)
        expect(state.active).toMatchObject({ rowId: '3' })

        state.step(-1)
        expect(state.active).toMatchObject({ rowId: '1' })
        state.step(-1)
        expect(state.active).toMatchObject({ rowId: '3' })
    })

    it('carries the grid focus to the match', () => {
        const grid = makeGrid()
        const state = open(grid, 'ship 2025')
        state.step(1)
        expect(grid.focus.active).toMatchObject({ row: 2, col: 2 })
    })

    it('searches the rows the filter left, not the source array', () => {
        const grid = makeGrid()
        const state = open(grid, 'Hà Nội')
        expect(state.total).toBe(2)
        ;(grid.api.setQuickFilter as (query: string) => void)('Đà Nẵng')
        expect(state.total).toBe(0)
    })

    it('follows the sort, so Next walks the order on screen', () => {
        const grid = makeGrid()
        const state = open(grid, '2026')
        expect(state.matches.map((match) => match.rowId)).toEqual(['1', '2'])
        ;(grid.api.setSort as (sort: unknown[]) => void)([{ columnId: 'city', direction: 'asc' }])
        expect(state.matches.map((match) => match.rowId)).toEqual(['2', '1'])
    })

    it('finds a row a nested tree holds as a child, which the scan used to skip', () => {
        interface Node {
            id: number
            dept: string
            city: string
            note: string
            reports?: Node[]
        }
        const nested: Node[] = [
            {
                id: 1,
                dept: 'Core',
                city: 'Hà Nội',
                note: 'ship 2026',
                reports: [{ id: 2, dept: 'Core', city: 'Cần Thơ', note: 'ship 2026' }]
            }
        ]
        const grid = createDataGrid<Node>({
            columns: columns as unknown as ColumnDef<Node>[],
            data: nested,
            getRowId: (row) => String(row.id),
            features: [
                sorting(),
                tree<Node>({ getChildren: (row) => row.reports, defaultExpandedDepth: 2 }),
                findReplace()
            ]
        })
        const state = getFindReplace(grid)!
        state.show()
        state.query = 'Cần Thơ'

        expect(state.matches.map((match) => match.rowId)).toEqual(['2'])
    })

    it('never lands on a group header, which is not a row anything can write', () => {
        const grid = makeGrid({}, [grouping<Row>({ by: ['dept'] })])
        const state = open(grid, 'Core')

        expect(state.matches.every((match) => grid.nodeById(match.rowId) !== undefined)).toBe(true)
    })
})

describe('replacing', () => {
    it('rewrites only the match it is standing on', () => {
        const grid = makeGrid()
        const state = open(grid, 'Hà Nội')
        state.replacement = 'Huế'
        state.step(1)

        expect(state.replaceCurrent()).toBe(true)
        expect(grid.data.map((row) => row.city)).toEqual(['Huế', 'Đà Nẵng', 'Hà Nội'])
    })

    it('rewrites every match in one transaction, so one undo takes it back', () => {
        const grid = makeGrid()
        const state = open(grid, '2026')
        state.replacement = '2027'

        expect(state.replaceAll()).toBe(true)
        expect(grid.data.map((row) => row.note)).toEqual(['ship 2027', 'hold 2027', 'ship 2025'])
        ;(grid.api.undo as () => void)()
        expect(grid.data.map((row) => row.note)).toEqual(['ship 2026', 'hold 2026', 'ship 2025'])
    })

    it('leaves a column it cannot write alone, and says so rather than going quiet', () => {
        const grid = makeGrid()
        const state = open(grid, 'Core')
        state.replacement = 'Platform'
        state.step(1)

        expect(state.total).toBe(2)
        expect(state.writableTotal).toBe(0)
        expect(state.canReplaceCurrent).toBe(false)
        expect(state.canReplaceAll).toBe(false)

        expect(state.replaceAll()).toBe(false)
        expect(grid.data.map((row) => row.dept)).toEqual(['Core', 'Core', 'Data'])
        expect(state.replaced).toBeNull()
    })

    it('counts only the matches a write could reach', () => {
        const grid = makeGrid()

        const state = open(grid, 'Hà Nội')
        expect(state.total).toBe(2)
        expect(state.writableTotal).toBe(2)
        expect(state.canReplaceAll).toBe(true)
    })

    it('reports how many cells a replace wrote', () => {
        const grid = makeGrid()
        const state = open(grid, '2026')
        state.replacement = '2027'
        expect(state.replaced).toBeNull()

        state.replaceAll()
        expect(state.replaced).toBe(2)
    })

    it('forgets the tally as soon as the cursor moves on', () => {
        const grid = makeGrid()
        const state = open(grid, '2026')
        state.replacement = '2027'
        state.replaceAll()
        expect(state.replaced).toBe(2)

        state.query = '2027'
        state.step(1)
        expect(state.replaced).toBeNull()
    })

    it('does nothing at all when replace is switched off', () => {
        const grid = makeGrid({ replace: false })
        const state = open(grid, 'Hà Nội')
        state.replacement = 'Huế'
        state.step(1)

        expect(state.replaceCurrent()).toBe(false)
        expect(state.replaceAll()).toBe(false)
        expect(grid.data[0]!.city).toBe('Hà Nội')
    })
})

describe('the panel', () => {
    it('forgets where it was standing when it closes', () => {
        const state = open(makeGrid(), 'Hà Nội')
        state.step(1)
        expect(state.current).toBe(0)

        state.hide()
        expect(state.open).toBe(false)
        expect(state.current).toBe(-1)
    })

    it('highlights every match and marks the one in hand differently', () => {
        const grid = makeGrid()
        const state = open(grid, 'Hà Nội')
        state.step(1)

        const first = state.cellDecoration(0, 1)
        const second = state.cellDecoration(2, 1)
        expect(first?.class).toBeTruthy()
        expect(second?.class).toBeTruthy()
        expect(first?.class).not.toBe(second?.class)
        expect(state.cellDecoration(1, 1)).toBeUndefined()
    })

    it('decorates nothing while closed', () => {
        const grid = makeGrid()
        const state = getFindReplace(grid)!
        state.query = 'Hà Nội'
        expect(state.cellDecoration(0, 1)).toBeUndefined()
    })
})

describe('the grid api', () => {
    it('drives find without the panel', () => {
        const grid = makeGrid()
        ;(grid.api.openFind as () => void)()
        getFindReplace(grid)!.query = 'Hà Nội'
        ;(grid.api.findNext as () => void)()

        expect(getFindReplace(grid)!.active).toMatchObject({ rowId: '1' })
        ;(grid.api.closeFind as () => void)()
        expect(getFindReplace(grid)!.open).toBe(false)
    })
})
