import { createDataGrid, type GridState } from '../../core/grid/index.js'
import { type ColumnDef } from '../../core/types/index.js'
import { filtering } from '../../features/filtering/index.js'
import { pagination } from '../../features/pagination/index.js'
import { sorting } from '../../features/sorting/index.js'
import { virtualization } from '../../features/virtualization/index.js'
import { describe, expect, it, vi } from 'vitest'
import { formula } from '../formula/index.js'
import { grouping } from '../grouping/index.js'
import { serverRowModel } from '../server-row-model/index.js'
import { tree } from '../tree/index.js'
import type { ConditionalFormattingOptions, FormatRule } from './conditional-formatting.types.js'
import { conditionalFormatting, getConditionalFormatting } from './conditional-formatting.svelte.js'

interface Deal {
    id: number
    owner: string
    status: string
    amount: number
    qty: number
    email: string
    total?: number
}

const deals: Deal[] = [
    { id: 1, owner: 'ann', status: 'open', amount: 100, qty: 2, email: 'a@x.com' },
    { id: 2, owner: 'bob', status: 'overdue', amount: 400, qty: 1, email: 'b@x.com' },
    { id: 3, owner: 'ann', status: 'open', amount: 200, qty: 3, email: 'a@x.com' },
    { id: 4, owner: 'cid', status: 'won', amount: 0, qty: 5, email: 'c@x.com' }
]

const columns: ColumnDef<Deal>[] = [
    { id: 'owner', header: 'Owner', sortable: true, filter: 'text' },
    { id: 'status', header: 'Status', filter: 'text' },
    { id: 'amount', header: 'Amount', sortable: true, filter: 'number' },
    { id: 'qty', header: 'Qty' },
    { id: 'email', header: 'Email' },
    { id: 'total', header: 'Total' }
]

function build(options: ConditionalFormattingOptions, extra: unknown[] = []) {
    return createDataGrid<Deal>({
        columns,
        data: deals,
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            filtering(),
            ...(extra as never[]),
            conditionalFormatting<Deal>(options)
        ]
    })
}

function decorate(grid: GridState<Deal>, rowIndex: number, columnId: string) {
    const node = grid.preWindowNodes[rowIndex]!
    const column = grid.columns.visible.find((entry) => entry.id === columnId)!
    return getConditionalFormatting(grid)!.decoration(node, column)
}

describe('rules paint the cells they name', () => {
    it('paints only the column the rule names', () => {
        const grid = build({ rules: [{ kind: 'colorScale', column: 'amount' }] })
        expect(decorate(grid, 0, 'amount')?.style).toBeDefined()
        expect(decorate(grid, 0, 'owner')).toBeUndefined()
    })

    it('scales against the column, so the largest row is the fullest', () => {
        const grid = build({ rules: [{ kind: 'colorScale', column: 'amount' }] })
        expect(decorate(grid, 1, 'amount')?.style?.['background-color']).toContain('100%')
        expect(decorate(grid, 3, 'amount')?.style?.['background-color']).toContain('0%')
    })

    it('places a middle value where the arithmetic says, not merely between the ends', () => {
        const grid = createDataGrid<Deal>({
            columns,
            data: [
                { id: 1, owner: 'a', status: 'open', amount: 0, qty: 1, email: 'a@x' },
                { id: 2, owner: 'b', status: 'open', amount: 25, qty: 1, email: 'b@x' },
                { id: 3, owner: 'c', status: 'open', amount: 90, qty: 1, email: 'c@x' },
                { id: 4, owner: 'd', status: 'open', amount: 100, qty: 1, email: 'd@x' }
            ],
            getRowId: (row) => String(row.id),
            features: [
                conditionalFormatting<Deal>({ rules: [{ kind: 'colorScale', column: 'amount' }] })
            ]
        })

        const shades = grid.preWindowNodes.map(
            (_, index) => decorate(grid, index, 'amount')?.style?.['background-color']
        )

        expect(shades).toEqual([
            'color-mix(in oklab, var(--color-primary) 0%, transparent)',
            'color-mix(in oklab, var(--color-primary) 25%, transparent)',
            'color-mix(in oklab, var(--color-primary) 90%, transparent)',
            'color-mix(in oklab, var(--color-primary) 100%, transparent)'
        ])
    })

    it('paints every cell of the row for an expression rule with no column', () => {
        const grid = build({ rules: [{ kind: 'expression', when: 'status = "overdue"' }] })
        expect(decorate(grid, 1, 'owner')?.class).toBeTruthy()
        expect(decorate(grid, 1, 'amount')?.class).toBeTruthy()
        expect(decorate(grid, 0, 'owner')).toBeUndefined()
    })

    it('reads a duplicate across the whole column, not within the row', () => {
        const grid = build({ rules: [{ kind: 'duplicates', column: 'email' }] })
        expect(decorate(grid, 0, 'email')?.class).toBeTruthy()
        expect(decorate(grid, 1, 'email')).toBeUndefined()
    })

    it('merges two rules on one cell, the later winning the property they share', () => {
        const grid = build({
            rules: [
                {
                    kind: 'expression',
                    column: 'amount',
                    when: 'amount > 0',
                    style: { color: 'red' }
                },
                {
                    kind: 'expression',
                    column: 'amount',
                    when: 'amount > 0',
                    style: { color: 'blue' }
                }
            ]
        })
        expect(decorate(grid, 0, 'amount')?.style).toEqual({ color: 'blue' })
    })
})

describe('the rules follow the grid', () => {
    it('rescales after a filter, so the ramp spans what is on screen', () => {
        const grid = build({ rules: [{ kind: 'colorScale', column: 'amount' }] })
        expect(decorate(grid, 1, 'amount')?.style?.['background-color']).toContain('100%')

        grid.api.setColumnFilter?.('amount', { kind: 'number', op: 'lt', value: 300 })
        const top = grid.preWindowNodes.findIndex((node) => node.row.amount === 200)
        expect(decorate(grid, top, 'amount')?.style?.['background-color']).toContain('100%')
    })

    it('ranks against the filtered set for topN', () => {
        const grid = build({ rules: [{ kind: 'topN', column: 'amount', n: 1 }] })
        expect(decorate(grid, 1, 'amount')?.class).toBeTruthy()
        expect(decorate(grid, 2, 'amount')).toBeUndefined()
    })

    it('sees a formula column, which is the part a spreadsheet grid usually cannot', () => {
        const grid = build({ rules: [{ kind: 'colorScale', column: 'total' }] }, [
            formula<Deal>({ columns: { total: 'amount * qty' } })
        ])
        const totals = grid.preWindowNodes.map((node) => node.row.total)
        expect(totals).toEqual([200, 400, 600, 0])
        expect(decorate(grid, 2, 'total')?.style?.['background-color']).toContain('100%')
    })

    it('leaves the group rows out of the range they would otherwise distort', () => {
        const grid = build({ rules: [{ kind: 'colorScale', column: 'amount' }] }, [
            grouping<Deal>({ by: ['owner'], aggregations: { amount: 'sum' } })
        ])
        const rows = grid.preWindowNodes.filter((node) => node.row.amount === 400)
        expect(rows.length).toBeGreaterThan(0)
        const index = grid.preWindowNodes.findIndex((node) => node.id === '2')
        expect(decorate(grid, index, 'amount')?.style?.['background-color']).toContain('100%')
    })
})

describe('the rules see the rows a structural feature nested', () => {
    interface Node {
        id: number
        owner: string
        amount: number
        reports?: Node[]
    }

    const nested: Node[] = [
        { id: 1, owner: 'ann', amount: 10, reports: [{ id: 2, owner: 'bob', amount: 100 }] }
    ]

    it('spans a colour scale over tree children, not only over the roots', () => {
        const grid = createDataGrid<Node>({
            columns: [
                { id: 'owner', header: 'Owner' },
                { id: 'amount', header: 'Amount' }
            ],
            data: nested,
            getRowId: (row) => String(row.id),
            features: [
                tree<Node>({ getChildren: (row) => row.reports, defaultExpandedDepth: 2 }),
                conditionalFormatting<Node>({ rules: [{ kind: 'colorScale', column: 'amount' }] })
            ]
        })
        const state = getConditionalFormatting(grid)!
        const column = grid.columns.visible.find((entry) => entry.id === 'amount')!
        const [root, child] = grid.preWindowNodes

        expect(state.decoration(root!, column)?.style?.['background-color']).toContain('0%')
        expect(state.decoration(child!, column)?.style?.['background-color']).toContain('100%')
    })
})

describe('the rules span the data, not the page', () => {
    it('ranks over every filtered row while pagination shows one page', () => {
        const grid = createDataGrid<Deal>({
            columns,
            data: deals,
            getRowId: (row) => String(row.id),
            features: [
                sorting(),
                pagination({ pageSize: 2 }),
                conditionalFormatting<Deal>({ rules: [{ kind: 'topN', column: 'amount', n: 1 }] })
            ]
        })
        expect(grid.nodes).toHaveLength(2)

        const state = getConditionalFormatting(grid)!
        const amount = grid.columns.visible.find((entry) => entry.id === 'amount')!
        const painted = grid.preWindowNodes.filter((node) => state.decoration(node, amount))

        expect(painted.map((node) => node.row.amount)).toEqual([400])
    })
})

describe('the rule list is state, not code', () => {
    it('round-trips through serialize and hydrate', () => {
        const grid = build({ rules: [{ kind: 'topN', column: 'amount', n: 2 }] })
        const snapshot = JSON.parse(JSON.stringify(grid.api.getState?.()))

        const restored = build({})
        restored.api.setState?.(snapshot)
        expect(restored.api.getFormatRules?.()).toEqual([
            expect.objectContaining({ kind: 'topN', column: 'amount', n: 2 })
        ])
    })

    it('hands out copies, so an app cannot edit the live rules through a snapshot', () => {
        const grid = build({ rules: [{ kind: 'topN', column: 'amount', n: 2 }] })
        const taken = grid.api.getFormatRules?.() ?? []
        taken[0]!.column = 'qty'

        expect(grid.api.getFormatRules?.()[0]!.column).toBe('amount')
    })

    it('removes only the rule named, when two rules share a kind', () => {
        const grid = build({})
        grid.api.addFormatRule?.({ kind: 'duplicates', column: 'email' })
        grid.api.addFormatRule?.({ kind: 'duplicates', column: 'owner' })
        const [first] = grid.api.getFormatRules?.() ?? []

        grid.api.removeFormatRule?.(first!.id!)
        expect(grid.api.getFormatRules?.()).toHaveLength(1)
        expect(decorate(grid, 0, 'email')).toBeUndefined()
    })

    it('adds and removes a rule by id at runtime', () => {
        const grid = build({})
        grid.api.addFormatRule?.({ kind: 'duplicates', column: 'email', id: 'dupes' })
        expect(decorate(grid, 0, 'email')?.class).toBeTruthy()

        grid.api.removeFormatRule?.('dupes')
        expect(decorate(grid, 0, 'email')).toBeUndefined()
    })

    it('replaces the whole list and clears it', () => {
        const grid = build({ rules: [{ kind: 'colorScale', column: 'amount' }] })
        grid.api.setFormatRules?.([{ kind: 'colorScale', column: 'qty' }])
        expect(decorate(grid, 0, 'amount')).toBeUndefined()
        expect(decorate(grid, 0, 'qty')?.style).toBeDefined()

        grid.api.clearFormatRules?.()
        expect(decorate(grid, 0, 'qty')).toBeUndefined()
    })

    it('reports a broken expression once and paints nothing for it', () => {
        const onParseError = vi.fn()
        const grid = build({ rules: [{ kind: 'expression', when: 'status =' }], onParseError })
        expect(onParseError).toHaveBeenCalledOnce()
        expect(decorate(grid, 0, 'status')).toBeUndefined()
    })

    it('ignores a hydrated payload that is not a rule list', () => {
        const grid = build({ rules: [{ kind: 'colorScale', column: 'amount' }] })
        getConditionalFormatting(grid)!.hydrate({ evil: true })
        expect(decorate(grid, 0, 'amount')?.style).toBeDefined()
    })

    it('drops a hydrated rule naming a kind the feature does not have', () => {
        const grid = build({})
        getConditionalFormatting(grid)!.hydrate([
            { kind: 'script', column: 'amount' },
            { kind: 'colorScale', column: 'amount' }
        ] as unknown as FormatRule[])
        expect(grid.api.getFormatRules?.()).toHaveLength(1)
    })
})

describe('a rule that ranks a value against the whole column, on a server row model', () => {
    interface Row {
        id: number
        total: number
    }

    const serverColumns: ColumnDef<Row>[] = [{ id: 'total', header: 'Total' }]
    const table: Row[] = Array.from({ length: 40 }, (_, i) => ({ id: i + 1, total: (i + 1) * 100 }))

    function serverGrid(rules: FormatRule[]): GridState<Row> {
        return createDataGrid<Row>({
            columns: serverColumns,
            data: [],
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [
                virtualization(),
                serverRowModel<Row>(
                    {
                        getRows: async ({ startRow, endRow }) => ({
                            rows: table.slice(startRow, Math.min(endRow, 10)),
                            rowCount: 40
                        })
                    },
                    {
                        mode: 'infinite',
                        blockSize: 10,
                        placeholder: (index) => ({ id: -index - 1, total: 0 })
                    }
                ),
                conditionalFormatting<Row>({ rules })
            ]
        })
    }

    async function loaded(grid: GridState<Row>) {
        grid.feature<{ refresh: () => void }>('serverRowModel')!.refresh()
        await vi.waitFor(() => expect(grid.data.length).toBe(40))
        return grid
    }

    it('skips it, and says which rules it skipped', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = await loaded(
            serverGrid([
                { kind: 'colorScale', id: 'scale', column: 'total' },
                { kind: 'topN', id: 'top', column: 'total', n: 3 }
            ])
        )

        const state = getConditionalFormatting(grid)!
        const column = grid.columns.visible[0]!
        const painted = grid.preWindowNodes
            .slice(0, 10)
            .filter((node) => state.decoration(node, column) !== undefined)

        expect(painted).toHaveLength(0)
        expect(state.skippedRules).toEqual(['scale', 'top'])
        expect(warn).toHaveBeenCalledTimes(1)
        expect(warn.mock.calls[0]?.[0]).toContain('skips colorScale, dataBar, topN and duplicates')
        warn.mockRestore()
    })

    it('keeps painting an expression rule, which only ever reads one row', async () => {
        const grid = await loaded(
            serverGrid([
                {
                    kind: 'expression',
                    id: 'flag',
                    column: 'total',
                    when: 'total > 500',
                    style: { 'background-color': 'var(--color-error)' }
                }
            ])
        )

        const state = getConditionalFormatting(grid)!
        const column = grid.columns.visible[0]!
        const painted = grid.preWindowNodes
            .slice(0, 10)
            .filter((node) => state.decoration(node, column) !== undefined)

        expect(painted.map((node) => node.id)).toEqual(['6', '7', '8', '9', '10'])
        expect(state.skippedRules).toEqual([])
    })

    it('paints every rule on a client grid, where the whole column is here', () => {
        const grid = createDataGrid<Row>({
            columns: serverColumns,
            data: table,
            getRowId: (row) => String(row.id),
            features: [
                sorting(),
                conditionalFormatting<Row>({
                    rules: [{ kind: 'colorScale', id: 'scale', column: 'total' }]
                })
            ]
        })

        const state = getConditionalFormatting(grid)!
        expect(state.skippedRules).toEqual([])
        expect(state.decoration(grid.nodes[0]!, grid.columns.visible[0]!)).toBeDefined()
    })
})
