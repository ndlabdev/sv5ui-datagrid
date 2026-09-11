import { buildStore, type ColumnValues, type RowStore } from './columnar.js'
import { groupLevel } from './grouping.js'
import { type QueryOverrides, type QueryResult, runQuery, type WorkerQuery } from './query.js'
import type { FromWorker, QueryMessage, ToWorker } from './protocol.js'

const EMPTY: RowStore = { rowCount: 0, columns: Object.create(null), texts: Object.create(null) }

function fill(into: ColumnValues, slices: Record<string, unknown[]>, from: number): void {
    for (const [field, slice] of Object.entries(slices)) {
        if (!Object.hasOwn(into, field)) continue
        const target = into[field]!
        for (let offset = 0; offset < slice.length; offset++) {
            target[from + offset] = slice[offset]
        }
    }
}

function passKey(query: WorkerQuery): string {
    return JSON.stringify([
        query.filter,
        query.sort,
        query.advancedFilter ?? null,
        query.dateColumns ?? [],
        query.nulls ?? 'first'
    ])
}

export function createEngine(
    overridesFor?: (query: WorkerQuery) => QueryOverrides
): (message: ToWorker) => FromWorker | null {
    let store: RowStore = EMPTY
    let incoming: ColumnValues = Object.create(null)
    let incomingTexts: ColumnValues = Object.create(null)
    let rowCount = 0

    let cachedKey: string | null = null
    let cached: QueryResult | null = null

    function pass(query: WorkerQuery): QueryResult {
        const key = passKey(query)
        if (cachedKey === key && cached) return cached

        cached = runQuery(store, query, overridesFor?.(query))
        cachedKey = key
        return cached
    }

    function answer(message: QueryMessage): FromWorker {
        const { indices, rowCount: matched } = pass(message.query)

        const groupBy = message.query.groupBy ?? []
        if (groupBy.length > 0) {
            const level = groupLevel(store, indices, {
                groupBy,
                groupKeys: message.query.groupKeys ?? [],
                startRow: message.startRow,
                endRow: message.endRow
            })
            return {
                type: 'result',
                id: message.id,
                indices: level.indices,
                rowCount: level.rowCount,
                groups: level.groups
            }
        }

        const window = indices.subarray(
            Math.min(message.startRow, matched),
            Math.min(message.endRow, matched)
        )
        return { type: 'result', id: message.id, indices: [...window], rowCount: matched }
    }

    function forget(): void {
        cachedKey = null
        cached = null
    }

    return (message) => {
        if (message.type === 'load') {
            incoming = Object.create(null)
            incomingTexts = Object.create(null)
            rowCount = message.rowCount
            for (const field of message.fields) incoming[field] = new Array<unknown>(rowCount)
            for (const field of message.textFields) {
                incomingTexts[field] = new Array<unknown>(rowCount)
            }
            store = EMPTY
            forget()
            return null
        }

        if (message.type === 'chunk') {
            fill(incoming, message.values, message.from)
            fill(incomingTexts, message.texts, message.from)
            return null
        }

        if (message.type === 'loaded') {
            store = buildStore(incoming, rowCount, incomingTexts)
            incoming = Object.create(null)
            incomingTexts = Object.create(null)
            forget()
            return null
        }

        try {
            return answer(message)
        } catch (error) {
            return {
                type: 'failure',
                id: message.id,
                message: error instanceof Error ? error.message : String(error)
            }
        }
    }
}
