import { type ColumnDef } from '../../core/types/index.js'
import { getCellValue } from '../../core/utils/index.js'
import type { DataSource, GetRowsRequest, GetRowsResult } from '../server-row-model/index.js'
import { type ColumnValues, isBlank } from './columnar.js'
import { createEngine } from './engine.js'
import type { FromWorker, QueryMessage, ResultMessage, ToWorker } from './protocol.js'
import type { QueryOverrides, WorkerQuery } from './query.js'
import type { WorkerDataSource, WorkerDataSourceOptions } from './worker-row-model.types.js'

const CHUNK = 8_000

function closureColumns<TRow>(columns: ColumnDef<TRow>[]): Set<string> {
    const named = new Set<string>()
    for (const column of columns) {
        const def = column as unknown as Record<string, unknown>
        const filter = column.filter
        const custom =
            typeof def.sortFn === 'function' ||
            (typeof filter === 'object' && typeof filter.predicate === 'function')
        if (custom) named.add(column.id)
    }
    return named
}

function dateColumnsOf<TRow>(columns: ColumnDef<TRow>[]): string[] {
    return columns
        .filter((column) => column.type === 'date' || column.type === 'datetime')
        .map((column) => column.id)
}

function queryOf(
    request: GetRowsRequest,
    dateColumns: string[],
    nulls: 'first' | 'last'
): WorkerQuery {
    return {
        filter: request.filterModel,
        sort: request.sortModel,
        advancedFilter: request.advancedFilter ?? null,
        dateColumns,
        nulls,
        groupBy: request.groupBy,
        groupKeys: request.groupKeys
    }
}

function spawn(): Worker | null {
    if (typeof Worker === 'undefined') return null
    try {
        return new Worker(new URL('./worker.js', import.meta.url), { type: 'module' })
    } catch {
        return null
    }
}

const MAX_PLAIN_DEPTH = 32

function plain<T>(value: T, depth = 0): T {
    if (value === null || typeof value !== 'object') return value
    if (depth >= MAX_PLAIN_DEPTH) return null as T
    if (value instanceof Date) return new Date(value.getTime()) as T
    if (Array.isArray(value)) return value.map((entry) => plain(entry, depth + 1)) as T

    const copy: Record<string, unknown> = {}
    for (const [key, entry] of Object.entries(value)) copy[key] = plain(entry, depth + 1)
    return copy as T
}

function postable(message: ToWorker): ToWorker {
    return message.type === 'query' ? { ...message, query: plain(message.query) } : plain(message)
}

const yieldToPaint = (): Promise<void> =>
    new Promise((resolve) => {
        setTimeout(resolve, 0)
    })

export function workerDataSource<TRow>(
    rows: TRow[],
    options: WorkerDataSourceOptions<TRow>
): DataSource<TRow> & WorkerDataSource<TRow> {
    const readable = options.columns.filter((column) => column.type !== 'actions')
    const withClosures = closureColumns(options.columns)
    const dateColumns = dateColumnsOf(options.columns)
    const nulls = options.nulls ?? 'first'
    const readValue = Object.hasOwn(options, 'readValue') ? options.readValue : undefined

    let loaded = rows
    const empty = new Set<string>()
    const warned = new Set<string>()

    function valueAt(index: number, column: ColumnDef<TRow>): unknown {
        const row = loaded[index]!
        const supplied = readValue?.(row, column)
        return supplied === undefined ? getCellValue(row, column) : supplied
    }

    function chunkOf(from: number, to: number): { values: ColumnValues; texts: ColumnValues } {
        const values: ColumnValues = {}
        const texts: ColumnValues = {}

        for (const column of readable) {
            const slice = new Array<unknown>(to - from)
            const drawn = options.searchText ? new Array<unknown>(to - from) : null

            for (let index = from; index < to; index++) {
                const value = valueAt(index, column)
                slice[index - from] = value
                if (!isBlank(value)) empty.delete(column.id)
                if (drawn) drawn[index - from] = options.searchText!(value, column) ?? ''
            }

            values[column.id] = slice
            if (drawn) texts[column.id] = drawn
        }

        return { values, texts }
    }

    function warnEmpty(request: GetRowsRequest): void {
        const asked = [
            ...request.sortModel.map((entry) => entry.columnId),
            ...Object.keys(request.filterModel.columns)
        ]

        for (const columnId of asked) {
            if (!empty.has(columnId) || warned.has(columnId)) continue
            warned.add(columnId)
            // eslint-disable-next-line no-console
            console.warn(
                `workerDataSource loaded no value for "${columnId}", so filtering or sorting ` +
                    'by it answers from nothing. A computed column - a formula column above all - ' +
                    'is worked out on the client after the worker has answered: pass readValue to ' +
                    'give the worker the same value, or leave the column out of the query.'
            )
        }
    }

    function overridesFor(query: WorkerQuery): QueryOverrides {
        const comparators: Record<string, (a: number, b: number) => number> = {}
        const predicates: Record<string, (index: number) => boolean> = {}

        for (const column of options.columns) {
            if (!withClosures.has(column.id)) continue

            const def = column as unknown as Record<string, unknown>
            const sortFn = def.sortFn as ((a: TRow, b: TRow) => number) | undefined
            if (sortFn) comparators[column.id] = (a, b) => sortFn(loaded[a]!, loaded[b]!)

            const filter = column.filter
            const entry = query.filter.columns[column.id]
            if (typeof filter === 'object' && typeof filter.predicate === 'function' && entry) {
                const predicate = filter.predicate
                predicates[column.id] = (index) => {
                    const row = loaded[index]!
                    const value = getCellValue(row, column)
                    const answers = entry.conditions.map((condition) =>
                        predicate(value, row, condition)
                    )
                    return entry.join === 'or' ? answers.some(Boolean) : answers.every(Boolean)
                }
            }
        }

        return { comparators, predicates }
    }

    let worker = options.inline ? null : spawn()
    let disposed = false
    let generation = 0
    const local = createEngine(overridesFor)
    const pending = new Map<number, (answer: FromWorker) => void>()
    let nextId = 0

    function abandon(reason: string): void {
        for (const [id, settle] of pending) settle({ type: 'failure', id, message: reason })
        pending.clear()
    }

    if (worker) {
        worker.onmessage = (event: MessageEvent<FromWorker>) => {
            const settle = pending.get(event.data.id)
            if (!settle) return
            pending.delete(event.data.id)
            settle(event.data)
        }

        worker.onerror = (event) => {
            const reason = event.message || 'workerDataSource: the worker stopped.'
            worker?.terminate()
            worker = null
            abandon(reason)
            ready = ready ? start() : null
            options.onFallback?.(reason)
        }
    }

    function send(message: ToWorker): void {
        if (worker) worker.postMessage(postable(message))
        if (!worker || withClosures.size > 0) local(message)
    }

    async function load(): Promise<void> {
        const fields = readable.map((column) => column.id)
        for (const field of fields) empty.add(field)
        send({
            type: 'load',
            fields,
            textFields: options.searchText ? fields : [],
            rowCount: loaded.length
        })

        for (let from = 0; from < loaded.length; from += CHUNK) {
            const to = Math.min(from + CHUNK, loaded.length)
            send({ type: 'chunk', from, ...chunkOf(from, to) })
            if (to < loaded.length) await yieldToPaint()
        }

        send({ type: 'loaded' })
    }

    function start(): Promise<void> {
        const attempt = load()
        attempt.catch(() => {})
        return attempt
    }

    let ready: Promise<void> | null = null

    function needsLocal(request: GetRowsRequest): boolean {
        if (!worker) return true
        if (withClosures.size === 0) return false
        if (request.sortModel.some((entry) => withClosures.has(entry.columnId))) return true
        return Object.keys(request.filterModel.columns).some((id) => withClosures.has(id))
    }

    async function ask(message: QueryMessage): Promise<ResultMessage> {
        const reply = await new Promise<FromWorker>((resolve) => {
            pending.set(message.id, resolve)
            worker!.postMessage(postable(message))
        })
        if (reply.type === 'failure') throw new Error(reply.message)
        return reply
    }

    function refuse(request: GetRowsRequest): string | null {
        if (disposed) return 'workerDataSource: the source was disposed.'
        if (request.groupBy.length > 0 && !options.groupRow) {
            return (
                'workerDataSource was asked for grouped rows without a groupRow option: it ' +
                'counts the groups, but only the app knows what one of its own rows looks ' +
                'like. Pass groupRow: (keys, count) => row.'
            )
        }
        return null
    }

    function resultOf(reply: ResultMessage, from: TRow[]): GetRowsResult<TRow> {
        if (reply.groups) {
            return {
                rows: reply.groups.map((group) => options.groupRow!(group.keys, group.count)),
                rowCount: reply.rowCount
            }
        }
        return { rows: rowsAt(reply.indices, from), rowCount: reply.rowCount }
    }

    function rowsAt(indices: number[], from: TRow[]): TRow[] {
        const answer: TRow[] = []
        for (const index of indices) {
            const row = from[index]
            if (row !== undefined) answer.push(row)
        }
        return answer
    }

    return {
        get usingWorker() {
            return worker !== null
        },

        setRows(next: TRow[]) {
            if (disposed) return
            generation += 1
            loaded = next
            abandon('workerDataSource: the rows were replaced while this query was in flight.')
            ready = ready ? start() : null
        },

        dispose() {
            disposed = true
            ready = null
            generation += 1
            worker?.terminate()
            worker = null
            abandon('workerDataSource: the source was disposed.')
            local({ type: 'load', fields: [], textFields: [], rowCount: 0 })
            local({ type: 'loaded' })
        },

        async getRows(request: GetRowsRequest): Promise<GetRowsResult<TRow>> {
            const refused = refuse(request)
            if (refused) throw new Error(refused)

            const asked = generation
            const rowsWhenAsked = loaded
            await (ready ??= start())
            warnEmpty(request)

            const message: QueryMessage = {
                type: 'query',
                id: nextId++,
                startRow: request.startRow,
                endRow: request.endRow,
                query: queryOf(request, dateColumns, nulls)
            }

            const answered = needsLocal(request) ? local(message) : await ask(message)
            if (!answered) throw new Error('workerDataSource: the query was never answered.')
            if (answered.type === 'failure') throw new Error(answered.message)
            if (disposed) throw new Error('workerDataSource: the source was disposed.')
            if (asked !== generation) {
                throw new Error(
                    'workerDataSource: the rows changed while this query was in flight.'
                )
            }

            return resultOf(answered, rowsWhenAsked)
        }
    }
}
