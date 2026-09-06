import { createDataGrid } from '../grid/grid.svelte.js'
import { sorting } from '../../features/sorting/index.js'
import type { ColumnDef } from '../types/index.js'
import { describe, expect, it } from 'vitest'
import { autoColumns, headerOf } from './auto-columns.js'
import { markSyntheticRow } from '../grid/row-node.js'

interface Order {
    id: number
    customer: string
    region: string
    total: number
    paid: boolean
    placedAt: string
    note: string | null
}

const orders: Order[] = [
    {
        id: 1,
        customer: 'Alice',
        region: 'North',
        total: 120,
        paid: true,
        placedAt: '2026-01-05',
        note: null
    },
    {
        id: 2,
        customer: 'Bob',
        region: 'South',
        total: 340,
        paid: false,
        placedAt: '2026-02-11',
        note: 'rush'
    },
    {
        id: 3,
        customer: 'Chi',
        region: 'North',
        total: 90,
        paid: true,
        placedAt: '2026-03-02',
        note: null
    },
    {
        id: 4,
        customer: 'Dan',
        region: 'East',
        total: 700,
        paid: false,
        placedAt: '2026-04-19',
        note: null
    },
    {
        id: 5,
        customer: 'Eve',
        region: 'North',
        total: 210,
        paid: true,
        placedAt: '2026-05-01',
        note: null
    },
    {
        id: 6,
        customer: 'Finn',
        region: 'South',
        total: 55,
        paid: false,
        placedAt: '2026-06-14',
        note: null
    },
    {
        id: 7,
        customer: 'Gia',
        region: 'East',
        total: 480,
        paid: true,
        placedAt: '2026-07-08',
        note: null
    },
    {
        id: 8,
        customer: 'Huy',
        region: 'North',
        total: 130,
        paid: false,
        placedAt: '2026-08-23',
        note: null
    }
]

const byId = (columns: ColumnDef<Order>[]) =>
    Object.fromEntries(columns.map((column) => [column.id, column]))

describe('headerOf', () => {
    it('turns a key into something a person would write', () => {
        expect(headerOf('placedAt')).toBe('Placed At')
        expect(headerOf('order_total')).toBe('Order Total')
        expect(headerOf('customer-name')).toBe('Customer Name')
        expect(headerOf('id')).toBe('Id')
        expect(headerOf('totalUSD2024')).toBe('Total USD2024')
    })
})

describe('autoColumns', () => {
    it('reads a number column as a number, aligned right and filtered as one', () => {
        const columns = byId(autoColumns(orders))
        expect(columns.total).toMatchObject({
            id: 'total',
            header: 'Total',
            type: 'number',
            filter: 'number',
            align: 'right',
            sortable: true
        })
    })

    it('reads booleans, dates and free text', () => {
        const columns = byId(autoColumns(orders))
        expect(columns.paid).toMatchObject({ type: 'boolean', filter: 'boolean' })
        expect(columns.placedAt).toMatchObject({ type: 'date', filter: 'date' })
        expect(columns.customer).toMatchObject({ type: 'text', filter: 'text' })
    })

    it('offers a set filter where a column repeats itself', () => {
        const columns = byId(autoColumns(orders))
        expect(columns.region).toMatchObject({ type: 'badge', filter: 'set' })
    })

    it('reads a Date object as a datetime, and an ISO stamp too', () => {
        const rows = [
            { at: new Date('2026-01-01T10:00:00Z'), stamp: '2026-01-01T10:00:00Z' },
            { at: new Date('2026-01-02T11:00:00Z'), stamp: '2026-01-02T11:00:00Z' }
        ]
        const columns = byId(autoColumns(rows) as unknown as ColumnDef<Order>[])
        expect(columns.at).toMatchObject({ type: 'datetime', filter: 'date' })
        expect(columns.stamp).toMatchObject({ type: 'datetime', filter: 'date' })
    })

    it('keeps a column whose sample is all blank, as text', () => {
        const columns = byId(autoColumns(orders))
        expect(columns.note).toMatchObject({ type: 'text', filter: 'text' })
    })

    it('drops a key holding something a cell cannot render', () => {
        const rows = [
            { id: 1, tags: ['a'] },
            { id: 2, tags: ['b'] }
        ]
        expect(autoColumns(rows).map((column) => column.id)).toEqual(['id'])
    })

    it('finds keys that only later rows have', () => {
        const rows = [{ id: 1 }, { id: 2, extra: 'x' }]
        expect(autoColumns(rows).map((column) => column.id)).toEqual(['id', 'extra'])
    })

    it('never offers a column for this package own row markers', () => {
        const rows = [markSyntheticRow({ id: 1 }), markSyntheticRow({ id: 2 })]
        expect(autoColumns(rows).map((column) => column.id)).toEqual(['id'])
    })

    it('takes exclude, order, header and per-column overrides', () => {
        const columns = autoColumns(orders, {
            exclude: ['note', 'paid'],
            order: ['total', 'customer'],
            header: (key) => key.toUpperCase(),
            overrides: { total: { width: 200, editable: true } }
        })

        expect(columns.map((column) => column.id)).toEqual([
            'total',
            'customer',
            'id',
            'region',
            'placedAt'
        ])
        expect(columns[0]).toMatchObject({ header: 'TOTAL', width: 200, editable: true })
    })

    it('reads only as far as the sample says', () => {
        const rows = [{ value: 1 }, { value: 2 }, { value: 'text' }]
        expect(
            byId(autoColumns(rows, { sample: 2 }) as unknown as ColumnDef<Order>[]).value
        ).toMatchObject({
            type: 'number'
        })
        expect(byId(autoColumns(rows) as unknown as ColumnDef<Order>[]).value).toMatchObject({
            type: 'text'
        })
    })

    it('builds a grid that actually runs', () => {
        const grid = createDataGrid<Order>({
            columns: autoColumns(orders),
            data: orders,
            getRowId: (row) => String(row.id),
            features: [sorting()]
        })

        expect(grid.columns.visible.map((column) => column.id)).toEqual([
            'id',
            'customer',
            'region',
            'total',
            'paid',
            'placedAt',
            'note'
        ])
        expect(grid.nodes).toHaveLength(8)
    })

    it('lets an override rescue a key the guess would have dropped', () => {
        const rows = [
            { id: 1, tags: ['a', 'b'] },
            { id: 2, tags: ['c'] }
        ]
        const columns = autoColumns(rows, { overrides: { tags: { type: 'text' } } })

        expect(columns.map((column) => column.id)).toEqual(['id', 'tags'])
        expect(columns[1]).toMatchObject({ id: 'tags', header: 'Tags', type: 'text' })
    })

    it('reads a column that mixes plain days and full stamps as a datetime', () => {
        const rows = [{ at: '2026-01-01' }, { at: '2026-01-02T03:04:05Z' }, { at: '2026-01-03' }]
        expect(autoColumns(rows)[0]).toMatchObject({ type: 'datetime', filter: 'date' })
    })

    it('keeps a numeric column numeric when one value is not finite', () => {
        const rows = [{ ratio: 1 }, { ratio: Number.NaN }, { ratio: 3 }]
        expect(autoColumns(rows)[0]).toMatchObject({ type: 'number', align: 'right' })
    })

    it('names a column once, however often order repeats it', () => {
        const rows = [{ a: 1, b: 2 }]
        expect(autoColumns(rows, { order: ['b', 'b', 'a'] }).map((column) => column.id)).toEqual([
            'b',
            'a'
        ])
    })

    it('still reads a row when the sample asked for none', () => {
        const rows = [{ total: 1 }, { total: 2 }]
        expect(autoColumns(rows, { sample: 0 })).toHaveLength(1)
        expect(autoColumns(rows, { sample: -5 })).toHaveLength(1)
    })

    it('returns nothing for nothing', () => {
        expect(autoColumns([])).toEqual([])
    })
})
