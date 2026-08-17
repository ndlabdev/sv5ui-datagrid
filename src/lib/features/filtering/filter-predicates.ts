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
import { getCellValue, isBlank } from '../../core/utils/value.js'
import { normalizeFilterEntry } from './filter-model.js'

export function filterTypeOf<TRow>(def: ColumnDef<TRow>): FilterType | null {
    if (def.filter === false || def.filter === undefined) return null
    return typeof def.filter === 'string' ? def.filter : def.filter.type
}

function customPredicateOf<TRow>(
    def: ColumnDef<TRow>
): ColumnFilterDef<TRow>['predicate'] | undefined {
    return typeof def.filter === 'object' ? def.filter.predicate : undefined
}

function textPredicate(
    filter: Extract<ColumnFilter, { kind: 'text' }>
): (value: unknown) => boolean {
    if (filter.op === 'blank') return (value) => isBlank(value)
    if (filter.op === 'notBlank') return (value) => !isBlank(value)

    // Folding once here keeps `toLowerCase` out of the per-row loop.
    const fold = filter.caseSensitive
        ? (text: string) => text
        : (text: string) => text.toLowerCase()
    const query = fold(filter.value.trim())
    const read = (value: unknown) => fold(String(value))

    switch (filter.op) {
        case 'equals':
            return (value) => !isBlank(value) && read(value) === query
        case 'notEqual':
            // A blank cell is not the query, so it passes - the same reading
            // `notContains` takes, and the one a spreadsheet takes.
            return (value) => isBlank(value) || read(value) !== query
        case 'startsWith':
            return (value) => !isBlank(value) && read(value).startsWith(query)
        case 'endsWith':
            return (value) => !isBlank(value) && read(value).endsWith(query)
        case 'contains':
            return (value) => !isBlank(value) && read(value).includes(query)
        case 'notContains':
            return (value) => isBlank(value) || !read(value).includes(query)
    }
}

const numberComparators: Record<
    Exclude<NumberFilterOp, 'blank' | 'notBlank' | 'between'>,
    (value: number, target: number) => boolean
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
        // `Number(null)` and `Number('')` are both 0, so a blank cell would
        // otherwise fall inside any range that spans zero.
        return (value) => {
            if (isBlank(value)) return false
            const numeric = Number(value)
            return numeric >= target && numeric <= to
        }
    }
    const compare = numberComparators[filter.op]
    return (value) => !isBlank(value) && compare(Number(value), target)
}

function toEpochDay(value: unknown): number {
    if (isBlank(value)) return Number.NaN
    const time = value instanceof Date ? value.getTime() : Date.parse(String(value))
    return Math.floor(time / 86_400_000)
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
        case 'before':
            return (value) => toEpochDay(value) < target
        case 'after':
            return (value) => toEpochDay(value) > target
        case 'between':
            return (value) => {
                const day = toEpochDay(value)
                return day >= target && day <= to
            }
    }
}

function setPredicate(filter: Extract<ColumnFilter, { kind: 'set' }>): (value: unknown) => boolean {
    const allowed = new Set(filter.values.map((entry) => (entry === null ? null : entry)))
    // Blanks collapse to the one null entry the value list offers, so picking it
    // matches the empty strings the grid already draws as empty.
    return (value) => allowed.has(isBlank(value) ? null : (value as never))
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
    }
}

/** One column's conditions as a single test; the value is read once per row. */
function entryPredicate<TRow>(
    def: ColumnDef<TRow>,
    entry: ColumnFilterEntry
): (value: unknown, row: TRow) => boolean {
    const { join, conditions } = normalizeFilterEntry(entry)
    const custom = customPredicateOf(def)

    const tests = conditions.map((condition) => {
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

/** Chip text, worded from the labels so it matches the operator list. */
function describeText(
    filter: Extract<ColumnFilter, { kind: 'text' }>,
    labels: DataGridLabels
): string {
    const op = labels.textOps[filter.op]
    if (isPresence(filter.op)) return op
    return `${op} "${filter.value}"`
}

/**
 * How a value is written back to the reader. The chip says what the column
 * says: a percent column filtered at `0.05` is one the user set to 5%, and a
 * chip reading `0.05` describes a filter nobody typed.
 */
export type FilterValueFormat = (value: unknown) => string

const plainValue: FilterValueFormat = (value) => String(value)

function describeNumber(
    filter: Extract<ColumnFilter, { kind: 'number' }>,
    labels: DataGridLabels,
    format: FilterValueFormat
): string {
    const op = labels.numberOps[filter.op]
    if (isPresence(filter.op)) return op
    if (filter.op === 'between') return `${format(filter.value)} – ${format(filter.to)}`
    return `${op} ${format(filter.value)}`
}

function describeDate(
    filter: Extract<ColumnFilter, { kind: 'date' }>,
    labels: DataGridLabels
): string {
    const op = labels.dateOps[filter.op]
    if (isPresence(filter.op)) return op
    if (filter.op === 'between') return `${filter.value} – ${filter.to}`
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

/**
 * `format` is how the column draws a value; without one the numbers are
 * written as they are stored, which is what a column drawing what it holds
 * wants anyway.
 */
export function describeFilter(
    entry: ColumnFilterEntry,
    labels: DataGridLabels,
    format: FilterValueFormat = plainValue
): string {
    if (entry.kind !== 'group') return describeCondition(entry, labels, format)
    const join = entry.join === 'or' ? ` ${labels.or} ` : ` ${labels.and} `
    return entry.conditions.map((filter) => describeCondition(filter, labels, format)).join(join)
}
