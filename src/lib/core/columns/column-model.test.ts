import { describe, expect, it } from 'vitest'
import { ColumnModel } from './column-model.svelte.js'

interface Row {
    [key: string]: unknown
}

function createModel(): ColumnModel<Row> {
    return new ColumnModel<Row>([
        { id: 'a', header: 'A', width: 100 },
        { id: 'b', header: 'B', flex: 1, minWidth: 80 },
        { id: 'c', header: 'C', width: 120 },
        { id: 'd', header: 'D', width: 90 }
    ])
}

describe('ColumnModel runtime state', () => {
    it('orders sections pinned-left, center, pinned-right', () => {
        const model = createModel()
        model.setPinned('c', 'left')
        model.setPinned('a', 'right')

        expect(model.visible.map((column) => column.id)).toEqual(['c', 'b', 'd', 'a'])
        expect(model.pinnedLeft.map((column) => column.id)).toEqual(['c'])
        expect(model.pinnedRight.map((column) => column.id)).toEqual(['a'])
    })

    it('moves columns within the display order', () => {
        const model = createModel()
        expect(model.moveColumn('d', 0)).toBe(0)
        expect(model.visible.map((column) => column.id)).toEqual(['d', 'a', 'b', 'c'])

        expect(model.moveColumn('missing', 0)).toBe(-1)
    })

    it('clamps width overrides and converts flex columns to fixed', () => {
        const model = createModel()
        expect(model.setWidth('b', 10)).toBe(80)
        expect(model.widthOf('b')).toBe(80)
        expect(model.resolvedWidths).toBeNull()

        model.setWidths({ a: 5000, b: 200 })
        expect(model.widthOf('a')).toBe(5000)
        expect(model.widthOf('b')).toBe(200)
    })

    it('hides columns via overrides and keeps them in `all`', () => {
        const model = createModel()
        model.setHidden('b', true)
        expect(model.visible.map((column) => column.id)).toEqual(['a', 'c', 'd'])
        expect(model.all).toHaveLength(4)
    })

    it('computes sticky pin offsets cumulatively per side', () => {
        const model = createModel()
        model.setPinned('a', 'left')
        model.setPinned('b', 'left')
        model.setPinned('d', 'right')

        expect(model.pins['a']).toBe(0)
        expect(model.pins['b']).toBe(100)
        expect(model.pins['d']).toBe(0)
        expect(model.cssVars[model.get('a')!.pinVar]).toBe('0px')
        expect(model.cssVars[model.get('b')!.pinVar]).toBe('100px')
    })

    it('builds header levels from grouped defs', () => {
        const model = new ColumnModel<Row>([
            {
                id: 'g',
                header: 'Group',
                children: [
                    { id: 'x', width: 100 },
                    { id: 'y', width: 100 }
                ]
            },
            { id: 'z', width: 100 }
        ])

        expect(model.headerRowCount).toBe(2)
        expect(model.headerLevels[0].map((cell) => [cell.id, cell.span])).toEqual([
            ['g', 2],
            ['placeholder-0-2', 1]
        ])
        expect(model.visible.map((column) => column.id)).toEqual(['x', 'y', 'z'])
    })
})

describe('a width the layout could not draw', () => {
    it('refuses it and reports the width the column still has', () => {
        const model = createModel()
        expect(model.setWidth('a', Number.NaN)).toBe(100)
        expect(model.setWidth('a', Number.POSITIVE_INFINITY)).toBe(100)
        expect(model.widthOverrides).toEqual({})
        expect(model.widthOf('a')).toBe(100)
    })

    it('reports zero for a column that is not there, as before', () => {
        expect(createModel().setWidth('missing', Number.NaN)).toBe(0)
    })

    it('skips it in a batch and keeps the rest', () => {
        const model = createModel()
        model.setWidths({ a: Number.NaN, c: 150, d: Number.NEGATIVE_INFINITY })

        expect(model.widthOverrides).toEqual({ c: 150 })
        expect(model.widthOf('a')).toBe(100)
        expect(model.widthOf('d')).toBe(90)
    })

    it('leaves a width already set alone', () => {
        const model = createModel()
        model.setWidth('a', 250)
        expect(model.setWidth('a', Number.NaN)).toBe(250)
        expect(model.widthOf('a')).toBe(250)
    })
})
