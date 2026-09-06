import { describe, expect, it } from 'vitest'
import { type ColumnDef } from '../../core/types/index.js'
import { buildStore } from './columnar.js'
import { runQuery } from './query.js'
import { workerDataSource } from './worker-row-model.js'

interface Row {
    id: number
    name: string
}

const rows: Row[] = [
    { id: 1, name: 'a' },
    { id: 2, name: 'b' }
]

const columns: ColumnDef<Row>[] = [{ id: 'name', filter: 'text' }]

const anyRequest = {
    startRow: 0,
    endRow: 10,
    sortModel: [],
    filterModel: { quick: '', quickFields: [], columns: {} },
    groupKeys: [],
    groupBy: []
}

describe('a filter model that names something off the prototype', () => {
    const store = buildStore({ name: ['a', 'b'] }, 2)

    it('answers a column that is not a column rather than crashing', () => {
        const filter = {
            quick: '',
            quickFields: [],
            columns: {
                constructor: {
                    join: 'and',
                    conditions: [{ kind: 'text', op: 'equals', value: 'a' }]
                },
                toString: { join: 'and', conditions: [{ kind: 'text', op: 'blank', value: '' }] }
            }
        }

        expect(runQuery(store, { filter: filter as never, sort: [] }).rowCount).toBe(2)
    })

    it('ignores a quick field that is not a column', () => {
        const filter = { quick: 'a', quickFields: ['constructor', 'name'], columns: {} }
        expect(runQuery(store, { filter: filter as never, sort: [] }).rowCount).toBe(1)
    })

    it('sorts by a column that is not a column without inventing an order', () => {
        const filter = { quick: '', quickFields: [], columns: {} }
        const sorted = runQuery(store, {
            filter: filter as never,
            sort: [{ columnId: '__proto__', direction: 'asc' }]
        })
        expect([...sorted.indices]).toEqual([0, 1])
    })
})

describe('rows changing underneath a query in flight', () => {
    it('refuses the answer rather than mapping it onto the new rows', async () => {
        const source = workerDataSource<Row>(rows, { columns, inline: true })
        const inFlight = source.getRows(anyRequest)
        source.setRows([{ id: 9, name: 'z' }])

        await expect(inFlight).rejects.toThrow(/in flight/)

        const after = await source.getRows(anyRequest)
        expect(after.rows.map((row) => row.id)).toEqual([9])
    })

    it('leaves no answer hanging when the source is disposed', async () => {
        const source = workerDataSource<Row>(rows, { columns, inline: true })
        const inFlight = source.getRows(anyRequest)
        source.dispose()

        await expect(inFlight).rejects.toThrow(/disposed/)
        await expect(source.getRows(anyRequest)).rejects.toThrow(/disposed/)
    })
})

describe('scrolling a filtered table', () => {
    it('runs the pass once and windows it, rather than once per block', async () => {
        const many: Row[] = Array.from({ length: 120_000 }, (_, index) => ({
            id: index + 1,
            name: `Person ${(index * 7919) % 120_000}`
        }))
        const source = workerDataSource<Row>(many, { columns, inline: true })

        const block = (start: number) => ({
            startRow: start,
            endRow: start + 200,
            sortModel: [{ columnId: 'name', direction: 'asc' as const }],
            filterModel: { quick: 'person 1', quickFields: ['name'], columns: {} },
            groupKeys: [],
            groupBy: []
        })

        const firstStart = performance.now()
        await source.getRows(block(0))
        const first = performance.now() - firstStart

        const restStart = performance.now()
        for (let index = 1; index <= 10; index++) await source.getRows(block(index * 200))
        const rest = performance.now() - restStart

        expect(rest).toBeLessThan(first)
    })
})

describe('a column whose search text is not its value', () => {
    interface Money {
        id: number
        total: number
    }
    const priced: Money[] = [
        { id: 1, total: 900 },
        { id: 2, total: 1200 },
        { id: 3, total: 80 }
    ]
    const moneyColumns: ColumnDef<Money>[] = [{ id: 'total', type: 'currency', filter: 'number' }]

    function source() {
        return workerDataSource<Money>(priced, {
            columns: moneyColumns,
            inline: true,
            searchText: (value) => `$${Number(value).toLocaleString('en-US')}`
        })
    }

    it('still compares the number when filtering', async () => {
        const result = await source().getRows({
            ...anyRequest,
            endRow: 50,
            filterModel: {
                quick: '',
                quickFields: [],
                columns: {
                    total: { join: 'and', conditions: [{ kind: 'number', op: 'gt', value: 100 }] }
                }
            }
        })
        expect(result.rows.map((row) => row.id).sort()).toEqual([1, 2])
    })

    it('still sorts by the number, not by the text', async () => {
        const result = await source().getRows({
            ...anyRequest,
            endRow: 50,
            sortModel: [{ columnId: 'total', direction: 'asc' }]
        })
        expect(result.rows.map((row) => row.total)).toEqual([80, 900, 1200])
    })

    it('searches the text a quick filter was given', async () => {
        const result = await source().getRows({
            ...anyRequest,
            endRow: 50,
            filterModel: { quick: '$1,200', quickFields: ['total'], columns: {} }
        })
        expect(result.rows.map((row) => row.id)).toEqual([2])
    })
})

describe('options an app did not pass', () => {
    it('does not mistake a method every object carries for one of them', async () => {
        const source = workerDataSource<Row>(rows, { columns, inline: true })

        const result = await source.getRows({
            ...anyRequest,
            filterModel: {
                quick: '',
                quickFields: [],
                columns: {
                    name: { join: 'and', conditions: [{ kind: 'text', op: 'equals', value: 'a' }] }
                }
            }
        })

        expect(result.rows.map((row) => row.id)).toEqual([1])
    })
})
