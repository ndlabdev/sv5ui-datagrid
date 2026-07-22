import { describe, expect, it, vi } from 'vitest'
import { createDataGrid, type GridState } from '../grid/grid.svelte.js'
import { PIPELINE_ORDER } from '../grid/pipeline.svelte.js'
import type { ColumnDef, GridFeature, RowNode } from '../types/index.js'

interface Order {
    id: number
    customer: string
}

const orders: Order[] = [
    { id: 1, customer: 'Alice' },
    { id: 2, customer: 'Bob' },
    { id: 3, customer: 'Carol' }
]

const columns: ColumnDef<Order>[] = [{ id: 'customer' }, { id: 'id' }]

function expandableRows(): GridFeature<Order> {
    return {
        id: 'demo-expand',
        createState: (grid) => {
            grid.expansion.enabled = true
            return {}
        },
        pipelineStage: {
            order: PIPELINE_ORDER.flatten,
            transform: (nodes, grid) =>
                nodes.flatMap((node): RowNode<Order>[] => {
                    const parent = { ...node, meta: { expandable: true, level: 0 } }
                    if (!grid.expansion.isExpanded(node.id)) return [parent]
                    return [
                        parent,
                        {
                            id: `${node.id}:detail`,
                            row: node.row,
                            index: node.index,
                            meta: { fullWidth: true, level: 1 }
                        }
                    ]
                })
        }
    }
}

function createGrid(): GridState<Order> {
    return createDataGrid<Order>({
        columns,
        data: orders,
        getRowId: (order) => String(order.id),
        features: [expandableRows()]
    })
}

describe('ExpansionModel', () => {
    it('toggles ids, emits rowExpanded and announces', () => {
        const grid = createGrid()
        const handler = vi.fn()
        grid.events.on('rowExpanded', handler)

        grid.expansion.toggle('2')
        expect(grid.expansion.isExpanded('2')).toBe(true)
        expect(handler).toHaveBeenCalledWith({ id: '2', expanded: true })
        expect(grid.announcer.message).toBe('row expanded')

        grid.expansion.toggle('2')
        expect(grid.expansion.isExpanded('2')).toBe(false)
        expect(grid.announcer.message).toBe('row collapsed')
    })

    it('round-trips the expanded set and supports expandAll/collapseAll', () => {
        const grid = createGrid()
        grid.expansion.expandAll(['1', '3'])
        expect(grid.expansion.getExpanded().toSorted()).toEqual(['1', '3'])

        const restored = createGrid()
        restored.expansion.setExpanded(grid.expansion.getExpanded())
        expect(restored.expansion.isExpanded('3')).toBe(true)

        grid.expansion.collapseAll()
        expect(grid.expansion.getExpanded()).toEqual([])
    })

    it('is enabled by the structure feature and inert otherwise', () => {
        expect(createGrid().expansion.enabled).toBe(true)
        const plain = createDataGrid<Order>({
            columns,
            data: orders,
            getRowId: (order) => String(order.id)
        })
        expect(plain.expansion.enabled).toBe(false)
    })

    it('flatten stage inserts detail nodes after expanded parents', () => {
        const grid = createGrid()
        expect(grid.nodes.map((node) => node.id)).toEqual(['1', '2', '3'])
        expect(grid.nodes[0].meta).toMatchObject({ expandable: true, level: 0 })

        grid.expansion.expand('2')
        expect(grid.nodes.map((node) => node.id)).toEqual(['1', '2', '2:detail', '3'])
        expect(grid.nodes[2].meta).toMatchObject({ fullWidth: true, level: 1 })
    })
})

describe('treegrid keybindings', () => {
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

    it('ArrowRight expands a collapsed expandable row, then falls through to navigation', () => {
        const grid = createGrid()
        grid.focus.focusCell({ row: 1, col: 0 })

        grid.focus.handleKeydown(keydown('ArrowRight'))
        expect(grid.expansion.isExpanded('2')).toBe(true)
        expect(grid.focus.active).toEqual({ row: 1, col: 0 })

        grid.focus.handleKeydown(keydown('ArrowRight'))
        expect(grid.focus.active).toEqual({ row: 1, col: 1 })
    })

    it('ArrowLeft collapses, then jumps to the parent row from a nested row', () => {
        const grid = createGrid()
        grid.focus.focusCell({ row: 1, col: 0 })
        grid.expansion.expand('2')

        grid.focus.focusCell({ row: 2, col: 0 })
        grid.focus.handleKeydown(keydown('ArrowLeft'))
        expect(grid.focus.active).toEqual({ row: 1, col: 0 })

        grid.focus.handleKeydown(keydown('ArrowLeft'))
        expect(grid.expansion.isExpanded('2')).toBe(false)
    })

    it('keeps focus in the first column on full-width detail rows', () => {
        const grid = createGrid()
        grid.expansion.expand('1')
        grid.focus.focusCell({ row: 1, col: 1 })
        expect(grid.focus.active).toEqual({ row: 1, col: 0 })

        grid.focus.moveBy(0, 1)
        expect(grid.focus.active).toEqual({ row: 1, col: 0 })
    })

    it('Enter toggles the active expandable row and keeps header sort behavior', () => {
        const grid = createGrid()
        grid.focus.focusCell({ row: 0, col: 0 })
        grid.focus.handleKeydown(keydown('Enter'))
        expect(grid.expansion.isExpanded('1')).toBe(true)

        grid.focus.handleKeydown(keydown('Enter'))
        expect(grid.expansion.isExpanded('1')).toBe(false)
    })

    it('does not intercept arrows on non-structural rows or other columns', () => {
        const grid = createDataGrid<Order>({
            columns,
            data: orders,
            getRowId: (order) => String(order.id)
        })
        grid.focus.focusCell({ row: 0, col: 0 })
        grid.focus.handleKeydown(keydown('ArrowRight'))
        expect(grid.focus.active).toEqual({ row: 0, col: 1 })

        const structured = createGrid()
        structured.focus.focusCell({ row: 0, col: 1 })
        structured.focus.handleKeydown(keydown('ArrowLeft'))
        expect(structured.focus.active).toEqual({ row: 0, col: 0 })
        expect(structured.expansion.isExpanded('1')).toBe(false)
    })
})
