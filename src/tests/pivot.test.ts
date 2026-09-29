import { describe, expect, it, vi } from 'vitest'
import {
    createDataGrid,
    editing,
    filtering,
    getEditing,
    getSorting,
    getFiltering,
    grouping,
    masterDetail,
    pickColumns,
    rowsToMatrix,
    selection,
    sorting,
    toCsv,
    tree,
    type ColumnDef,
    type GridState,
    type RowNode
} from '$lib/index.js'
import { getPivot, isPivotColumn, pivot, type PivotOptions } from '../lib/features/pivot/index.js'
import { getShowValuesAs, showValuesAs, type ShowAs } from '../lib/features/show-values-as/index.js'

interface Sale {
    id: number
    region: string
    product: string
    quarter: string
    amount: number
}

const sales: Sale[] = [
    { id: 1, region: 'North', product: 'Widget', quarter: 'Q1', amount: 100 },
    { id: 2, region: 'North', product: 'Widget', quarter: 'Q2', amount: 150 },
    { id: 3, region: 'North', product: 'Gadget', quarter: 'Q1', amount: 80 },
    { id: 4, region: 'South', product: 'Widget', quarter: 'Q1', amount: 200 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region', filter: 'text' },
    { id: 'product' },
    { id: 'quarter', filter: 'text' },
    { id: 'amount', type: 'number' }
]

const crossing: PivotOptions<Sale> = {
    rows: ['region'],
    columns: ['quarter'],
    values: [{ field: 'amount', agg: 'sum' }]
}

function build(
    options: Partial<PivotOptions<Sale>> = {},
    defs: ColumnDef<Sale>[] = columns,
    extra: Record<string, unknown> = {}
): GridState<Sale> {
    return createDataGrid<Sale>({
        columns: defs,
        data: sales,
        getRowId: (row) => String(row.id),
        features: [filtering(), pivot<Sale>({ ...crossing, ...options })],
        ...extra
    })
}

const columnIds = (grid: GridState<Sale>): string[] => grid.columns.visible.map((c) => c.id)

function table(
    grid: GridState<Sale>,
    rowField = 'region'
): Record<string, Record<string, unknown>> {
    const leaves = grid.columns.visible.filter((column) => isPivotColumn(column.id))
    const label = grid.columns.visible.find((column) => column.id === rowField)!
    const out: Record<string, Record<string, unknown>> = {}
    for (const node of grid.preWindowNodes) {
        if (!node.meta?.expandable) continue
        const cells: Record<string, unknown> = {}
        for (const column of leaves) cells[String(column.def.header)] = grid.getValue(node, column)
        out[String(grid.getValue(node, label))] = cells
    }
    return out
}

function cellsOf(grid: GridState<Sale>, node: RowNode<Sale>): Record<string, unknown> {
    const out: Record<string, unknown> = {}
    for (const column of grid.columns.visible) {
        if (!isPivotColumn(column.id)) continue
        out[String(column.def.header)] = grid.getValue(node, column)
    }
    return out
}

describe('pivot crosses one field by another', () => {
    it('gives the worked example its table', () => {
        const grid = build()

        expect(columnIds(grid)).toEqual(['region', '__pv:c:Q1::0', '__pv:c:Q2::0'])
        expect(table(grid)).toEqual({
            North: { Q1: 180, Q2: 150 },
            South: { Q1: 200, Q2: undefined }
        })
    })

    it('leaves a crossing with no rows empty rather than zero', () => {
        const cell = table(build())['South']!['Q2']

        expect(cell).toBeUndefined()
        expect(cell).not.toBe(0)
    })

    it('draws the row fields and the crossing, and puts every other column away', () => {
        const ids = columnIds(build())

        expect(ids).toContain('region')
        expect(ids).not.toContain('quarter')
        expect(ids).not.toContain('amount')
        expect(ids).not.toContain('product')
    })

    it('brings those columns back the moment the crossing stops', () => {
        const grid = build()
        grid.api.clearPivot?.()

        expect(columnIds(grid)).toEqual(['region', 'product', 'quarter', 'amount'])
    })

    it('hands back the application columns untouched when pivot is not registered', () => {
        const plain = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            features: [filtering()]
        })

        expect(columnIds(plain)).toEqual(['region', 'product', 'quarter', 'amount'])
        expect(columnIds(plain).some(isPivotColumn)).toBe(false)
    })

    it('names its columns through columnHeader', () => {
        const grid = build({ columnHeader: (key: string) => `${key} sales` })

        expect(grid.columns.visible.map((c) => c.def.header)).toContain('Q1 sales')
    })
})

describe('pivot reads the column field the way the grid does', () => {
    it('crosses on the accessor, not the raw property', () => {
        const byHalf: ColumnDef<Sale>[] = [
            { id: 'region' },
            { id: 'half', accessor: (row) => (row.quarter === 'Q1' ? 'H1' : 'H2') },
            { id: 'amount', type: 'number' }
        ]
        const grid = build({ columns: ['half'] }, byHalf)

        expect(columnIds(grid)).toEqual(['region', '__pv:c:H1::0', '__pv:c:H2::0'])
        expect(table(grid)).toEqual({
            North: { H1: 180, H2: 150 },
            South: { H1: 200, H2: undefined }
        })
    })

    it('measures through the accessor of the value column', () => {
        const doubled: ColumnDef<Sale>[] = [
            { id: 'region' },
            { id: 'quarter' },
            { id: 'amount', type: 'number', accessor: (row) => row.amount * 2 }
        ]

        expect(table(build({}, doubled))['South']!['Q1']).toBe(400)
    })

    it('buckets a blank column value under (blank)', () => {
        const grid = createDataGrid<Sale>({
            columns,
            data: [...sales, { id: 5, region: 'South', product: 'Widget', quarter: '', amount: 7 }],
            getRowId: (row) => String(row.id),
            features: [pivot<Sale>(crossing)]
        })

        expect(columnIds(grid)).toContain('__pv:c:(blank)::0')
        expect(table(grid)['South']!['(blank)']).toBe(7)
    })
})

describe('pivot against a filter', () => {
    it('keeps the column of a key the filter emptied, and empties its cells', () => {
        const grid = build()
        getFiltering(grid)!.setColumnFilter('quarter', {
            kind: 'text',
            op: 'equals',
            value: 'Q1'
        })

        expect(columnIds(grid)).toContain('__pv:c:Q2::0')
        expect(table(grid)).toEqual({
            North: { Q1: 180, Q2: undefined },
            South: { Q1: 200, Q2: undefined }
        })
    })

    it('recrosses when the filter narrows the rows', () => {
        const grid = build()
        getFiltering(grid)!.setColumnFilter('region', {
            kind: 'text',
            op: 'equals',
            value: 'North'
        })

        expect(Object.keys(table(grid))).toEqual(['North'])
        expect(table(grid)['North']).toEqual({ Q1: 180, Q2: 150 })
    })
})

describe('pivot columns are not the data', () => {
    it('refuses to hand an editor a draft of a crossed cell', () => {
        const grid = build()
        const leaf = grid.columns.visible.find((column) => isPivotColumn(column.id))!

        expect(grid.readerFor(leaf.id, 'edit')).toBeDefined()
        expect(grid.readerFor('region', 'edit')).toBeUndefined()
    })

    it('lets a crossed cell out every other way a value leaves the grid', () => {
        const grid = build()
        const leaf = grid.columns.visible.find((column) => isPivotColumn(column.id))!

        for (const purpose of ['render', 'export', 'clipboard', 'search', 'facet'] as const) {
            expect(grid.readerFor(leaf.id, purpose)).toBeUndefined()
        }
    })

    it('does not offer a crossed column for sorting', () => {
        const grid = build()
        const leaf = grid.columns.visible.find((column) => isPivotColumn(column.id))!

        expect(leaf.def.sortable).toBe(false)
    })
})

describe('pivot at its edges', () => {
    it('crosses nothing and hides nothing extra when there are no rows', () => {
        const grid = createDataGrid<Sale>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            features: [pivot<Sale>(crossing)]
        })

        expect(columnIds(grid)).toEqual(['region'])
        expect(grid.preWindowNodes).toHaveLength(0)
    })

    it('draws a crossing that lands exactly on maxColumns', () => {
        const grid = build({ maxColumns: 2 })

        expect(columnIds(grid).filter(isPivotColumn)).toEqual(['__pv:c:Q1::0', '__pv:c:Q2::0'])
    })

    it('keeps the generated columns in sorted order, not the order the rows arrive', () => {
        const shuffled = [...sales].reverse()
        const grid = createDataGrid<Sale>({
            columns,
            data: [
                ...shuffled,
                { id: 9, region: 'North', product: 'Widget', quarter: 'Q3', amount: 1 }
            ],
            getRowId: (row) => String(row.id),
            features: [pivot<Sale>(crossing)]
        })

        expect(columnIds(grid).filter(isPivotColumn)).toEqual([
            '__pv:c:Q1::0',
            '__pv:c:Q2::0',
            '__pv:c:Q3::0'
        ])
    })

    it('says so rather than quietly drawing nothing when a field names no column', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = createDataGrid<Sale>({
            columns: [{ id: 'region' }, { id: 'amount', type: 'number' }],
            data: sales,
            getRowId: (row) => String(row.id),
            features: [pivot<Sale>(crossing)]
        })

        void columnIds(grid)
        expect(columnIds(grid)).toEqual(['region', 'amount'])
        const said = warn.mock.calls.filter((call) => String(call[0]).includes('no column defined'))
        expect(said).toHaveLength(1)
        expect(String(said[0]![0])).toContain('quarter')
        warn.mockRestore()
    })
})

describe('pivot says no rather than guessing', () => {
    it('will not cross a server grid on its own, and says so once', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            rowModel: 'server',
            features: [pivot<Sale>(crossing)]
        })

        void grid.preWindowNodes
        void grid.preWindowNodes

        expect(columnIds(grid)).toEqual(['region', 'product', 'quarter', 'amount'])
        expect(grid.preWindowNodes.some((node) => node.meta?.expandable)).toBe(false)
        expect(warn.mock.calls.filter((call) => String(call[0]).includes('pivot()'))).toHaveLength(
            1
        )
        warn.mockRestore()
    })

    it('draws nothing past maxColumns, and says so once', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = build({ maxColumns: 1 })

        void columnIds(grid)
        expect(columnIds(grid)).toEqual(['region', 'product', 'quarter', 'amount'])
        expect(
            warn.mock.calls.filter((call) => String(call[0]).includes('maxColumns'))
        ).toHaveLength(1)
        warn.mockRestore()
    })

    it('refuses a crossing it cannot make', () => {
        expect(() => build({ rows: [] })).toThrow(/row field/)
        expect(() => build({ columns: [] })).toThrow(/column field/)
        expect(() => build({ values: [] })).toThrow(/at least one value/)
    })

    it.each([
        ['grouping', () => grouping<Sale>({ by: ['region'] })],
        ['tree', () => tree<Sale>({ getChildren: () => [] })],
        ['masterDetail', () => masterDetail<Sale>({})]
    ])('refuses to run beside %s, which also decides what a row is', (id, feature) => {
        expect(() =>
            createDataGrid<Sale>({
                columns,
                data: sales,
                getRowId: (row) => String(row.id),
                features: [feature(), pivot<Sale>(crossing)]
            })
        ).toThrow(new RegExp(`beside ${id}\\(\\)`))
    })
})

describe('pivot gathers more than one field down the page', () => {
    it('nests the second row field inside the first', () => {
        const grid = build({ rows: ['region', 'product'] })
        grid.expansion.expandAll(
            grid.preWindowNodes.filter((node) => node.meta?.expandable).map((node) => node.id)
        )

        const levels = grid.preWindowNodes
            .filter((node) => node.meta?.expandable)
            .map((node) => node.meta!.level)

        expect(levels).toContain(0)
        expect(levels).toContain(1)
    })

    it('crosses each nested group over the same columns', () => {
        const grid = build({ rows: ['region', 'product'] })
        const north = grid.preWindowNodes.find((node) => node.meta?.level === 0)!

        expect(cellsOf(grid, north)).toEqual({ Q1: 180, Q2: 150 })
    })
})

describe('pivot gathers more than one field across the page', () => {
    it('nests the second column field under the first as a header group', () => {
        const grid = build({ columns: ['quarter', 'product'] })
        const shaped = grid.columns.shaped.filter((def) => isPivotColumn(def.id))

        expect(shaped.map((def) => def.header)).toEqual(['Q1', 'Q2'])
        expect(shaped[0]!.children?.map((child) => child.header)).toEqual(['Gadget', 'Widget'])
    })

    it('crosses on the pair, not on either field alone', () => {
        const grid = build({ columns: ['quarter', 'product'] })
        const north = grid.preWindowNodes.find((node) => node.meta?.expandable)!
        const at = (id: string) => grid.getValue(north, grid.columns.get(id)!)

        expect(at('__pv:c:Q1|Gadget::0')).toBe(80)
        expect(at('__pv:c:Q1|Widget::0')).toBe(100)
        expect(at('__pv:c:Q2|Widget::0')).toBe(150)
    })

    it('repeats a leaf header under each group rather than inventing a unique one', () => {
        const grid = build({ columns: ['quarter', 'product'] })
        const headers = grid.columns.visible
            .filter((column) => isPivotColumn(column.id))
            .map((column) => String(column.def.header))

        expect(headers).toEqual(['Gadget', 'Widget', 'Widget'])
        expect(new Set(grid.columns.visible.map((column) => column.id)).size).toBe(
            grid.columns.visible.length
        )
    })
})

describe('pivot measures more than one thing', () => {
    it('splits every crossing into a leaf per measure', () => {
        const grid = build({
            values: [
                { field: 'amount', agg: 'sum', header: 'Sum' },
                { field: 'amount', agg: 'count', header: 'Count' }
            ]
        })
        const shaped = grid.columns.shaped.filter((def) => isPivotColumn(def.id))

        expect(shaped.map((def) => def.header)).toEqual(['Q1', 'Q2'])
        expect(shaped[0]!.children?.map((child) => child.header)).toEqual(['Sum', 'Count'])
    })

    it('measures each leaf its own way', () => {
        const grid = build({
            values: [
                { field: 'amount', agg: 'sum', header: 'Sum' },
                { field: 'amount', agg: 'count', header: 'Count' }
            ]
        })
        const north = grid.preWindowNodes.find((node) => node.meta?.expandable)!

        expect(grid.getValue(north, grid.columns.get('__pv:c:Q1::0')!)).toBe(180)
        expect(grid.getValue(north, grid.columns.get('__pv:c:Q1::1')!)).toBe(2)
    })
})

describe('the total column is measured, not added up', () => {
    it('sums the rows, which for a sum is also the sum of the cells', () => {
        const grid = build({ totalColumn: 'Total' })
        const north = grid.preWindowNodes.find((node) => node.meta?.expandable)!

        expect(grid.getValue(north, grid.columns.get('__pv:t:0')!)).toBe(330)
    })

    it('averages the rows, which is not the average of the cells', () => {
        const grid = build({
            values: [{ field: 'amount', agg: 'avg' }],
            totalColumn: 'Total'
        })
        const north = grid.preWindowNodes.find((node) => node.meta?.expandable)!

        const q1 = grid.getValue(north, grid.columns.get('__pv:c:Q1::0')!) as number
        const q2 = grid.getValue(north, grid.columns.get('__pv:c:Q2::0')!) as number
        const total = grid.getValue(north, grid.columns.get('__pv:t:0')!) as number

        expect(q1).toBe(90)
        expect(q2).toBe(150)
        expect(total).toBe(110)
        expect(total).not.toBe((q1 + q2) / 2)
    })

    it('gives the total column a leaf per measure too', () => {
        const grid = build({
            values: [
                { field: 'amount', agg: 'sum', header: 'Sum' },
                { field: 'amount', agg: 'count', header: 'Count' }
            ],
            totalColumn: 'Total'
        })
        const north = grid.preWindowNodes.find((node) => node.meta?.expandable)!

        expect(grid.getValue(north, grid.columns.get('__pv:t:0')!)).toBe(330)
        expect(grid.getValue(north, grid.columns.get('__pv:t:1')!)).toBe(3)
    })

    it('draws no total column when there is nothing to cross', () => {
        const grid = createDataGrid<Sale>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            features: [pivot<Sale>({ ...crossing, totalColumn: 'Total' })]
        })

        expect(columnIds(grid).some(isPivotColumn)).toBe(false)
    })
})

describe('the total row', () => {
    it('measures every row the grid is showing', () => {
        const grid = build({ totalRow: 'All' })
        const last = grid.preWindowNodes[grid.preWindowNodes.length - 1]!

        expect(grid.getValue(last, grid.columns.get('region')!)).toBe('All')
        expect(grid.getValue(last, grid.columns.get('__pv:c:Q1::0')!)).toBe(380)
        expect(grid.getValue(last, grid.columns.get('__pv:c:Q2::0')!)).toBe(150)
    })

    it('measures what the filter left, not the whole data', () => {
        const grid = build({ totalRow: 'All' })
        getFiltering(grid)!.setColumnFilter('region', {
            kind: 'text',
            op: 'equals',
            value: 'North'
        })
        const last = grid.preWindowNodes[grid.preWindowNodes.length - 1]!

        expect(grid.getValue(last, grid.columns.get('__pv:c:Q1::0')!)).toBe(180)
    })

    it('stays away when there are no rows at all', () => {
        const grid = createDataGrid<Sale>({
            columns,
            data: [],
            getRowId: (row) => String(row.id),
            features: [pivot<Sale>({ ...crossing, totalRow: 'All' })]
        })

        expect(grid.preWindowNodes).toHaveLength(0)
    })
})

describe('pivot counts maxColumns in the leaves that land on screen', () => {
    const twoMeasures = [
        { field: 'amount', agg: 'sum' as const, header: 'Sum' },
        { field: 'amount', agg: 'count' as const, header: 'Count' }
    ]

    it('refuses two measures over two crossings at a limit of two', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = build({ maxColumns: 2, values: twoMeasures })

        expect(columnIds(grid).some(isPivotColumn)).toBe(false)
        expect(
            warn.mock.calls.filter((call) => String(call[0]).includes('for the measures'))
        ).toHaveLength(1)
        warn.mockRestore()
    })

    it('draws them at a limit of four', () => {
        const grid = build({ maxColumns: 4, values: twoMeasures })

        expect(columnIds(grid).filter(isPivotColumn)).toHaveLength(4)
    })

    it('counts a nested crossing as one per leaf combination', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = build({ columns: ['quarter', 'product'], maxColumns: 2 })

        void columnIds(grid)
        expect(columnIds(grid).some(isPivotColumn)).toBe(false)
        expect(
            warn.mock.calls.filter((call) => String(call[0]).includes('maxColumns'))
        ).toHaveLength(1)
        warn.mockRestore()
    })
})

describe('a crossed cell cannot be written back', () => {
    function editable() {
        const grid = createDataGrid<Sale>({
            columns: columns.map((def) => ({ ...def, editable: true })),
            data: sales,
            getRowId: (row) => String(row.id),
            features: [editing(), pivot<Sale>({ ...crossing, totalColumn: 'Total' })]
        })
        const node = grid.preWindowNodes.find((row) => row.meta?.expandable)!
        return { grid, node, state: getEditing(grid)! }
    }

    it('refuses the editor on a crossed column and on the total', () => {
        const { grid, node, state } = editable()

        for (const id of ['__pv:c:Q1::0', '__pv:t:0']) {
            expect(state.editableAt(node, grid.columns.get(id)!.def)).toBe(false)
        }
    })

    it('refuses an empty crossing, where the value and the refusal look alike', () => {
        const { grid, node, state } = editable()
        const south = grid.preWindowNodes.filter((row) => row.meta?.expandable)[1]!

        expect(grid.getValue(south, grid.columns.get('__pv:c:Q2::0')!)).toBeUndefined()
        expect(state.editableAt(south, grid.columns.get('__pv:c:Q2::0')!.def)).toBe(false)
        expect(node).toBeDefined()
    })

    it('drops a crossed cell out of a transaction rather than writing it', () => {
        const { grid, node, state } = editable()

        state.applyEdits([{ rowId: node.id, changes: { '__pv:c:Q1::0': 999 } }])

        expect(grid.getValue(node, grid.columns.get('__pv:c:Q1::0')!)).toBe(180)
    })

    it('hands the same reader back every time it is asked', () => {
        const { grid } = editable()

        expect(grid.readerFor('__pv:c:Q1::0', 'edit')).toBe(grid.readerFor('__pv:c:Q1::0', 'edit'))
    })
})

describe('showValuesAs reads the generated columns', () => {
    function shared(as: Record<string, ShowAs>) {
        return createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            features: [
                pivot<Sale>({ ...crossing, totalColumn: 'Total' }),
                showValuesAs({ columns: as })
            ]
        })
    }

    it('shows a crossing as a share of the row it sits in', () => {
        const grid = shared({
            '__pv:c:Q1::0': { kind: 'percentOfRow', of: ['__pv:c:Q1::0', '__pv:c:Q2::0'] }
        })
        const north = grid.preWindowNodes.find((node) => node.meta?.expandable)!

        expect(grid.getValue(north, grid.columns.get('__pv:c:Q1::0')!)).toBeCloseTo(180 / 330, 6)
    })

    it('reads a crossing as its share of what that column totals down the page', () => {
        const grid = shared({ '__pv:c:Q1::0': 'percentOfGrandTotal' })
        const groups = grid.preWindowNodes.filter((node) => node.meta?.expandable)

        expect(grid.getValue(groups[0]!, grid.columns.get('__pv:c:Q1::0')!)).toBeCloseTo(
            180 / 380,
            6
        )
        expect(grid.getValue(groups[1]!, grid.columns.get('__pv:c:Q1::0')!)).toBeCloseTo(
            200 / 380,
            6
        )
    })

    it('reads percentOfParent the same way, since a pivot row has no parent above it', () => {
        const grid = shared({ '__pv:c:Q1::0': 'percentOfParent' })
        const north = grid.preWindowNodes.find((node) => node.meta?.expandable)!

        expect(grid.getValue(north, grid.columns.get('__pv:c:Q1::0')!)).toBeCloseTo(180 / 380, 6)
    })

    it('skips nothing on a client grid, whatever the column', () => {
        const grid = shared({ '__pv:c:Q1::0': 'percentOfGrandTotal', amount: 'percentOfParent' })

        expect(getShowValuesAs(grid)!.skippedColumns).toEqual([])
    })
})

describe('sorting by what a crossing measured', () => {
    function sorted(options: Partial<PivotOptions<Sale>> = {}) {
        const grid = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            features: [sorting(), pivot<Sale>({ ...crossing, ...options })]
        })
        return grid
    }

    const labels = (grid: GridState<Sale>) =>
        grid.preWindowNodes
            .filter((node) => node.meta?.expandable)
            .map((node) => String(grid.getValue(node, grid.columns.get('region')!)))

    it('leaves a crossing unsortable unless asked', () => {
        const grid = sorted()

        expect(grid.columns.get('__pv:c:Q1::0')!.def.sortable).toBe(false)
    })

    it('orders the groups by the crossing, not the rows', () => {
        const grid = sorted({ sortableColumns: true })
        expect(labels(grid)).toEqual(['North', 'South'])

        getSorting(grid)!.setSort([{ columnId: '__pv:c:Q1::0', direction: 'asc' }])
        expect(labels(grid)).toEqual(['North', 'South'])

        getSorting(grid)!.setSort([{ columnId: '__pv:c:Q1::0', direction: 'desc' }])
        expect(labels(grid)).toEqual(['South', 'North'])
    })

    it('orders by the total column too', () => {
        const grid = sorted({ sortableColumns: true, totalColumn: 'Total' })

        getSorting(grid)!.setSort([{ columnId: '__pv:t:0', direction: 'asc' }])
        expect(labels(grid)).toEqual(['South', 'North'])
    })

    it('keeps the total row at the bottom whatever the order', () => {
        const grid = sorted({ sortableColumns: true, totalRow: 'All' })

        getSorting(grid)!.setSort([{ columnId: '__pv:c:Q1::0', direction: 'desc' }])
        const last = grid.preWindowNodes[grid.preWindowNodes.length - 1]!

        expect(grid.getValue(last, grid.columns.get('region')!)).toBe('All')
    })

    it('orders siblings within their parent, not across the whole list', () => {
        const grid = sorted({ rows: ['region', 'product'], sortableColumns: true })
        grid.expansion.expandAll(
            grid.preWindowNodes.filter((node) => node.meta?.expandable).map((node) => node.id)
        )

        const shape = () =>
            grid.preWindowNodes
                .filter((node) => node.meta?.expandable)
                .map((node) => {
                    const field = node.meta!.level === 0 ? 'region' : 'product'
                    return `${node.meta!.level}:${grid.getValue(node, grid.columns.get(field)!)}`
                })

        getSorting(grid)!.setSort([{ columnId: '__pv:c:Q1::0', direction: 'desc' }])
        expect(shape()).toEqual(['0:South', '1:Widget', '0:North', '1:Widget', '1:Gadget'])

        getSorting(grid)!.setSort([{ columnId: '__pv:c:Q1::0', direction: 'asc' }])
        expect(shape()).toEqual(['0:North', '1:Gadget', '1:Widget', '0:South', '1:Widget'])
    })

    it('leaves a sort on an ordinary column to the sort stage', () => {
        const grid = sorted({ sortableColumns: true })

        getSorting(grid)!.setSort([{ columnId: 'region', direction: 'desc' }])
        expect(labels(grid)).toEqual(['South', 'North'])
    })

    it('never offers a crossing for filtering', () => {
        const grid = sorted({ sortableColumns: true, totalColumn: 'Total' })

        expect(grid.columns.get('__pv:c:Q1::0')!.def.filter).toBe(false)
        expect(grid.columns.get('__pv:t:0')!.def.filter).toBe(false)
    })
})

describe('a crossing takes its place in the sort, it does not replace it', () => {
    const ranked: Sale[] = [
        { id: 1, region: 'A', product: 'W', quarter: 'Q1', amount: 10 },
        { id: 2, region: 'B', product: 'W', quarter: 'Q1', amount: 30 },
        { id: 3, region: 'C', product: 'W', quarter: 'Q1', amount: 20 }
    ]

    function ranks(sort: { columnId: string; direction: 'asc' | 'desc' }[]) {
        const grid = createDataGrid<Sale>({
            columns: columns.map((def) => ({ ...def, sortable: true })),
            data: ranked,
            getRowId: (row) => String(row.id),
            features: [sorting(), pivot<Sale>({ ...crossing, sortableColumns: true })]
        })
        getSorting(grid)!.setSort(sort)
        return grid.preWindowNodes.map((node) =>
            String(grid.getValue(node, grid.columns.get('region')!))
        )
    }

    it('keeps an ordinary column ahead of a crossing behind it', () => {
        expect(
            ranks([
                { columnId: 'region', direction: 'asc' },
                { columnId: '__pv:c:Q1::0', direction: 'desc' }
            ])
        ).toEqual(['A', 'B', 'C'])
    })

    it('lets the crossing decide when it comes first', () => {
        expect(
            ranks([
                { columnId: '__pv:c:Q1::0', direction: 'desc' },
                { columnId: 'region', direction: 'asc' }
            ])
        ).toEqual(['B', 'C', 'A'])
    })

    it('does not take a sort on a total column it was never asked to draw', () => {
        const grid = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            features: [sorting(), pivot<Sale>({ ...crossing, sortableColumns: true })]
        })

        expect(grid.columns.visible.some((column) => column.id === '__pv:t:0')).toBe(false)
        expect(getPivot(grid)!.ownsSort('__pv:t:0')).toBe(false)
        expect(getPivot(grid)!.ownsSort('__pv:c:Q1::0')).toBe(true)
    })
})

describe('a pivot leaves the grid by every door a value uses', () => {
    it('exports the table it drew, empty crossings and all', () => {
        const grid = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            features: [selection(), pivot<Sale>({ ...crossing, totalColumn: 'Total' })]
        })

        const matrix = rowsToMatrix(
            grid.preWindowNodes,
            pickColumns(grid.columns.visible),
            undefined,
            {
                read: (column) => grid.readerFor(column.id, 'export')
            }
        )

        expect(toCsv(matrix)).toBe('North,180,150,330\r\nSouth,200,,200')
    })
})

describe('refusing to draw is also refusing to gather', () => {
    it('leaves the rows alone when the crossing overflows', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = build({ maxColumns: 1 })

        expect(columnIds(grid).some(isPivotColumn)).toBe(false)
        expect(grid.preWindowNodes).toHaveLength(sales.length)
        expect(grid.preWindowNodes.some((node) => node.meta?.expandable)).toBe(false)
        warn.mockRestore()
    })

    it('leaves the rows alone when a field names no column', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = createDataGrid<Sale>({
            columns: [{ id: 'region' }, { id: 'amount', type: 'number' }],
            data: sales,
            getRowId: (row) => String(row.id),
            features: [pivot<Sale>(crossing)]
        })

        expect(grid.preWindowNodes).toHaveLength(sales.length)
        expect(grid.preWindowNodes.some((node) => node.meta?.expandable)).toBe(false)
        warn.mockRestore()
    })
})

describe('a saved view carries a pivot order back', () => {
    function ordered() {
        const grid = createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            features: [sorting(), pivot<Sale>({ ...crossing, sortableColumns: true })]
        })
        return grid
    }

    const order = (grid: GridState<Sale>) =>
        grid.preWindowNodes
            .filter((node) => node.meta?.expandable)
            .map((node) => String(grid.getValue(node, grid.columns.get('region')!)))

    it('restores the order a crossing put the groups in', () => {
        const grid = ordered()
        getSorting(grid)!.setSort([{ columnId: '__pv:c:Q1::0', direction: 'asc' }])
        expect(order(grid)).toEqual(['North', 'South'])

        const snapshot = grid.api.getState!()
        const fresh = ordered()
        expect(order(fresh)).toEqual(['North', 'South'])

        fresh.api.setState!(snapshot)
        expect(getSorting(fresh)!.sort).toEqual([{ columnId: '__pv:c:Q1::0', direction: 'asc' }])
        expect(order(fresh)).toEqual(['North', 'South'])
    })

    it('drops an order on a crossing the data no longer has', () => {
        const grid = ordered()
        getSorting(grid)!.setSort([{ columnId: '__pv:c:Q9::0', direction: 'desc' }])

        expect(getPivot(grid)!.ownsSort('__pv:c:Q9::0')).toBe(false)
        expect(order(grid)).toEqual(['North', 'South'])
    })
})

describe('a measure naming no column is refused the same way a field is', () => {
    it('draws no crossing at all rather than a table of empty columns', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = build({ values: [{ field: 'nowhere', agg: 'sum' }] })

        expect(columnIds(grid).some(isPivotColumn)).toBe(false)
        expect(grid.preWindowNodes).toHaveLength(sales.length)

        const said = warn.mock.calls.filter((call) => String(call[0]).includes('no column defined'))
        expect(String(said[0]?.[0])).toContain('nowhere')
        warn.mockRestore()
    })

    it('refuses when one measure of two is the one that names nothing', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = build({
            values: [
                { field: 'amount', agg: 'sum' },
                { field: 'nowhere', agg: 'count' }
            ]
        })

        expect(columnIds(grid).some(isPivotColumn)).toBe(false)
        warn.mockRestore()
    })
})
