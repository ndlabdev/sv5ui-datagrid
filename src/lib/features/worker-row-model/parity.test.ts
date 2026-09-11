import { createDataGrid, type GridState } from '../../core/grid/index.js'
import { type ColumnDef, type ColumnFilter, type SortState } from '../../core/types/index.js'
import { filtering, toFilterRequest } from '../../features/filtering/index.js'
import { sorting } from '../../features/sorting/index.js'
import { describe, expect, it } from 'vitest'
import { buildStore } from './columnar.js'
import { runQuery } from './query.js'

interface Row {
    id: number
    city: string | null
    qty: number | null
    when: string | null
    born: Date | null
    paid: boolean | null
}

const cities = ['Hanoi', 'Da Nang', 'hanoi', 'Ho Chi Minh', '']
const rows: Row[] = Array.from({ length: 60 }, (_, i) => ({
    id: i + 1,
    city: i % 11 === 0 ? null : cities[i % 5]!,
    qty: i % 7 === 0 ? null : ((i * 13) % 50) - 10,
    when:
        i % 9 === 0
            ? null
            : `2026-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 27) + 1).padStart(2, '0')}`,
    born: i % 5 === 0 ? null : new Date(2020, i % 12, (i % 27) + 1, i % 24),
    paid: i % 4 === 0 ? null : i % 3 !== 0
}))

const columns: ColumnDef<Row>[] = [
    { id: 'city', header: 'City', filter: 'text' },
    { id: 'qty', header: 'Qty', filter: 'number' },
    { id: 'when', header: 'When', type: 'date', filter: 'date' },
    { id: 'born', header: 'Born', type: 'datetime', filter: 'date' },
    { id: 'paid', header: 'Paid', type: 'boolean', filter: 'boolean' }
]

const FIELDS = ['city', 'qty', 'when', 'born', 'paid']
const DATE_COLUMNS = ['when', 'born']

function valuesOf<T>(source: T[], fields: string[]): Record<string, unknown[]> {
    const values: Record<string, unknown[]> = {}
    for (const field of fields) {
        values[field] = source.map((row) => (row as Record<string, unknown>)[field])
    }
    return values
}

const store = buildStore(valuesOf(rows, FIELDS), rows.length)

function throughPipeline(
    filter: Record<string, ColumnFilter>,
    quick: string,
    sort: SortState[]
): number[] {
    const grid: GridState<Row> = createDataGrid<Row>({
        columns,
        data: rows,
        getRowId: (row) => String(row.id),
        features: [filtering(), sorting()]
    })
    for (const [columnId, entry] of Object.entries(filter)) {
        grid.api.setColumnFilter!(columnId, entry)
    }
    if (quick) grid.api.setQuickFilter!(quick)
    for (const entry of sort) grid.api.setSort!([entry])

    return grid.preWindowNodes.map((node) => node.row.id)
}

function throughWorker(
    filter: Record<string, ColumnFilter>,
    quick: string,
    sort: SortState[]
): number[] {
    const model = { quick: '', columns: filter }
    const request = toFilterRequest(model)
    request.quick = quick
    request.quickFields = FIELDS

    const { indices } = runQuery(store, {
        filter: request,
        sort,
        dateColumns: DATE_COLUMNS
    })
    return [...indices].map((index) => rows[index]!.id)
}

const filters: [string, Record<string, ColumnFilter>][] = [
    ['nothing', {}],
    ['text contains', { city: { kind: 'text', op: 'contains', value: 'han' } }],
    [
        'text contains, cased',
        { city: { kind: 'text', op: 'contains', value: 'Han', caseSensitive: true } }
    ],
    ['text notContains', { city: { kind: 'text', op: 'notContains', value: 'han' } }],
    ['text equals', { city: { kind: 'text', op: 'equals', value: 'Da Nang' } }],
    ['text notEqual', { city: { kind: 'text', op: 'notEqual', value: 'Da Nang' } }],
    ['text startsWith', { city: { kind: 'text', op: 'startsWith', value: 'ho' } }],
    ['text blank', { city: { kind: 'text', op: 'blank', value: '' } }],
    ['text notBlank', { city: { kind: 'text', op: 'notBlank', value: '' } }],
    ['number gt', { qty: { kind: 'number', op: 'gt', value: 0 } }],
    ['number lte', { qty: { kind: 'number', op: 'lte', value: 10 } }],
    ['number neq', { qty: { kind: 'number', op: 'neq', value: 3 } }],
    ['number between', { qty: { kind: 'number', op: 'between', value: -5, to: 20 } }],
    ['number blank', { qty: { kind: 'number', op: 'blank' } }],
    ['date equals', { when: { kind: 'date', op: 'equals', value: '2026-03-03' } }],
    ['date before', { when: { kind: 'date', op: 'before', value: '2026-06-01' } }],
    [
        'date between',
        { when: { kind: 'date', op: 'between', value: '2026-01-01', to: '2026-03-31' } }
    ],
    ['datetime after', { born: { kind: 'date', op: 'after', value: '2020-06-15' } }],
    ['datetime blank', { born: { kind: 'date', op: 'blank' } }],
    ['boolean true', { paid: { kind: 'boolean', value: true } }],
    ['boolean false', { paid: { kind: 'boolean', value: false } }],
    ['set of two', { city: { kind: 'set', values: ['Hanoi', 'Da Nang'] } }],
    ['set with blank', { city: { kind: 'set', values: ['Hanoi', null] } }],
    [
        'two columns at once',
        {
            city: { kind: 'text', op: 'contains', value: 'a' },
            qty: { kind: 'number', op: 'gte', value: 0 }
        }
    ]
]

describe('the worker query answers what the client pipeline answers', () => {
    it.each(filters)('%s', (_label, filter) => {
        expect(throughWorker(filter, '', [])).toEqual(throughPipeline(filter, '', []))
    })

    const sorts: [string, SortState[]][] = [
        ['city asc', [{ columnId: 'city', direction: 'asc' }]],
        ['city desc', [{ columnId: 'city', direction: 'desc' }]],
        ['qty asc', [{ columnId: 'qty', direction: 'asc' }]],
        ['qty desc', [{ columnId: 'qty', direction: 'desc' }]],
        ['date asc', [{ columnId: 'when', direction: 'asc' }]],
        ['datetime desc', [{ columnId: 'born', direction: 'desc' }]],
        ['boolean asc', [{ columnId: 'paid', direction: 'asc' }]]
    ]

    it.each(sorts)('sorts by %s the same way', (_label, sort) => {
        expect(throughWorker({}, '', sort)).toEqual(throughPipeline({}, '', sort))
    })

    it('filters and sorts in one pass the way the pipeline does', () => {
        const filter: Record<string, ColumnFilter> = {
            qty: { kind: 'number', op: 'gte', value: 0 }
        }
        const sort: SortState[] = [{ columnId: 'city', direction: 'asc' }]
        expect(throughWorker(filter, '', sort)).toEqual(throughPipeline(filter, '', sort))
    })

    it('matches the quick filter over text columns', () => {
        expect(throughWorker({}, 'nang', [])).toEqual(throughPipeline({}, 'nang', []))
    })
})

describe('where the worker deliberately answers less', () => {
    it('does not see the text a column is drawn with, only the value behind it', () => {
        const priced: { id: number; price: number }[] = [
            { id: 1, price: 1234.5 },
            { id: 2, price: 99 }
        ]
        const grid = createDataGrid<{ id: number; price: number }>({
            columns: [{ id: 'price', type: 'currency', filter: 'number' }],
            data: priced,
            getRowId: (row) => String(row.id),
            features: [filtering()]
        })
        grid.api.setQuickFilter!('1,234')

        const priceStore = buildStore(valuesOf(priced, ['price']), priced.length)
        const request = toFilterRequest({ quick: '', columns: {} }, ['price'])
        request.quick = '1,234'

        expect(grid.preWindowNodes.map((node) => node.row.id)).toEqual([1])
        expect(runQuery(priceStore, { filter: request, sort: [] }).rowCount).toBe(0)
    })
})
