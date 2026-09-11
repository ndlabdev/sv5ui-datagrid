import type {
    ColumnDef,
    ColumnFilter,
    ColumnFilterDef,
    ColumnFilterEntry,
    DataGridLabels,
    FilterType,
    NumberFilterOp,
    PresenceFilterOp,
    RowNode
} from '../../core/types/index.js'
import { getCellValue, isBlank, localDay, MS_PER_DAY } from '../../core/utils/index.js'
import { setKeyOf } from './distinct-values.js'
import { normalizeFilterEntry } from './filter-model.js'

const PASSES = (): boolean => true

export function filterTypeOf<TRow>(def: ColumnDef<TRow>): FilterType | null {
    if (def.filter === false || def.filter === undefined) return null
    return typeof def.filter === 'string' ? def.filter : def.filter.type
}

function customPredicateOf<TRow>(
    def: ColumnDef<TRow>
): ColumnFilterDef<TRow>['predicate'] | undefined {
    return typeof def.filter === 'object' ? def.filter.predicate : undefined
}

function foldedQuery(filter: Extract<ColumnFilter, { kind: 'text' }>): {
    query: string
    read: (value: unknown) => string
} {
    const fold = filter.caseSensitive
        ? (text: string) => text
        : (text: string) => text.toLowerCase()
    return {
        query: fold(String(filter.value ?? '').trim()),
        read: (value: unknown) => fold(String(value))
    }
}

function textPredicate(
    filter: Extract<ColumnFilter, { kind: 'text' }>
): (value: unknown) => boolean {
    if (filter.op === 'blank') return (value) => isBlank(value)
    if (filter.op === 'notBlank') return (value) => !isBlank(value)

    const { query, read } = foldedQuery(filter)

    switch (filter.op) {
        case 'equals':
            return (value) => !isBlank(value) && read(value) === query
        case 'notEqual':
            return (value) => isBlank(value) || read(value) !== query
        case 'startsWith':
            return (value) => !isBlank(value) && read(value).startsWith(query)
        case 'endsWith':
            return (value) => !isBlank(value) && read(value).endsWith(query)
        case 'contains':
            return (value) => !isBlank(value) && read(value).includes(query)
        case 'notContains':
            return (value) => isBlank(value) || !read(value).includes(query)
        default:
            return PASSES
    }
}

type NumberComparator = (value: number, target: number) => boolean

const numberComparators: Record<
    Exclude<NumberFilterOp, 'blank' | 'notBlank' | 'between'>,
    NumberComparator
> = {
    eq: (value, target) => value === target,
    neq: (value, target) => value !== target,
    gt: (value, target) => value > target,
    gte: (value, target) => value >= target,
    lt: (value, target) => value < target,
    lte: (value, target) => value <= target
}

function numberPredicate(
    filter: Extract<ColumnFilter, { kind: 'number' }>
): (value: unknown) => boolean {
    if (filter.op === 'blank') return (value) => isBlank(value)
    if (filter.op === 'notBlank') return (value) => !isBlank(value)
    const target = filter.value ?? Number.NaN
    if (filter.op === 'between') {
        const to = filter.to ?? Number.NaN
        return (value) => {
            if (isBlank(value)) return false
            const numeric = Number(value)
            return numeric >= target && numeric <= to
        }
    }
    const compare = (numberComparators as Partial<Record<NumberFilterOp, NumberComparator>>)[
        filter.op
    ]
    if (!compare) return PASSES
    if (filter.op === 'neq') return (value) => isBlank(value) || compare(Number(value), target)
    return (value) => !isBlank(value) && compare(Number(value), target)
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function toEpochDay(value: unknown): number {
    if (isBlank(value)) return Number.NaN
    if (value instanceof Date) return localDay(value)
    if (typeof value === 'number') return localDay(new Date(value))

    const text = String(value).trim()
    if (DATE_ONLY.test(text)) return Date.parse(text) / MS_PER_DAY

    const parsed = new Date(text)
    return Number.isNaN(parsed.getTime()) ? Number.NaN : localDay(parsed)
}

function datePredicate(
    filter: Extract<ColumnFilter, { kind: 'date' }>
): (value: unknown) => boolean {
    if (filter.op === 'blank') return (value) => isBlank(value)
    if (filter.op === 'notBlank') return (value) => !isBlank(value)

    const target = toEpochDay(filter.value)
    const to = toEpochDay(filter.to)
    switch (filter.op) {
        case 'equals':
            return (value) => toEpochDay(value) === target
        case 'notEqual':
            return (value) => isBlank(value) || toEpochDay(value) !== target
        case 'before':
            return (value) => toEpochDay(value) < target
        case 'after':
            return (value) => toEpochDay(value) > target
        case 'between':
            return (value) => {
                const day = toEpochDay(value)
                return day >= target && day <= to
            }
        default:
            return PASSES
    }
}

function setPredicate(filter: Extract<ColumnFilter, { kind: 'set' }>): (value: unknown) => boolean {
    if (!Array.isArray(filter.values)) return PASSES
    const allowed = new Set(filter.values.map((entry) => setKeyOf(entry)))
    return (value) => allowed.has(setKeyOf(value))
}

function booleanPredicate(
    filter: Extract<ColumnFilter, { kind: 'boolean' }>
): (value: unknown) => boolean {
    return (value) => Boolean(value) === filter.value
}

export function valuePredicateFor(filter: ColumnFilter): (value: unknown) => boolean {
    switch (filter.kind) {
        case 'text':
            return textPredicate(filter)
        case 'number':
            return numberPredicate(filter)
        case 'date':
            return datePredicate(filter)
        case 'set':
            return setPredicate(filter)
        case 'boolean':
            return booleanPredicate(filter)
        default:
            return PASSES
    }
}

function entryPredicate<TRow>(
    def: ColumnDef<TRow>,
    entry: ColumnFilterEntry
): (value: unknown, row: TRow) => boolean {
    const { join, conditions } = normalizeFilterEntry(entry)
    const custom = customPredicateOf(def)

    const listed = Array.isArray(conditions) ? conditions : []
    const tests = listed.map((condition) => {
        if (custom) return (value: unknown, row: TRow) => custom(value, row, condition)
        const predicate = valuePredicateFor(condition)
        return (value: unknown) => predicate(value)
    })

    if (tests.length === 1) return tests[0]
    if (join === 'or') {
        return (value, row) => {
            for (const test of tests) {
                if (test(value, row)) return true
            }
            return false
        }
    }
    return (value, row) => {
        for (const test of tests) {
            if (!test(value, row)) return false
        }
        return true
    }
}

export function compileColumnFilters<TRow>(
    columns: ColumnDef<TRow>[],
    filters: Record<string, ColumnFilterEntry>
): ((node: RowNode<TRow>) => boolean) | null {
    const compiled: ((node: RowNode<TRow>) => boolean)[] = []

    for (const [columnId, entry] of Object.entries(filters)) {
        const def = columns.find((candidate) => candidate.id === columnId)
        if (!def || filterTypeOf(def) === null) continue

        const test = entryPredicate(def, entry)
        compiled.push((node) => test(getCellValue(node.row, def), node.row))
    }

    if (compiled.length === 0) return null
    if (compiled.length === 1) return compiled[0]
    return (node) => {
        for (const predicate of compiled) {
            if (!predicate(node)) return false
        }
        return true
    }
}

function describeText(
    filter: Extract<ColumnFilter, { kind: 'text' }>,
    labels: DataGridLabels
): string {
    const op = labels.textOps[filter.op]
    if (isPresence(filter.op)) return op
    return `${op} "${filter.value}"`
}

type FilterValueFormat = (value: unknown) => string

const plainValue: FilterValueFormat = (value) => String(value)

function describeNumber(
    filter: Extract<ColumnFilter, { kind: 'number' }>,
    labels: DataGridLabels,
    format: FilterValueFormat
): string {
    const op = labels.numberOps[filter.op]
    if (isPresence(filter.op)) return op
    if (filter.op === 'between') return `${format(filter.value)} - ${format(filter.to)}`
    return `${op} ${format(filter.value)}`
}

function describeDate(
    filter: Extract<ColumnFilter, { kind: 'date' }>,
    labels: DataGridLabels
): string {
    const op = labels.dateOps[filter.op]
    if (isPresence(filter.op)) return op
    if (filter.op === 'between') return `${filter.value} - ${filter.to}`
    return `${op} ${filter.value}`
}

function describeSet(
    filter: Extract<ColumnFilter, { kind: 'set' }>,
    format: FilterValueFormat
): string {
    const shown = filter.values
        .slice(0, 2)
        .map((value) => format(value))
        .join(', ')
    const more = filter.values.length - 2
    return more > 0 ? `${shown} +${more}` : shown
}

function isPresence(op: string): op is PresenceFilterOp {
    return op === 'blank' || op === 'notBlank'
}

function describeCondition(
    filter: ColumnFilter,
    labels: DataGridLabels,
    format: FilterValueFormat
): string {
    switch (filter.kind) {
        case 'text':
            return describeText(filter, labels)
        case 'number':
            return describeNumber(filter, labels, format)
        case 'date':
            return describeDate(filter, labels)
        case 'set':
            return describeSet(filter, format)
        case 'boolean':
            return filter.value ? labels.yes : labels.no
    }
}

export function describeFilter(
    entry: ColumnFilterEntry,
    labels: DataGridLabels,
    format: FilterValueFormat = plainValue
): string {
    if (entry.kind !== 'group') return describeCondition(entry, labels, format)
    const join = entry.join === 'or' ? ` ${labels.or} ` : ` ${labels.and} `
    return entry.conditions.map((filter) => describeCondition(filter, labels, format)).join(join)
}
