import { describe, expect, it } from 'vitest'
import { createDataGrid, type ColumnDef, type GridState } from '$lib/index.js'
import { isPivotColumn, pivot, type PivotOptions } from '../lib/features/pivot/index.js'

interface Row {
    id: number
    year: number
    month: string
    when: Date
    size: string
    region: string
    amount: number
}

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Nov', 'Dec']
const sizes = ['Small', 'Medium', 'Large']

const rows: Row[] = Array.from({ length: 30 }, (_, index) => ({
    id: index + 1,
    year: [2019, 2020, 2021, 2100, 9][index % 5]!,
    month: months[index % 6]!,
    when: new Date(Date.UTC(2026, index % 3, 15)),
    size: sizes[index % 3]!,
    region: index % 2 === 0 ? 'North' : 'South',
    amount: 100 + index
}))

const columns: ColumnDef<Row>[] = [
    { id: 'region' },
    { id: 'year', type: 'number' },
    { id: 'month' },
    { id: 'when', type: 'date' },
    { id: 'size' },
    { id: 'amount', type: 'currency' }
]

function headersOf(options: Partial<PivotOptions<Row>>): string[] {
    const grid: GridState<Row> = createDataGrid<Row>({
        columns,
        data: rows,
        getRowId: (row) => String(row.id),
        features: [
            pivot<Row>({
                rows: ['region'],
                columns: ['year'],
                values: [{ field: 'amount', agg: 'sum' }],
                ...options
            })
        ]
    })
    return grid.columns.visible
        .filter((column) => isPivotColumn(column.id))
        .map((column) => String(column.def.header))
}

describe('the column axis keeps the order its values have', () => {
    it('counts a number axis as numbers, not as text', () => {
        expect(headersOf({})).toEqual(['9', '2,019', '2,020', '2,021', '2,100'])
    })

    it('puts a date axis in date order and draws it as a date', () => {
        const headers = headersOf({ columns: ['when'] })

        expect(headers).toEqual(['Jan 15, 2026', 'Feb 15, 2026', 'Mar 15, 2026'])
        expect(headers).not.toEqual([...headers].sort())
    })

    it('still reads a text axis with a collator, so 9 sorts before 10', () => {
        expect(headersOf({ columns: ['month'] })).toEqual([
            'Apr',
            'Dec',
            'Feb',
            'Jan',
            'Mar',
            'Nov'
        ])
    })

    it('lets the application name the keys without losing the order', () => {
        const spoken: Record<string, string> = { Small: 'S', Medium: 'M', Large: 'L' }

        expect(
            headersOf({
                columns: ['size'],
                columnHeader: (key) => spoken[key] ?? key
            })
        ).toEqual(['L', 'M', 'S'])
    })

    it('hands the raw value to columnHeader beside the label', () => {
        const seen: unknown[] = []
        headersOf({
            columnHeader: (key, depth, value) => {
                seen.push(value)
                return key
            }
        })

        expect(seen).toContain(9)
        expect(seen).toContain(2100)
        expect(seen.every((value) => typeof value === 'number')).toBe(true)
    })
})

describe('a generated column keeps the look of what it measured', () => {
    function leafDefs(options: Partial<PivotOptions<Row>>) {
        const grid: GridState<Row> = createDataGrid<Row>({
            columns: columns.map((def) =>
                def.id === 'amount' ? { ...def, width: 180, minWidth: 90 } : def
            ),
            data: rows,
            getRowId: (row) => String(row.id),
            features: [
                pivot<Row>({
                    rows: ['region'],
                    columns: ['year'],
                    values: [{ field: 'amount', agg: 'sum' }],
                    ...options
                })
            ]
        })
        return grid.columns.visible.filter((column) => isPivotColumn(column.id)).map((c) => c.def)
    }

    it('takes the type of the column it measured, so money reads as money', () => {
        const [first] = leafDefs({})

        expect(first!.type).toBe('currency')
        expect(first!.width).toBe(180)
        expect(first!.minWidth).toBe(90)
    })

    it('refuses that type for a count, which is not money however it was reached', () => {
        const [sum, count] = leafDefs({
            values: [
                { field: 'amount', agg: 'sum', header: 'Sum' },
                { field: 'amount', agg: 'count', header: 'Count' }
            ]
        })

        expect(sum!.type).toBe('currency')
        expect(count!.type).toBeUndefined()
        expect(count!.width).toBe(180)
    })

    it('leaves a total column looking like the crossings beside it', () => {
        const defs = leafDefs({ totalColumn: 'Total' })

        expect(defs[defs.length - 1]!.type).toBe('currency')
    })

    it('says nothing about type when the reduction is a function nobody can read', () => {
        const [first] = leafDefs({
            values: [{ field: 'amount', agg: (values) => values.length }]
        })

        expect(first!.type).toBeUndefined()
    })
})

describe('the application can declare the axis itself', () => {
    const sizes: ColumnDef<Row>[] = columns

    function headersFor(options: Partial<PivotOptions<Row>>): string[] {
        const grid: GridState<Row> = createDataGrid<Row>({
            columns: sizes,
            data: rows,
            getRowId: (row) => String(row.id),
            features: [
                pivot<Row>({
                    rows: ['region'],
                    columns: ['size'],
                    values: [{ field: 'amount', agg: 'sum' }],
                    ...options
                })
            ]
        })
        return grid.columns.visible
            .filter((column) => isPivotColumn(column.id))
            .map((column) => String(column.def.header))
    }

    it('takes the order it was given over the one the values have', () => {
        expect(headersFor({})).toEqual(['Large', 'Medium', 'Small'])
        expect(headersFor({ columnKeys: () => ['Small', 'Medium', 'Large'] })).toEqual([
            'Small',
            'Medium',
            'Large'
        ])
    })

    it('draws a key the data never had, so a gap is visible rather than missing', () => {
        const headers = headersFor({
            columnKeys: () => ['Small', 'Medium', 'Large', 'Enormous']
        })

        expect(headers).toEqual(['Small', 'Medium', 'Large', 'Enormous'])
    })

    it('leaves that column empty rather than inventing a number for it', () => {
        const grid: GridState<Row> = createDataGrid<Row>({
            columns: sizes,
            data: rows,
            getRowId: (row) => String(row.id),
            features: [
                pivot<Row>({
                    rows: ['region'],
                    columns: ['size'],
                    values: [{ field: 'amount', agg: 'sum' }],
                    columnKeys: () => ['Small', 'Enormous']
                })
            ]
        })
        const node = grid.preWindowNodes.find((row) => row.meta?.expandable)!

        expect(grid.getValue(node, grid.columns.get('__pv:c:Small::0')!)).toBeGreaterThan(0)
        expect(grid.getValue(node, grid.columns.get('__pv:c:Enormous::0')!)).toBeUndefined()
    })

    it('drops a key the data has but the list leaves out', () => {
        expect(headersFor({ columnKeys: () => ['Small'] })).toEqual(['Small'])
    })

    it('names the field it is asking about, so one function can serve several', () => {
        const asked: [string, number][] = []
        headersFor({
            columnKeys: (field, depth) => {
                asked.push([field, depth])
                return undefined
            }
        })

        expect(asked).toContainEqual(['size', 0])
    })

    it('leaves a field alone when the answer is undefined', () => {
        expect(headersFor({ columnKeys: () => undefined })).toEqual(['Large', 'Medium', 'Small'])
    })
})

describe('a key with nothing behind it', () => {
    const holed: Row[] = [
        { ...rows[0]!, id: 900, size: '' },
        { ...rows[1]!, id: 901, size: 'Small' }
    ]

    function build(locale?: Record<string, unknown>) {
        return createDataGrid<Row>({
            columns,
            data: holed,
            getRowId: (row) => String(row.id),
            ...(locale ?? {}),
            features: [
                pivot<Row>({
                    rows: ['region'],
                    columns: ['size'],
                    values: [{ field: 'amount', agg: 'sum' }]
                })
            ]
        })
    }

    it('is headed by the label the grid uses for a blank everywhere else', () => {
        const grid = build({ labels: { blankValue: 'KHONG CO' } })
        const blank = grid.columns.visible.find((column) => column.id === '__pv:c:(blank)::0')

        expect(grid.labels.blankValue).toBe('KHONG CO')
        expect(blank).toBeDefined()
        expect(String(blank!.def.header)).toBe('KHONG CO')
    })

    it('keeps that label out of the column id, so a translation cannot move a column', () => {
        const grid = build({ labels: { blankValue: '(trong)' } })
        const ids = grid.columns.visible.map((column) => column.id)

        expect(ids).toContain('__pv:c:(blank)::0')
        expect(ids.some((id) => id.includes('trong'))).toBe(false)
    })
})
