import { describe, expect, it } from 'vitest'
import { ColumnModel } from './column-model.svelte.js'
import { railColumnId } from '../types/index.js'
import type { ColumnDef } from '../types/index.js'

interface Row {
    id: number
}

/** A group that folds to a strip rather than to a summary column. */
function makeDefs(): ColumnDef<Row>[] {
    return [
        { id: 'id', header: '#' },
        {
            id: 'revenue',
            header: 'Doanh thu',
            collapseMode: 'rail',
            children: [
                { id: 'q1', header: 'Q1' },
                { id: 'q2', header: 'Q2' }
            ]
        },
        { id: 'plan', header: 'Plan' }
    ]
}

const ids = (model: ColumnModel<Row>) => model.visible.map((column) => column.id)
const RAIL = railColumnId('revenue')

describe('a group folded to a rail', () => {
    it('takes every column with it and leaves one strip in their place', () => {
        const model = new ColumnModel<Row>(makeDefs())
        expect(ids(model)).toEqual(['id', 'q1', 'q2', 'plan'])

        model.toggleGroup('revenue')

        // The strip stands where the group stood, not at either end.
        expect(ids(model)).toEqual(['id', RAIL, 'plan'])
    })

    it('folds without any column asking it to', () => {
        // No child declares `columnGroupShow`; the strip is the way back, so
        // the group folds anyway. A summary group with the same children
        // could not, and still cannot.
        const model = new ColumnModel<Row>(makeDefs())
        expect(model.groupToggles.get('revenue')).toEqual({ collapsed: false, collapsible: true })

        const summary = new ColumnModel<Row>([
            { id: 'a', header: 'A', children: [{ id: 'b', header: 'B' }] }
        ])
        expect(summary.groupToggles.size).toBe(0)
    })

    it('keeps the group drawn over the strip, so it can be folded back open', () => {
        const model = new ColumnModel<Row>(makeDefs())
        model.toggleGroup('revenue')

        const level = model.headerLevels[0]!
        const group = level.find((cell) => cell.id === 'revenue')!
        expect(group).toMatchObject({ span: 1, collapsible: true, collapsed: true })
        expect(group.leafIds).toEqual([RAIL])
    })

    it('gives the strip the group name, and keeps it out of the data', () => {
        const model = new ColumnModel<Row>(makeDefs())
        model.toggleGroup('revenue')

        const rail = model.get(RAIL)!
        expect(rail.header).toBe('Doanh thu')
        expect(rail.resizable).toBe(false)
        // Not a column an app declared, so nothing reads a value out of it.
        expect(model.leafDefs.some((def) => def.id === RAIL)).toBe(false)
    })

    it('unfolds back to the columns it had, in the order it had them', () => {
        const model = new ColumnModel<Row>(makeDefs())
        model.toggleGroup('revenue')
        model.toggleGroup('revenue')

        expect(ids(model)).toEqual(['id', 'q1', 'q2', 'plan'])
    })

    it('leaves a column the user put away put away underneath', () => {
        const model = new ColumnModel<Row>(makeDefs())
        model.hiddenOverrides = { q2: true }
        model.toggleGroup('revenue')
        model.toggleGroup('revenue')

        expect(ids(model)).toEqual(['id', 'q1', 'plan'])
    })

    it('takes the pin side of the columns it stands for', () => {
        const defs = makeDefs()
        const model = new ColumnModel<Row>([
            defs[0]!,
            {
                ...defs[1]!,
                children: [
                    { id: 'q1', header: 'Q1', pinned: 'left' },
                    { id: 'q2', header: 'Q2', pinned: 'left' }
                ]
            },
            defs[2]!
        ])
        model.toggleGroup('revenue')

        expect(model.get(RAIL)?.pinned).toBe('left')
        expect(model.pinnedLeft.map((column) => column.id)).toEqual([RAIL])
    })
})
