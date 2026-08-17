import { describe, expect, it } from 'vitest'
import type { ColumnDef, FilterRequest, SortRequestEntry } from '$lib/index.js'
import {
    createDataGrid,
    filtering,
    getFiltering,
    getSorting,
    sorting,
    toFilterRequest,
    toSortRequest
} from '$lib/index.js'

/**
 * What a backend can do with what it is sent.
 *
 * The reference below is allowed to read the request and the rows, and nothing
 * else: no column definitions, no grid, no knowledge of how the client drew
 * anything. Whatever it cannot reproduce is not a bug in it, it is something
 * the wire format does not carry, and a real backend will diverge there in
 * exactly the same way and without saying so.
 */
interface Row {
    id: string
    name: string
    score: number | null
    dept: string
}

const rows: Row[] = [
    { id: '1', name: 'Item 2', score: 20, dept: 'Core' },
    { id: '2', name: 'Item 10', score: null, dept: 'Data' },
    { id: '3', name: 'item 3', score: 5, dept: 'Core' },
    { id: '4', name: 'Item 1', score: 100, dept: 'Ops' }
]

const columns: ColumnDef<Row>[] = [
    { id: 'name', sortable: true, filter: 'text' },
    { id: 'score', type: 'number', sortable: true, filter: 'number' },
    { id: 'dept', sortable: true, filter: 'set' }
]

function gridOf() {
    return createDataGrid<Row>({
        columns,
        data: rows,
        getRowId: (row) => row.id,
        features: [filtering(), sorting()]
    })
}

const isBlank = (value: unknown) => value === null || value === undefined || value === ''

/**
 * Natural ordering, the one thing here a backend has to be told rather than
 * sent: the grid compares text with numeric collation, so "Item 2" comes
 * before "Item 10". A database ordering by its own default collation puts them
 * the other way, and the grid under a server row model does not re-sort what
 * it is handed, so what the reader sees is whatever the backend decided.
 */
const collator = new Intl.Collator(undefined, { numeric: true })

/** The documented meaning of one condition, as a backend would implement it. */
function conditionHolds(
    value: unknown,
    condition: FilterRequest['columns'][string]['conditions'][number]
): boolean {
    switch (condition.kind) {
        case 'text': {
            if (condition.op === 'blank') return isBlank(value)
            if (condition.op === 'notBlank') return !isBlank(value)
            const fold = (text: string) => (condition.caseSensitive ? text : text.toLowerCase())
            const query = fold(condition.value.trim())
            if (isBlank(value)) return condition.op === 'notContains' || condition.op === 'notEqual'
            const text = fold(String(value))
            if (condition.op === 'contains') return text.includes(query)
            if (condition.op === 'notContains') return !text.includes(query)
            if (condition.op === 'equals') return text === query
            if (condition.op === 'notEqual') return text !== query
            if (condition.op === 'startsWith') return text.startsWith(query)
            return text.endsWith(query)
        }
        case 'number': {
            if (condition.op === 'blank') return isBlank(value)
            if (condition.op === 'notBlank') return !isBlank(value)
            if (isBlank(value)) return false
            const numeric = Number(value)
            const target = condition.value ?? Number.NaN
            if (condition.op === 'between')
                return numeric >= target && numeric <= (condition.to ?? Number.NaN)
            if (condition.op === 'eq') return numeric === target
            if (condition.op === 'neq') return numeric !== target
            if (condition.op === 'gt') return numeric > target
            if (condition.op === 'gte') return numeric >= target
            if (condition.op === 'lt') return numeric < target
            return numeric <= target
        }
        case 'set':
            return condition.values.includes(isBlank(value) ? null : (value as never))
        case 'boolean':
            return Boolean(value) === condition.value
        default:
            return true
    }
}

/** A backend, holding only the request. */
function applyRequest(source: Row[], filter: FilterRequest, sort: SortRequestEntry[]): string[] {
    let result = source.filter((row) => {
        for (const [columnId, entry] of Object.entries(filter.columns)) {
            const value = row[columnId as keyof Row]
            const holds = entry.conditions.map((condition) => conditionHolds(value, condition))
            const passed = entry.join === 'or' ? holds.some(Boolean) : holds.every(Boolean)
            if (!passed) return false
        }
        return true
    })

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
                const left = a.row[entry.field as keyof Row]
                const right = b.row[entry.field as keyof Row]
                const factor = entry.direction === 'asc' ? 1 : -1
                if (isBlank(left) && isBlank(right)) continue
                // Written where the request says, rather than where SQL would
                // put them by default.
                const holes = entry.nulls === 'last' ? 1 : -1
                if (isBlank(left)) return holes
                if (isBlank(right)) return -holes
                if (left === right) continue
                const result =
                    typeof left === 'number' && typeof right === 'number'
                        ? left - right
                        : collator.compare(String(left), String(right))
                if (result !== 0) return result * factor
            }
            return a.index - b.index
        })
        .map(({ row }) => row.id)
}

function clientAnswer(setUp: (grid: ReturnType<typeof gridOf>) => void): {
    client: string[]
    server: string[]
} {
    const grid = gridOf()
    setUp(grid)
    const sorting = getSorting(grid)!
    const filter = toFilterRequest(
        getFiltering(grid)!.model,
        grid.columns.visible.map((column) => column.id)
    )
    const sort = toSortRequest(sorting.sort, grid.columns.defs, sorting.nulls)
    return {
        client: grid.nodes.map((node) => node.id),
        server: applyRequest(rows, filter, sort)
    }
}

describe('a backend given the request answers what the client answered', () => {
    it('for a text filter', () => {
        const { client, server } = clientAnswer((grid) =>
            getFiltering(grid)!.setColumnFilter('name', {
                kind: 'text',
                op: 'contains',
                value: 'item'
            })
        )
        expect(server).toEqual(client)
    })

    it('for a case-sensitive text filter', () => {
        const { client, server } = clientAnswer((grid) =>
            getFiltering(grid)!.setColumnFilter('name', {
                kind: 'text',
                op: 'contains',
                value: 'Item',
                caseSensitive: true
            })
        )
        expect(server).toEqual(client)
    })

    it('for two conditions joined by or', () => {
        const { client, server } = clientAnswer((grid) =>
            getFiltering(grid)!.setColumnFilter('score', {
                kind: 'group',
                join: 'or',
                conditions: [
                    { kind: 'number', op: 'lt', value: 10 },
                    { kind: 'number', op: 'gt', value: 50 }
                ]
            })
        )
        expect(server).toEqual(client)
    })

    it('for a set filter', () => {
        const { client, server } = clientAnswer((grid) =>
            getFiltering(grid)!.setColumnFilter('dept', { kind: 'set', values: ['Core', 'Ops'] })
        )
        expect(server).toEqual(client)
    })

    it('for a quick filter', () => {
        const { client, server } = clientAnswer((grid) =>
            getFiltering(grid)!.setQuickFilter('core')
        )
        expect(server).toEqual(client)
    })

    it('for a sort by number', () => {
        const { client, server } = clientAnswer((grid) =>
            getSorting(grid)!.setSort([{ columnId: 'score', direction: 'asc' }])
        )
        expect(server).toEqual(client)
    })

    it('for a sort by text', () => {
        const { client, server } = clientAnswer((grid) =>
            getSorting(grid)!.setSort([{ columnId: 'name', direction: 'asc' }])
        )
        expect(server).toEqual(client)
    })

    it('for a sort with blanks in it', () => {
        const { client, server } = clientAnswer((grid) =>
            getSorting(grid)!.setSort([{ columnId: 'score', direction: 'desc' }])
        )
        expect(server).toEqual(client)
    })
})
