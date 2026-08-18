import { describe, expect, it } from 'vitest'
import type {
    ColumnDef,
    ColumnFilter,
    ColumnFilterEntry,
    DateFilterOp,
    FilterRequest,
    NumberFilterOp,
    SortRequestEntry,
    TextFilterOp
} from '$lib/index.js'
import {
    createDataGrid,
    filtering,
    getFiltering,
    getSorting,
    sorting,
    toFilterRequest,
    toSortRequest
} from '$lib/index.js'
import { DATE_OPS, NUMBER_OPS, TEXT_OPS } from '../lib/core/interaction/index.js'

/**
 * Every operator the grid offers, put through a backend that holds only the
 * request. The lists come from the library rather than from here, so an
 * operator added without a wire meaning fails this rather than shipping with
 * one nobody decided.
 *
 * The rows are chosen to be awkward: holes of all three kinds, text differing
 * only by case, a number that is also a string, dates on both sides of a local
 * midnight.
 */
interface Row {
    id: string
    name: string | null
    score: unknown
    when: unknown
}

const rows: Row[] = [
    { id: '1', name: 'Item 2', score: 20, when: new Date(2024, 0, 10) },
    { id: '2', name: 'item 3', score: '5', when: '2024-01-10' },
    { id: '3', name: null, score: null, when: null },
    { id: '4', name: '', score: 0, when: new Date(2024, 0, 10, 23, 30) },
    { id: '5', name: 'Other', score: 100, when: '2024-06-01T00:30:00Z' },
    { id: '6', name: 'ITEM 2', score: -5, when: new Date(2023, 11, 31) }
]

const columns: ColumnDef<Row>[] = [
    { id: 'name', sortable: true, filter: 'text' },
    { id: 'score', type: 'number', sortable: true, filter: 'number' },
    { id: 'when', type: 'date', sortable: true, filter: 'date' }
]

const isBlank = (value: unknown) => value === null || value === undefined || value === ''
const collator = new Intl.Collator(undefined, { numeric: true })

/** A calendar day, which is what a date condition means. See the README. */
function day(value: unknown): number {
    if (isBlank(value)) return Number.NaN
    const date = value instanceof Date ? value : new Date(value as string | number)
    if (Number.isNaN(date.getTime())) return Number.NaN
    // A plain date names the day it spells, wherever it is read.
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
        return Date.parse(value.trim()) / 86_400_000
    }
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86_400_000
}

type Condition = FilterRequest['columns'][string]['conditions'][number]

function textHolds(value: unknown, condition: Extract<Condition, { kind: 'text' }>): boolean {
    if (condition.op === 'blank') return isBlank(value)
    if (condition.op === 'notBlank') return !isBlank(value)

    const fold = (text: string) => (condition.caseSensitive ? text : text.toLowerCase())
    const query = fold(condition.value.trim())
    if (isBlank(value)) return condition.op === 'notContains' || condition.op === 'notEqual'

    const text = fold(String(value))
    switch (condition.op) {
        case 'contains':
            return text.includes(query)
        case 'notContains':
            return !text.includes(query)
        case 'equals':
            return text === query
        case 'notEqual':
            return text !== query
        case 'startsWith':
            return text.startsWith(query)
        default:
            return text.endsWith(query)
    }
}

const comparisons: Record<string, (value: number, target: number) => boolean> = {
    eq: (value, target) => value === target,
    neq: (value, target) => value !== target,
    gt: (value, target) => value > target,
    gte: (value, target) => value >= target,
    lt: (value, target) => value < target,
    lte: (value, target) => value <= target
}

function numberHolds(value: unknown, condition: Extract<Condition, { kind: 'number' }>): boolean {
    if (condition.op === 'blank') return isBlank(value)
    if (condition.op === 'notBlank') return !isBlank(value)
    if (isBlank(value)) return false

    const numeric = Number(value)
    const target = condition.value ?? Number.NaN
    if (condition.op === 'between') {
        return numeric >= target && numeric <= (condition.to ?? Number.NaN)
    }
    return comparisons[condition.op](numeric, target)
}

function dateHolds(value: unknown, condition: Extract<Condition, { kind: 'date' }>): boolean {
    if (condition.op === 'blank') return isBlank(value)
    if (condition.op === 'notBlank') return !isBlank(value)

    const cell = day(value)
    const target = day(condition.value)
    switch (condition.op) {
        case 'equals':
            return cell === target
        case 'before':
            return cell < target
        case 'after':
            return cell > target
        default:
            return cell >= target && cell <= day(condition.to)
    }
}

function conditionHolds(value: unknown, condition: Condition): boolean {
    switch (condition.kind) {
        case 'text':
            return textHolds(value, condition)
        case 'number':
            return numberHolds(value, condition)
        case 'date':
            return dateHolds(value, condition)
        case 'set':
            return condition.values.includes(isBlank(value) ? null : (value as never))
        default:
            return Boolean(value) === condition.value
    }
}

function compareOn(left: Row, right: Row, entry: SortRequestEntry): number {
    const a = left[entry.field as keyof Row]
    const b = right[entry.field as keyof Row]
    if (isBlank(a) && isBlank(b)) return 0
    const holes = entry.nulls === 'last' ? 1 : -1
    if (isBlank(a)) return holes
    if (isBlank(b)) return -holes

    const factor = entry.direction === 'asc' ? 1 : -1
    // A date column is ordered as dates, whatever form each row carries.
    const dates = entry.field === 'when'
    const result = dates
        ? day(a) - day(b)
        : typeof a === 'number' && typeof b === 'number'
          ? a - b
          : collator.compare(String(a), String(b))
    return result * factor
}

/** A backend, holding only the request. */
function applyRequest(filter: FilterRequest, sort: SortRequestEntry[]): string[] {
    let result = rows.filter((row) =>
        Object.entries(filter.columns).every(([columnId, entry]) => {
            const value = row[columnId as keyof Row]
            const holds = entry.conditions.map((condition) => conditionHolds(value, condition))
            return entry.join === 'or' ? holds.some(Boolean) : holds.every(Boolean)
        })
    )

    const needle = filter.quick.trim().toLowerCase()
    if (needle) {
        result = result.filter((row) =>
            filter.quickFields.some((field) => {
                const value = row[field as keyof Row]
                return !isBlank(value) && String(value).toLowerCase().includes(needle)
            })
        )
    }

    return result
        .map((row, index) => ({ row, index }))
        .sort((a, b) => {
            for (const entry of sort) {
                const result = compareOn(a.row, b.row, entry)
                if (result !== 0) return result
            }
            return a.index - b.index
        })
        .map(({ row }) => row.id)
}

function answersFor(filter?: ColumnFilterEntry, columnId = 'name', sortBy?: string) {
    const grid = createDataGrid<Row>({
        columns,
        data: rows,
        getRowId: (row) => row.id,
        features: [filtering(), sorting()]
    })
    if (filter) getFiltering(grid)!.setColumnFilter(columnId, filter)
    if (sortBy) getSorting(grid)!.setSort([{ columnId: sortBy, direction: 'asc' }])

    const sortState = getSorting(grid)!
    return {
        client: grid.nodes.map((node) => node.id),
        server: applyRequest(
            toFilterRequest(
                getFiltering(grid)!.model,
                grid.columns.visible.map((column) => column.id)
            ),
            toSortRequest(sortState.sort, grid.columns.defs, sortState.nulls)
        )
    }
}

describe('every text operator means the same on both sides', () => {
    /**
     * A query per operator that actually matches something. `equals 'item'`
     * matches nothing here, and two sides agreeing on an empty answer says
     * nothing about either of them.
     */
    const queries: Record<TextFilterOp, string> = {
        contains: 'item',
        notContains: 'item',
        equals: 'item 2',
        notEqual: 'item 2',
        startsWith: 'item',
        endsWith: ' 2',
        blank: '',
        notBlank: ''
    }

    it.each(TEXT_OPS)('%s', (op) => {
        const { client, server } = answersFor({ kind: 'text', op, value: queries[op] })
        expect(server).toEqual(client)
        expect(client.length).toBeGreaterThan(0)
    })

    it('and the case-sensitive reading of each', () => {
        for (const op of TEXT_OPS) {
            const { client, server } = answersFor({
                kind: 'text',
                op,
                value: 'Item',
                caseSensitive: true
            })
            expect(server, op).toEqual(client)
        }
    })
})

describe('every number operator means the same on both sides', () => {
    it.each(NUMBER_OPS)('%s', (op) => {
        const filter: ColumnFilter =
            op === 'between'
                ? { kind: 'number', op, value: 0, to: 50 }
                : { kind: 'number', op: op as NumberFilterOp, value: 5 }
        const { client, server } = answersFor(filter, 'score')
        expect(server).toEqual(client)
    })
})

describe('every date operator means the same on both sides', () => {
    it.each(DATE_OPS)('%s', (op) => {
        const filter: ColumnFilter =
            op === 'between'
                ? { kind: 'date', op, value: '2024-01-01', to: '2024-01-31' }
                : { kind: 'date', op: op as DateFilterOp, value: '2024-01-10' }
        const { client, server } = answersFor(filter, 'when')
        expect(server).toEqual(client)
    })

    it('reads a Date object, a plain date and a timestamp as one day', () => {
        const { client, server } = answersFor(
            { kind: 'date', op: 'equals', value: '2024-01-10' },
            'when'
        )
        // Rows 1, 2 and 4 are that day in three different forms.
        expect(client).toEqual(['1', '2', '4'])
        expect(server).toEqual(client)
    })
})

describe('the joins and the sets mean the same on both sides', () => {
    it('ands two conditions', () => {
        const { client, server } = answersFor(
            {
                kind: 'group',
                join: 'and',
                conditions: [
                    { kind: 'number', op: 'gte', value: 0 },
                    { kind: 'number', op: 'lt', value: 50 }
                ]
            },
            'score'
        )
        expect(server).toEqual(client)
        expect(client.length).toBeGreaterThan(0)
    })

    it('ors a positive and a negated condition', () => {
        const { client, server } = answersFor({
            kind: 'group',
            join: 'or',
            conditions: [
                { kind: 'text', op: 'startsWith', value: 'item' },
                { kind: 'text', op: 'blank', value: '' }
            ]
        })
        expect(server).toEqual(client)
    })

    it('matches a set including the hole every blank collapses into', () => {
        const { client, server } = answersFor({ kind: 'set', values: ['Item 2', null] })
        expect(server).toEqual(client)
        expect(client).toContain('3')
        expect(client).toContain('4')
    })
})

describe('sorting means the same on both sides', () => {
    it.each(['name', 'score', 'when'])('orders by %s', (field) => {
        const { client, server } = answersFor(undefined, 'name', field)
        expect(server).toEqual(client)
    })

    it('orders by two columns in the priority they were given', () => {
        const grid = createDataGrid<Row>({
            columns,
            data: rows,
            getRowId: (row) => row.id,
            features: [filtering(), sorting()]
        })
        const sortState = getSorting(grid)!
        sortState.setSort([
            { columnId: 'when', direction: 'asc' },
            { columnId: 'score', direction: 'desc' }
        ])
        const server = applyRequest(
            toFilterRequest(getFiltering(grid)!.model, ['name', 'score', 'when']),
            toSortRequest(sortState.sort, grid.columns.defs, sortState.nulls)
        )
        expect(server).toEqual(grid.nodes.map((node) => node.id))
    })

    it('sends the field a column sorts by, not the one it shows', () => {
        const withField: ColumnDef<Row>[] = [{ id: 'name', sortable: true, sortField: 'surname' }]
        const grid = createDataGrid<Row>({
            columns: withField,
            data: rows,
            getRowId: (row) => row.id,
            features: [sorting()]
        })
        getSorting(grid)!.setSort([{ columnId: 'name', direction: 'asc' }])
        expect(toSortRequest(getSorting(grid)!.sort, grid.columns.defs)).toEqual([
            { field: 'surname', direction: 'asc', nulls: 'first' }
        ])
    })
})

describe('a percent column travels as what the row holds', () => {
    it('sends the ratio, and says so in the README', () => {
        const percentColumns: ColumnDef<Row>[] = [
            { id: 'score', type: 'percent', filter: 'number' }
        ]
        const grid = createDataGrid<Row>({
            columns: percentColumns,
            data: rows,
            getRowId: (row) => row.id,
            features: [filtering()]
        })
        // What the panel writes when the user types 5 into a percent column.
        getFiltering(grid)!.setColumnFilter('score', { kind: 'number', op: 'eq', value: 0.05 })
        const request = toFilterRequest(getFiltering(grid)!.model, ['score'])
        expect(request.columns.score.conditions[0]).toEqual({
            kind: 'number',
            op: 'eq',
            value: 0.05
        })
    })
})
