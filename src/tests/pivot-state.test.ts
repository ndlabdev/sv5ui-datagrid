import { describe, expect, it, vi } from 'vitest'
import { createDataGrid, sorting, type ColumnDef, type GridState } from '$lib/index.js'
import { getPivot, isPivotColumn, pivot, type PivotOptions } from '../lib/features/pivot/index.js'

interface Sale {
    id: number
    region: string
    quarter: string
    product: string
    amount: number
}

const sales: Sale[] = [
    { id: 1, region: 'North', quarter: 'Q1', product: 'Widget', amount: 100 },
    { id: 2, region: 'North', quarter: 'Q2', product: 'Gadget', amount: 150 },
    { id: 3, region: 'South', quarter: 'Q1', product: 'Widget', amount: 200 }
]

const columns: ColumnDef<Sale>[] = [
    { id: 'region' },
    { id: 'quarter' },
    { id: 'product' },
    { id: 'amount', type: 'number' }
]

function build(options: Partial<PivotOptions<Sale>> = {}): GridState<Sale> {
    return createDataGrid<Sale>({
        columns,
        data: sales,
        getRowId: (row) => String(row.id),
        features: [
            sorting(),
            pivot<Sale>({
                rows: ['region'],
                columns: ['quarter'],
                values: [{ field: 'amount', agg: 'sum' }],
                ...options
            })
        ]
    })
}

const leaves = (grid: GridState<Sale>) =>
    grid.columns.visible.filter((column) => isPivotColumn(column.id)).map((column) => column.id)

describe('a saved view carries the crossing back', () => {
    it('restores a crossing the user changed after the grid was built', () => {
        const grid = build()
        grid.api.setPivotColumns?.(['product'])
        expect(leaves(grid)).toEqual(['__pv:c:Gadget::0', '__pv:c:Widget::0'])

        const snapshot = grid.api.getState!()

        const fresh = build()
        expect(leaves(fresh)).toEqual(['__pv:c:Q1::0', '__pv:c:Q2::0'])

        fresh.api.setState!(snapshot)
        expect(leaves(fresh)).toEqual(['__pv:c:Gadget::0', '__pv:c:Widget::0'])
        expect(getPivot(fresh)!.columns).toEqual(['product'])
    })

    it('carries the measures, not only the two axes', () => {
        const grid = build()
        grid.api.setPivotValues?.([
            { field: 'amount', agg: 'count', header: 'How many' },
            { field: 'amount', agg: 'max', header: 'Biggest' }
        ])

        const fresh = build()
        fresh.api.setState!(grid.api.getState!())

        expect(getPivot(fresh)!.values).toEqual([
            { field: 'amount', agg: 'count', header: 'How many' },
            { field: 'amount', agg: 'max', header: 'Biggest' }
        ])
        expect(leaves(fresh)).toHaveLength(4)
    })

    it('writes nothing down while nothing is being crossed', () => {
        const grid = build()
        grid.api.clearPivot?.()

        const snapshot = grid.api.getState!() as { features?: Record<string, unknown> }

        expect(snapshot.features?.pivot).toBeUndefined()
    })

    it('leaves the grid alone when the snapshot names a column it no longer has', () => {
        const grid = build()
        grid.api.setPivotColumns?.(['product'])
        const snapshot = grid.api.getState!()

        const fresh = createDataGrid<Sale>({
            columns: columns.filter((def) => def.id !== 'product'),
            data: sales,
            getRowId: (row) => String(row.id),
            features: [
                sorting(),
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter'],
                    values: [{ field: 'amount', agg: 'sum' }]
                })
            ]
        })
        fresh.api.setState!(snapshot)

        expect(getPivot(fresh)!.columns).toEqual([])
        expect(fresh.api.isPivoting?.()).toBe(false)
        expect(fresh.preWindowNodes).toHaveLength(sales.length)
    })

    it('says so rather than writing down a reduction that cannot be read back', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        const grid = build({ values: [{ field: 'amount', agg: (values) => values.length }] })

        const snapshot = grid.api.getState!() as {
            features?: { pivot?: Record<string, unknown> }
        }

        expect(snapshot.features?.pivot?.columns).toEqual(['quarter'])
        expect(snapshot.features?.pivot?.values).toBeUndefined()
        expect(
            warn.mock.calls.filter((call) => String(call[0]).includes('only the named ones'))
        ).toHaveLength(1)
        warn.mockRestore()
    })
})

describe('the column menu offers the two axes', () => {
    const itemsFor = (grid: GridState<Sale>, columnId: string) =>
        grid.features
            .flatMap((feature) => feature.menuItems?.({ grid, columnId }) ?? [])
            .map((item) => item.id)

    it('offers a field that is not in the pivot both ways', () => {
        expect(itemsFor(build(), 'product')).toEqual(['pivot-rows', 'pivot-columns'])
    })

    it('offers to take out a field that is already on an axis', () => {
        expect(itemsFor(build(), 'region')).toEqual(['pivot-remove'])
        expect(itemsFor(build(), 'quarter')).toEqual(['pivot-remove'])
    })

    it('offers nothing on a column the pivot generated', () => {
        const grid = build()
        expect(itemsFor(grid, leaves(grid)[0]!)).toEqual([])
    })

    it('moves a row field across to the column axis rather than onto both', () => {
        const state = getPivot(build())!
        state.addColumnField('region')

        expect(state.rows).toEqual([])
        expect(state.columns).toEqual(['quarter', 'region'])
    })

    it('moves a column field down to the row axis rather than onto both', () => {
        const state = getPivot(build())!
        state.addRowField('quarter')

        expect(state.columns).toEqual([])
        expect(state.rows).toEqual(['region', 'quarter'])
    })

    it('takes a field off whichever axis it sat on', () => {
        const state = getPivot(build())!
        state.removeField('quarter')

        expect(state.rows).toEqual(['region'])
        expect(state.columns).toEqual([])
    })
})

describe('a saved view carries every setting a reader can change', () => {
    function rich() {
        return createDataGrid<Sale>({
            columns,
            data: sales,
            getRowId: (row) => String(row.id),
            features: [
                sorting(),
                pivot<Sale>({
                    rows: ['region'],
                    columns: ['quarter', 'product'],
                    values: [{ field: 'amount', agg: 'sum' }],
                    columnSubtotal: (header) => `${header} total`
                })
            ]
        })
    }

    const settings = (grid: GridState<Sale>) => {
        const state = getPivot(grid)!
        return {
            groups: state.columnGroups,
            sortable: state.sortableColumns,
            totalColumn: state.totalColumn,
            totalRow: state.totalRow,
            subtotal: state.columnSubtotal !== undefined,
            showAs: state.values[0]!.showAs
        }
    }

    it('brings the share, the folding, the totals and the sorting back', () => {
        const source = rich()
        const state = getPivot(source)!
        state.setValueShowAs(0, 'percentOfRow')
        state.setColumnGroups('closed')
        state.setSortableColumns(true)
        state.setTotalColumn('Total')
        state.setTotalRow('All')

        const snapshot = source.api.getState!()

        const fresh = rich()
        expect(settings(fresh)).toEqual({
            groups: 'fixed',
            sortable: false,
            totalColumn: undefined,
            totalRow: undefined,
            subtotal: true,
            showAs: undefined
        })

        fresh.api.setState!(snapshot)
        expect(settings(fresh)).toEqual({
            groups: 'closed',
            sortable: true,
            totalColumn: 'Total',
            totalRow: 'All',
            subtotal: true,
            showAs: 'percentOfRow'
        })
    })

    it('takes a total back off when the view was saved without one', () => {
        const source = rich()
        const snapshot = source.api.getState!()

        const fresh = rich()
        getPivot(fresh)!.setTotalColumn('Total')
        getPivot(fresh)!.setTotalRow('All')

        fresh.api.setState!(snapshot)
        expect(settings(fresh).totalColumn).toBeUndefined()
        expect(settings(fresh).totalRow).toBeUndefined()
    })

    it('brings a subtotal back onto a grid that never declared one', () => {
        const source = build({ columns: ['quarter', 'product'] })
        const subtotals = (grid: GridState<Sale>) =>
            leaves(grid).filter((id) => id.includes('::s')).length

        expect(subtotals(source)).toBe(0)
        getPivot(source)!.setColumnSubtotal((header) => `${header} total`)
        expect(subtotals(source)).toBeGreaterThan(0)

        const snapshot = source.api.getState!()
        const fresh = build({ columns: ['quarter', 'product'] })
        expect(subtotals(fresh)).toBe(0)

        fresh.api.setState!(snapshot)
        expect(subtotals(fresh)).toBe(subtotals(source))

        const headerOf = (grid: GridState<Sale>) =>
            grid.columns.visible
                .filter((column) => column.id.includes('::s'))
                .map((column) => String(column.def.header))

        expect(headerOf(fresh)).toEqual(['Q1 total', 'Q2 total'])
    })

    it('takes the subtotal off again when the view was saved without one', () => {
        const source = build({ columns: ['quarter', 'product'] })
        const snapshot = source.api.getState!()

        const fresh = build({
            columns: ['quarter', 'product'],
            columnSubtotal: (header) => `${header} total`
        })
        expect(leaves(fresh).filter((id) => id.includes('::s')).length).toBeGreaterThan(0)

        fresh.api.setState!(snapshot)
        expect(leaves(fresh).filter((id) => id.includes('::s'))).toEqual([])
    })

    it('leaves the subtotal as declared when an older view never mentioned it', () => {
        const fresh = build({
            columns: ['quarter', 'product'],
            columnSubtotal: (header) => `${header} total`
        })

        fresh.api.setState!({
            version: 1,
            features: {
                pivot: {
                    rows: ['region'],
                    columns: ['quarter', 'product'],
                    values: [{ field: 'amount', agg: 'sum' }]
                }
            }
        } as never)

        expect(getPivot(fresh)!.columnSubtotal).toBeDefined()
    })

    it('refuses a share or a folding mode the snapshot made up', () => {
        const fresh = rich()
        getPivot(fresh)!.setColumnGroups('open')

        fresh.api.setState!({
            version: 1,
            features: {
                pivot: {
                    rows: ['region'],
                    columns: ['quarter'],
                    columnGroups: 'sideways',
                    values: [{ field: 'amount', agg: 'sum', showAs: 'percentOfMoon' }]
                }
            }
        } as never)

        expect(settings(fresh).groups).toBe('open')
        expect(settings(fresh).showAs).toBeUndefined()
    })
})

describe('the readings along a row travel with the view too', () => {
    it.each(['runningTotal', 'differenceFrom', 'percentDifferenceFrom', 'rankInRow'] as const)(
        'carries %s back',
        (showAs) => {
            const source = build()
            getPivot(source)!.setValueShowAs(0, showAs)

            const fresh = build()
            fresh.api.setState!(source.api.getState!())

            expect(getPivot(fresh)!.values[0]!.showAs).toBe(showAs)
        }
    )
})

describe('the api reads back what it was told to set', () => {
    it('reports which fields run down and which run across', () => {
        const grid = build()

        expect(grid.api.pivotRows!()).toEqual(['region'])
        expect(grid.api.pivotColumns!()).toEqual(['quarter'])

        grid.api.setPivotRows!(['product'])
        grid.api.setPivotColumns!(['quarter', 'region'])

        expect(grid.api.pivotRows!()).toEqual(['product'])
        expect(grid.api.pivotColumns!()).toEqual(['quarter', 'region'])
    })

    it('hands back a copy, so a caller cannot reach in and reorder an axis', () => {
        const grid = build()

        const read = grid.api.pivotColumns!()
        read.push('product')

        expect(grid.api.pivotColumns!()).toEqual(['quarter'])
    })

    it('reports the measures, so a toolbar need not keep its own mirror', () => {
        const grid = build()
        expect(grid.api.pivotValues!()).toEqual([{ field: 'amount', agg: 'sum' }])

        grid.api.setPivotValues!([{ field: 'amount', agg: 'avg', header: 'Mean' }])
        expect(grid.api.pivotValues!()).toEqual([{ field: 'amount', agg: 'avg', header: 'Mean' }])
    })

    it('says nothing is crossing once both axes are cleared', () => {
        const grid = build()
        expect(grid.api.isPivoting!()).toBe(true)

        grid.api.clearPivot!()
        expect(grid.api.pivotRows!()).toEqual([])
        expect(grid.api.pivotColumns!()).toEqual([])
        expect(grid.api.isPivoting!()).toBe(false)
    })
})

describe('the ceiling on generated columns moves at run time', () => {
    const warn = () => vi.spyOn(console, 'warn').mockImplementation(() => {})

    it('starts at the declared ceiling and reports it', () => {
        const grid = build({ maxColumns: 3 })
        expect(grid.api.pivotMaxColumns!()).toBe(3)
    })

    it('consults the raised ceiling, so the table it had refused comes out', () => {
        const spy = warn()
        const grid = build({ columns: ['quarter', 'product'], maxColumns: 1 })

        expect(leaves(grid)).toEqual([])
        expect(spy).toHaveBeenCalled()

        grid.api.setPivotMaxColumns!(50)

        expect(grid.api.pivotMaxColumns!()).toBe(50)
        expect(leaves(grid).length).toBeGreaterThan(1)
        spy.mockRestore()
    })

    it('refuses again when the ceiling is lowered back under the table', () => {
        const spy = warn()
        const grid = build({ columns: ['quarter', 'product'] })
        expect(leaves(grid).length).toBeGreaterThan(1)

        grid.api.setPivotMaxColumns!(1)
        expect(leaves(grid)).toEqual([])
        spy.mockRestore()
    })

    it('keeps the ceiling out of a saved view, since no reader can change it', () => {
        const grid = build({ maxColumns: 7 })
        const snapshot = JSON.stringify(grid.api.getState!())

        expect(snapshot).not.toContain('maxColumns')
    })
})
