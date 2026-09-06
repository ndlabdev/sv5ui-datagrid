import { type FilterRequest, type SortState } from '../../core/types/index.js'
import type { FilterNode } from '../advanced-filter/advanced-filter.types.js'
import { matchesNode } from '../advanced-filter/evaluate.js'
import {
    BOOLEAN_BLANK,
    columnOf,
    dictionaryTimesOf,
    textOf,
    MS_PER_DAY,
    dictionaryDaysOf,
    isBlank,
    loweredOf,
    rankOf,
    readStore,
    type ColumnStore,
    type RowStore
} from './columnar.js'
import { predicateFor } from './predicates.js'

export interface WorkerQuery {
    filter: FilterRequest
    sort: SortState[]
    advancedFilter?: FilterNode | null
    dateColumns?: string[]
    nulls?: 'first' | 'last'
    groupBy?: string[]
    groupKeys?: unknown[]
}

export interface QueryResult {
    indices: Uint32Array
    rowCount: number
}

export interface QueryOverrides {
    comparators?: Record<string, (a: number, b: number) => number>
    predicates?: Record<string, (index: number) => boolean>
}

type RowTest = (index: number) => boolean

const collator = new Intl.Collator(undefined, { numeric: true })

function stringTest(
    store: ColumnStore,
    filter: Parameters<typeof predicateFor>[0],
    accept: (value: unknown) => boolean
): RowTest {
    const dictionary = store.dictionary!
    const size = filter.kind === 'date' ? dictionaryDaysOf(store).length : dictionary.length
    const mask = new Uint8Array(size)
    for (let code = 0; code < size; code++) {
        mask[code] = accept(code === 0 ? null : dictionary[code]) ? 1 : 0
    }

    const codes = store.codes!
    return (index) => mask[codes[index]!] === 1
}

function dateTest(store: ColumnStore, accept: (value: unknown) => boolean): RowTest {
    const days = store.days!
    const cache = new Map<number, boolean>()

    return (index) => {
        const day = days[index]!
        const key = Number.isNaN(day) ? Number.MIN_SAFE_INTEGER : day
        let answer = cache.get(key)
        if (answer === undefined) {
            answer = accept(Number.isNaN(day) ? null : day * MS_PER_DAY)
            cache.set(key, answer)
        }
        return answer
    }
}

function testFor(store: ColumnStore, filter: Parameters<typeof predicateFor>[0]): RowTest {
    const accept = predicateFor(filter)

    if (store.kind === 'string') return stringTest(store, filter, accept)

    if (store.kind === 'boolean') {
        const flags = store.flags!
        const answers = [accept(false), accept(true), accept(null)]
        return (index) => answers[flags[index]!]!
    }

    if (store.kind === 'date' && filter.kind === 'date') return dateTest(store, accept)

    if (store.kind === 'number' && filter.kind === 'number') {
        const numbers = store.numbers!
        return (index) => {
            const value = numbers[index]!
            return accept(Number.isNaN(value) ? null : value)
        }
    }

    return (index) => accept(readStore(store, index))
}

function containsTest(column: ColumnStore, query: string): RowTest {
    if (column.kind === 'string') {
        const lowered = loweredOf(column)
        const mask = new Uint8Array(lowered.length)
        for (let code = 1; code < lowered.length; code++) {
            mask[code] = lowered[code]!.includes(query) ? 1 : 0
        }
        const codes = column.codes!
        return (index: number) => mask[codes[index]!] === 1
    }

    return (index: number) => {
        const value = readStore(column, index)
        return !isBlank(value) && String(value).toLowerCase().includes(query)
    }
}

function quickTest(store: RowStore, request: FilterRequest): RowTest | null {
    const query = request.quick.trim().toLowerCase()
    if (!query) return null

    const tests: RowTest[] = []
    for (const field of request.quickFields) {
        const column = columnOf(store, field)
        if (column) tests.push(containsTest(column, query))

        const text = textOf(store, field)
        if (text) tests.push(containsTest(text, query))
    }

    if (tests.length === 0) return () => false
    return (index) => tests.some((test) => test(index))
}

function columnTests(
    store: RowStore,
    request: FilterRequest,
    overrides: QueryOverrides | undefined
): RowTest[] {
    const tests: RowTest[] = []

    for (const [columnId, entry] of Object.entries(request.columns)) {
        const own = overrides?.predicates?.[columnId]
        if (own) {
            tests.push(own)
            continue
        }

        const column = columnOf(store, columnId)
        if (!column || entry.conditions.length === 0) continue

        const conditions = entry.conditions.map((condition) => testFor(column, condition))
        if (conditions.length === 1) {
            tests.push(conditions[0]!)
            continue
        }

        tests.push(
            entry.join === 'or'
                ? (index) => conditions.some((test) => test(index))
                : (index) => conditions.every((test) => test(index))
        )
    }

    return tests
}

function treeTest(store: RowStore, tree: FilterNode | null | undefined): RowTest | null {
    if (!tree || (tree.kind === 'group' && tree.children.length === 0)) return null

    return (index) =>
        matchesNode(tree, (columnId) => {
            const column = columnOf(store, columnId)
            return column ? readStore(column, index) : undefined
        })
}

function stringKeys(column: ColumnStore, rowCount: number, asDate: boolean): Float64Array {
    const codes = column.codes!
    const keys = new Float64Array(rowCount)

    if (asDate) {
        const times = dictionaryTimesOf(column)
        for (let index = 0; index < rowCount; index++) keys[index] = times[codes[index]!]!
        return keys
    }

    const rank = rankOf(column, collator)
    for (let index = 0; index < rowCount; index++) {
        const code = codes[index]!
        keys[index] = code === 0 ? Number.NaN : rank[code]!
    }
    return keys
}

function booleanKeys(column: ColumnStore, rowCount: number): Float64Array {
    const flags = column.flags!
    const keys = new Float64Array(rowCount)
    for (let index = 0; index < rowCount; index++) {
        const flag = flags[index]!
        keys[index] = flag === BOOLEAN_BLANK ? Number.NaN : flag
    }
    return keys
}

function keysFor(store: RowStore, columnId: string, asDate: boolean): Float64Array | null {
    const column = columnOf(store, columnId)
    if (!column) return null

    switch (column.kind) {
        case 'string':
            return stringKeys(column, store.rowCount, asDate)
        case 'boolean':
            return booleanKeys(column, store.rowCount)
        case 'date':
            return column.times!
        default:
            return column.numbers!
    }
}

function comparatorsFor(store: RowStore, query: WorkerQuery, overrides?: QueryOverrides) {
    const dates = new Set(query.dateColumns ?? [])
    const nullSign = (query.nulls ?? 'first') === 'last' ? 1 : -1

    return query.sort.flatMap((entry) => {
        const own = overrides?.comparators?.[entry.columnId]
        if (own) {
            const factor = entry.direction === 'asc' ? 1 : -1
            return [(a: number, b: number) => own(a, b) * factor]
        }

        const keys = keysFor(store, entry.columnId, dates.has(entry.columnId))
        if (!keys) return []

        const factor = entry.direction === 'asc' ? 1 : -1
        return [
            (a: number, b: number) => {
                const left = keys[a]!
                const right = keys[b]!
                const leftBlank = Number.isNaN(left)
                const rightBlank = Number.isNaN(right)
                if (leftBlank || rightBlank) {
                    if (leftBlank && rightBlank) return 0
                    return (leftBlank ? nullSign : -nullSign) * factor
                }
                return (left - right) * factor
            }
        ]
    })
}

export function runQuery(
    store: RowStore,
    query: WorkerQuery,
    overrides?: QueryOverrides
): QueryResult {
    const tests: RowTest[] = columnTests(store, query.filter, overrides)

    const quick = quickTest(store, query.filter)
    if (quick) tests.push(quick)

    const tree = treeTest(store, query.advancedFilter)
    if (tree) tests.push(tree)

    const kept: number[] = []
    for (let index = 0; index < store.rowCount; index++) {
        let passes = true
        for (const test of tests) {
            if (!test(index)) {
                passes = false
                break
            }
        }
        if (passes) kept.push(index)
    }

    const comparators = comparatorsFor(store, query, overrides)
    if (comparators.length > 0) {
        kept.sort((a, b) => {
            for (const compare of comparators) {
                const result = compare(a, b)
                if (result !== 0) return result
            }
            return a - b
        })
    }

    return { indices: Uint32Array.from(kept), rowCount: kept.length }
}
