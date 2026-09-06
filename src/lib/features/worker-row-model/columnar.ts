export type StoreKind = 'number' | 'date' | 'boolean' | 'string'

export interface ColumnStore {
    kind: StoreKind
    numbers?: Float64Array
    times?: Float64Array
    days?: Float64Array
    flags?: Uint8Array
    codes?: Uint32Array
    dictionary?: string[]
    dictionaryDays?: Float64Array
    dictionaryTimes?: Float64Array
    lowered?: string[]
    rank?: Uint32Array
}

export interface RowStore {
    rowCount: number
    columns: Record<string, ColumnStore>
    texts: Record<string, ColumnStore>
}

export const BOOLEAN_BLANK = 2

export const MS_PER_DAY = 86_400_000

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export function isBlank(value: unknown): boolean {
    return value === null || value === undefined || value === ''
}

function localDay(date: Date): number {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY
}

export function toEpochDay(value: unknown): number {
    if (isBlank(value)) return Number.NaN
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? Number.NaN : localDay(value)
    if (typeof value === 'number') return localDay(new Date(value))

    const text = String(value).trim()
    if (DATE_ONLY.test(text)) return Date.parse(text) / MS_PER_DAY

    const parsed = new Date(text)
    return Number.isNaN(parsed.getTime()) ? Number.NaN : localDay(parsed)
}

export function setKeyOf(value: unknown): string | number | boolean | null {
    if (isBlank(value)) return null
    if (typeof value === 'number' || typeof value === 'boolean') return value
    if (value instanceof Date) return value.toISOString()
    return String(value)
}

export function kindOfValues(read: (index: number) => unknown, rowCount: number): StoreKind {
    for (let index = 0; index < rowCount; index++) {
        const value = read(index)
        if (isBlank(value)) continue
        if (typeof value === 'number') return 'number'
        if (typeof value === 'boolean') return 'boolean'
        if (value instanceof Date) return 'date'
        return 'string'
    }
    return 'string'
}

function numberColumn(read: (index: number) => unknown, rowCount: number): ColumnStore {
    const numbers = new Float64Array(rowCount)
    for (let index = 0; index < rowCount; index++) {
        const value = read(index)
        numbers[index] = isBlank(value) ? Number.NaN : Number(value)
    }
    return { kind: 'number', numbers }
}

function dateColumn(read: (index: number) => unknown, rowCount: number): ColumnStore {
    const times = new Float64Array(rowCount)
    const days = new Float64Array(rowCount)
    for (let index = 0; index < rowCount; index++) {
        const value = read(index)
        const time = value instanceof Date ? value.getTime() : Number.NaN
        times[index] = time
        days[index] = toEpochDay(value)
    }
    return { kind: 'date', times, days }
}

function booleanColumn(read: (index: number) => unknown, rowCount: number): ColumnStore {
    const flags = new Uint8Array(rowCount)
    for (let index = 0; index < rowCount; index++) {
        const value = read(index)
        flags[index] = isBlank(value) ? BOOLEAN_BLANK : value ? 1 : 0
    }
    return { kind: 'boolean', flags }
}

function stringColumn(read: (index: number) => unknown, rowCount: number): ColumnStore {
    const dictionary: string[] = ['']
    const seen = new Map<string, number>()
    const codes = new Uint32Array(rowCount)

    for (let index = 0; index < rowCount; index++) {
        const value = read(index)
        if (isBlank(value)) continue

        const text = String(value)
        let code = seen.get(text)
        if (code === undefined) {
            code = dictionary.length
            dictionary.push(text)
            seen.set(text, code)
        }
        codes[index] = code
    }

    return { kind: 'string', codes, dictionary }
}

export function buildColumn(read: (index: number) => unknown, rowCount: number): ColumnStore {
    switch (kindOfValues(read, rowCount)) {
        case 'number':
            return numberColumn(read, rowCount)
        case 'date':
            return dateColumn(read, rowCount)
        case 'boolean':
            return booleanColumn(read, rowCount)
        default:
            return stringColumn(read, rowCount)
    }
}

export type ColumnValues = Record<string, unknown[]>

function storeOf(values: ColumnValues, rowCount: number): Record<string, ColumnStore> {
    const columns: Record<string, ColumnStore> = Object.create(null)
    for (const [field, column] of Object.entries(values)) {
        columns[field] = buildColumn((index) => column[index], rowCount)
    }
    return columns
}

export function buildStore(
    values: ColumnValues,
    rowCount: number,
    texts: ColumnValues = {}
): RowStore {
    return {
        rowCount,
        columns: storeOf(values, rowCount),
        texts: storeOf(texts, rowCount)
    }
}

export function columnOf(store: RowStore, columnId: string): ColumnStore | undefined {
    return Object.hasOwn(store.columns, columnId) ? store.columns[columnId] : undefined
}

export function textOf(store: RowStore, columnId: string): ColumnStore | undefined {
    return Object.hasOwn(store.texts, columnId) ? store.texts[columnId] : undefined
}

export function readStore(store: ColumnStore, index: number): unknown {
    if (store.kind === 'string') {
        const code = store.codes![index]!
        return code === 0 ? null : store.dictionary![code]!
    }
    if (store.kind === 'boolean') {
        const flag = store.flags![index]!
        return flag === BOOLEAN_BLANK ? null : flag === 1
    }
    if (store.kind === 'date') {
        const time = store.times![index]!
        return Number.isNaN(time) ? null : new Date(time)
    }
    const value = store.numbers![index]!
    return Number.isNaN(value) ? null : value
}

export function dictionaryDaysOf(store: ColumnStore): Float64Array {
    if (!store.dictionaryDays) {
        const dictionary = store.dictionary!
        const days = new Float64Array(dictionary.length)
        days[0] = Number.NaN
        for (let code = 1; code < dictionary.length; code++)
            days[code] = toEpochDay(dictionary[code])
        store.dictionaryDays = days
    }
    return store.dictionaryDays
}

export function loweredOf(store: ColumnStore): string[] {
    if (!store.lowered) {
        const dictionary = store.dictionary!
        const lowered = new Array<string>(dictionary.length)
        for (let code = 0; code < dictionary.length; code++) {
            lowered[code] = dictionary[code]!.toLowerCase()
        }
        store.lowered = lowered
    }
    return store.lowered
}

export function dictionaryTimesOf(store: ColumnStore): Float64Array {
    if (!store.dictionaryTimes) {
        const dictionary = store.dictionary!
        const times = new Float64Array(dictionary.length)
        times[0] = Number.NaN
        for (let code = 1; code < dictionary.length; code++) {
            times[code] = new Date(dictionary[code]!).getTime()
        }
        store.dictionaryTimes = times
    }
    return store.dictionaryTimes
}

export function rankOf(store: ColumnStore, collator: Intl.Collator): Uint32Array {
    if (!store.rank) {
        const dictionary = store.dictionary!
        const order = new Array<number>(dictionary.length - 1)
        for (let index = 0; index < order.length; index++) order[index] = index + 1

        order.sort((a, b) => collator.compare(dictionary[a]!, dictionary[b]!))

        const rank = new Uint32Array(dictionary.length)
        for (let position = 0; position < order.length; position++)
            rank[order[position]!] = position + 1
        store.rank = rank
    }
    return store.rank
}
