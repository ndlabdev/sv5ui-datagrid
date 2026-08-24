import { describe, expect, it } from 'vitest'
import { createDataGrid } from '../grid/grid.svelte.js'
import { ColumnModel } from './column-model.svelte.js'
import type { ColumnDef } from '../types/index.js'

interface Row {
    id: number
}

/** A group that folds down to one summary column, plus an ungrouped column. */
function makeDefs(): ColumnDef<Row>[] {
    return [
        { id: 'id', header: '#' },
        {
            id: 'pay',
            header: 'Pay',
            children: [
                { id: 'total', header: 'Total', columnGroupShow: 'closed' },
                { id: 'base', header: 'Base', columnGroupShow: 'open' },
                { id: 'bonus', header: 'Bonus', columnGroupShow: 'open' }
            ]
        }
    ]
}

const ids = (model: ColumnModel<Row>) => model.visible.map((column) => column.id)

describe('a folded group', () => {
    it('draws the detail open and the summary closed', () => {
        const model = new ColumnModel<Row>(makeDefs())
        // `total` is the summary, so it waits for the group to fold.
        expect(ids(model)).toEqual(['id', 'base', 'bonus'])

        expect(model.toggleGroup('pay')).toBe(true)
        expect(model.isCollapsed('pay')).toBe(true)
        expect(ids(model)).toEqual(['id', 'total'])
    })

    it('starts folded when the group says so, and the user has the last word', () => {
        const defs = makeDefs()
        const model = new ColumnModel<Row>([defs[0]!, { ...defs[1]!, collapsed: true }])
        expect(ids(model)).toEqual(['id', 'total'])

        model.setGroupCollapsed('pay', false)
        expect(ids(model)).toEqual(['id', 'base', 'bonus'])
    })

    it('is not the same thing as a column put away', () => {
        const model = new ColumnModel<Row>(makeDefs())
        model.hiddenOverrides = { base: true }
        model.toggleGroup('pay')

        // The chooser reads `all`, and a column folded with its group is still
        // ticked there: the user did not put it away, the group did.
        const chooser = new Map(model.all.map((column) => [column.id, column.hidden]))
        expect(chooser.get('bonus')).toBe(false)
        expect(chooser.get('base')).toBe(true)

        // And the one the user did put away stays away when the group opens.
        model.toggleGroup('pay')
        expect(ids(model)).toEqual(['id', 'bonus'])
    })

    it('refuses to fold itself off the screen', () => {
        // Every child is `open`, so folding would leave no header cell to
        // click and no way back.
        const model = new ColumnModel<Row>([
            {
                id: 'pay',
                header: 'Pay',
                children: [
                    { id: 'base', header: 'Base', columnGroupShow: 'open' },
                    { id: 'bonus', header: 'Bonus', columnGroupShow: 'open' }
                ]
            }
        ])

        expect(model.groupToggles.get('pay')).toEqual({ collapsed: false, collapsible: false })
        expect(model.toggleGroup('pay')).toBe(false)
        expect(ids(model)).toEqual(['base', 'bonus'])
    })

    it('refuses when the user has already put the summary column away', () => {
        const model = new ColumnModel<Row>(makeDefs())
        model.hiddenOverrides = { total: true }

        // Folding would take `base` and `bonus`, and `total` is not coming
        // back on its own.
        expect(model.groupToggles.get('pay')?.collapsible).toBe(false)
        expect(model.toggleGroup('pay')).toBe(false)
    })

    it('offers no toggle to a group no child asks to fold', () => {
        const model = new ColumnModel<Row>([
            { id: 'who', header: 'Who', children: [{ id: 'name', header: 'Name' }] }
        ])
        expect(model.groupToggles.size).toBe(0)
        expect(model.toggleGroup('who')).toBe(false)
    })

    it('names the group a column would fold with, nearest first', () => {
        const model = new ColumnModel<Row>([
            {
                id: 'outer',
                header: 'Outer',
                children: [
                    { id: 'kept', header: 'Kept' },
                    {
                        id: 'inner',
                        header: 'Inner',
                        columnGroupShow: 'open',
                        children: [
                            { id: 'a', header: 'A' },
                            { id: 'b', header: 'B', columnGroupShow: 'open' }
                        ]
                    }
                ]
            }
        ])

        expect(model.foldableGroupOf('b')?.id).toBe('inner')
        expect(model.foldableGroupOf('kept')?.id).toBe('outer')
        expect(model.foldableGroupOf('nope')).toBeUndefined()
    })

    it('takes a nested group with it, and gives it back', () => {
        const model = new ColumnModel<Row>([
            {
                id: 'outer',
                header: 'Outer',
                children: [
                    { id: 'kept', header: 'Kept' },
                    {
                        id: 'inner',
                        header: 'Inner',
                        columnGroupShow: 'open',
                        children: [
                            { id: 'a', header: 'A' },
                            { id: 'b', header: 'B', columnGroupShow: 'open' }
                        ]
                    }
                ]
            }
        ])

        model.toggleGroup('inner')
        expect(ids(model)).toEqual(['kept', 'a'])

        model.toggleGroup('outer')
        expect(ids(model)).toEqual(['kept'])

        model.toggleGroup('outer')
        expect(ids(model)).toEqual(['kept', 'a'])
    })

    it('stamps the header cells with what the group offers', () => {
        const model = new ColumnModel<Row>(makeDefs())
        model.toggleGroup('pay')

        const cells = model.headerLevels[0]!
        expect(cells.find((cell) => cell.id === 'pay')).toMatchObject({
            collapsible: true,
            collapsed: true,
            span: 1
        })
        expect(cells.find((cell) => cell.isPlaceholder)).toMatchObject({ collapsible: false })
    })
})

describe('a folded group in a snapshot', () => {
    function makeGrid() {
        return createDataGrid<Row>({
            columns: makeDefs(),
            data: [{ id: 1 }],
            getRowId: (row) => String(row.id)
        })
    }

    it('comes back folded, and takes the right columns with it', () => {
        const saved = makeGrid()
        saved.columns.toggleGroup('pay')
        const snapshot = saved.getState()

        expect(snapshot.columns?.collapsed).toEqual({ pay: true })

        const restored = makeGrid()
        restored.setState(snapshot)
        expect(restored.columns.isCollapsed('pay')).toBe(true)
        expect(restored.columns.visible.map((column) => column.id)).toEqual(['id', 'total'])
    })

    it('stays out of a snapshot nobody folded anything in', () => {
        expect(makeGrid().getState().columns?.collapsed).toBeUndefined()
    })

    it('reads a snapshot from before groups could fold', () => {
        const grid = makeGrid()
        grid.setState({ version: 1, columns: { hidden: { base: true } } })

        expect(grid.columns.isCollapsed('pay')).toBe(false)
        expect(grid.columns.visible.map((column) => column.id)).toEqual(['id', 'bonus'])
    })

    it('keeps the order a fold hid columns out of', () => {
        const grid = makeGrid()
        grid.columns.moveColumn('id', 3)
        const order = grid.columns.all.map((column) => column.id)

        grid.columns.toggleGroup('pay')
        grid.columns.toggleGroup('pay')

        // Folding is not reordering: what came back came back in place.
        expect(grid.columns.all.map((column) => column.id)).toEqual(order)
    })
})
