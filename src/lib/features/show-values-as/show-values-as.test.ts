import { createDataGrid } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { filtering } from '../../features/filtering/index.js'
import { describe, expect, it, vi } from 'vitest'
import { grouping } from '../grouping/index.js'
import { tree } from '../tree/index.js'
import { getShowValuesAs, showValuesAs } from './show-values-as.svelte.js'
import type { ShowValuesAsOptions } from './show-values-as.types.js'

interface Sale {
    id: number
    region: string
    rep: string
    q1: number
    q2: number
    revenue: number
}

const columns: ColumnDef<Sale>[] = [
    { id: 'region', header: 'Region', filter: 'text' },
    { id: 'rep', header: 'Rep' },
    { id: 'q1', header: 'Q1', type: 'percent' },
    { id: 'q2', header: 'Q2', type: 'percent' },
    { id: 'revenue', header: 'Revenue', type: 'percent' }
]

const sales: Sale[] = [
    { id: 1, region: 'north', rep: 'Chi', q1: 30, q2: 70, revenue: 100 },
    { id: 2, region: 'north', rep: 'An', q1: 50, q2: 50, revenue: 300 },
    { id: 3, region: 'south', rep: 'Bao', q1: 20, q2: 80, revenue: 600 }
]

function grid(options: ShowValuesAsOptions, by: string[] = []) {
    return createDataGrid<Sale>({
        columns,
        data: sales,
        getRowId: (row) => String(row.id),
        features: [
            filtering(),
            grouping<Sale>({ by, aggregations: { revenue: 'sum' }, grandTotal: true }),
            showValuesAs<Sale>(options)
        ]
    })
}

const shown = (built: ReturnType<typeof grid>, columnId: keyof Sale) =>
    built.preWindowNodes.map((node) => [node.id, node.row[columnId]] as const)

describe('a column shown as a share of the whole', () => {
    it('divides every row by the column total', () => {
        const built = grid({ columns: { revenue: 'percentOfGrandTotal' } })

        expect(shown(built, 'revenue')).toEqual([
            ['1', 0.1],
            ['2', 0.3],
            ['3', 0.6],
            ['total:grand', 1]
        ])
    })

    it('counts only the rows that survived the filter', () => {
        const built = grid({ columns: { revenue: 'percentOfGrandTotal' } })
        built.api.setColumnFilter?.('region', { kind: 'text', op: 'equals', value: 'north' })

        expect(shown(built, 'revenue')).toEqual([
            ['1', 0.25],
            ['2', 0.75],
            ['total:grand', 1]
        ])
    })

    it('leaves a column nobody asked about alone', () => {
        const built = grid({ columns: { revenue: 'percentOfGrandTotal' } })
        expect(built.preWindowNodes[0]!.row.q1).toBe(30)
    })

    it('writes null rather than dividing by nothing', () => {
        const built = createDataGrid<Sale>({
            columns,
            data: [{ id: 1, region: 'north', rep: 'Chi', q1: 0, q2: 0, revenue: 0 }],
            getRowId: (row) => String(row.id),
            features: [showValuesAs<Sale>({ columns: { revenue: 'percentOfGrandTotal' } })]
        })

        expect(built.preWindowNodes[0]!.row.revenue).toBeNull()
    })
})

describe('a column shown as a share of the group it sits in', () => {
    it('divides a row by its own group, and the group by the whole', () => {
        const built = grid({ columns: { revenue: 'percentOfParent' } }, ['region'])

        expect(shown(built, 'revenue')).toEqual([
            ['group:region=north', 0.4],
            ['1', 0.25],
            ['2', 0.75],
            ['group:region=south', 0.6],
            ['3', 1],
            ['total:grand', 1]
        ])
    })

    it('falls back to the whole when there is no group above the row', () => {
        const built = grid({ columns: { revenue: 'percentOfParent' } })

        expect(shown(built, 'revenue')).toEqual([
            ['1', 0.1],
            ['2', 0.3],
            ['3', 0.6],
            ['total:grand', 1]
        ])
    })

    it('reads the parent row of a tree the same way it reads a group', () => {
        interface Task {
            id: number
            parentId: number | null
            cost: number
        }

        const rows: Task[] = [
            { id: 1, parentId: null, cost: 100 },
            { id: 2, parentId: 1, cost: 40 },
            { id: 3, parentId: 1, cost: 10 }
        ]

        const built = createDataGrid<Task>({
            columns: [
                { id: 'id', header: 'Id' },
                { id: 'cost', header: 'Cost', type: 'percent' }
            ],
            data: rows,
            getRowId: (row) => String(row.id),
            features: [
                tree<Task>({
                    getParentId: (row) => (row.parentId === null ? null : String(row.parentId)),
                    defaultExpandedDepth: 2
                }),
                showValuesAs<Task>({ columns: { cost: 'percentOfParent' } })
            ]
        })

        expect(built.preWindowNodes.map((node) => [node.id, node.row.cost])).toEqual([
            ['1', 1],
            ['2', 0.4],
            ['3', 0.1]
        ])
    })
})

describe('a column shown as a share of its own row', () => {
    it('divides by the columns named beside it', () => {
        const built = grid({
            columns: {
                q1: { kind: 'percentOfRow', of: ['q1', 'q2'] },
                q2: { kind: 'percentOfRow', of: ['q1', 'q2'] }
            }
        })

        expect(shown(built, 'q1')).toEqual([
            ['1', 0.3],
            ['2', 0.5],
            ['3', 0.2],
            ['total:grand', null]
        ])
        expect(built.preWindowNodes[0]!.row.q2).toBe(0.7)
    })

    it('ignores a column id that is not in the grid', () => {
        const built = grid({ columns: { q1: { kind: 'percentOfRow', of: ['q1', 'nope'] } } })
        expect(built.preWindowNodes[0]!.row.q1).toBe(1)
    })
})

describe('what an app can change while the grid is running', () => {
    it('turns a share on and off again', () => {
        const built = grid({})
        expect(built.preWindowNodes[0]!.row.revenue).toBe(100)

        built.api.setShowValuesAs?.('revenue', 'percentOfGrandTotal')
        expect(built.preWindowNodes[0]!.row.revenue).toBe(0.1)

        built.api.setShowValuesAs?.('revenue', null)
        expect(built.preWindowNodes[0]!.row.revenue).toBe(100)
    })

    it('hands back what a column is showing, for a panel to tick', () => {
        const built = grid({ columns: { revenue: 'percentOfGrandTotal' } })

        expect(built.api.showValuesAsFor?.('revenue')).toBe('percentOfGrandTotal')
        expect(built.api.showValuesAsFor?.('q1')).toBeUndefined()
    })

    it('clears every column at once', () => {
        const built = grid({ columns: { revenue: 'percentOfGrandTotal' } })
        built.api.clearShowValuesAs?.()

        expect(built.preWindowNodes[0]!.row.revenue).toBe(100)
    })
})

describe('a share travels with the view it was saved in', () => {
    it('survives getState and setState', () => {
        const source = grid({
            columns: {
                revenue: 'percentOfParent',
                q1: { kind: 'percentOfRow', of: ['q1', 'q2'] }
            }
        })
        const snapshot = source.getState()

        const target = grid({})
        target.setState(snapshot)

        expect(getShowValuesAs(target)!.shown).toEqual({
            revenue: 'percentOfParent',
            q1: { kind: 'percentOfRow', of: ['q1', 'q2'] }
        })
    })

    it('leaves nothing in the snapshot when no column is shown as a share', () => {
        expect(getShowValuesAs(grid({}))!.serialize()).toBeUndefined()
    })

    it('ignores a saved shape it does not recognise', () => {
        const built = grid({ columns: { revenue: 'percentOfGrandTotal' } })
        getShowValuesAs(built)!.hydrate({ revenue: 'nonsense', q1: { kind: 'percentOfRow' } })

        expect(getShowValuesAs(built)!.shown).toEqual({})
    })
})

describe('percentOfParent without an aggregation to divide by', () => {
    it('says so once rather than drawing a blank column in silence', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const built = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (sale) => String(sale.id),
            features: [
                grouping({ by: ['region'], aggregations: {} }),
                showValuesAs({ columns: { revenue: 'percentOfParent' } })
            ]
        })

        expect(built.preWindowNodes.length).toBeGreaterThan(0)
        expect(built.preWindowNodes.length).toBeGreaterThan(0)

        expect(warn).toHaveBeenCalledTimes(1)
        expect(String(warn.mock.calls[0]![0])).toContain('percentOfParent')
        warn.mockRestore()
    })
})
