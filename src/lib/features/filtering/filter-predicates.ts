import type {
    ColumnDef,
    ColumnFilter,
    ColumnFilterDef,
    FilterType,
    NumberFilterOp,
    RowNode,
    TextFilterOp
} from '../../core/types.js'
import { getCellValue, isNullish } from '../../core/value.js'

export function filterTypeOf<TRow>(def: ColumnDef<TRow>): FilterType | null {
    if (def.filter === false || def.filter === undefined) return null
    return typeof def.filter === 'string' ? def.filter : def.filter.type
}

function customPredicateOf<TRow>(
    def: ColumnDef<TRow>
): ColumnFilterDef<TRow>['predicate'] | undefined {
    return typeof def.filter === 'object' ? def.filter.predicate : undefined
}

function isBlank(value: unknown): boolean {
    return isNullish(value) || value === ''
}

function textPredicate(
    filter: Extract<ColumnFilter, { kind: 'text' }>
): (value: unknown) => boolean {
    const query = filter.value.trim().toLowerCase()
    switch (filter.op) {
        case 'blank':
            return (value) => isBlank(value)
        case 'equals':
            return (value) => !isBlank(value) && String(value).toLowerCase() === query
        case 'startsWith':
            return (value) => !isBlank(value) && String(value).toLowerCase().startsWith(query)
        case 'endsWith':
            return (value) => !isBlank(value) && String(value).toLowerCase().endsWith(query)
        case 'contains':
            return (value) => !isBlank(value) && String(value).toLowerCase().includes(query)
    }
}

const numberComparators: Record<
    Exclude<NumberFilterOp, 'blank' | 'between'>,
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
    return (value) => allowed.has(isNullish(value) ? null : (value as never))
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

export function compileColumnFilters<TRow>(
    columns: ColumnDef<TRow>[],
    filters: Record<string, ColumnFilter>
): ((node: RowNode<TRow>) => boolean) | null {
    const compiled: ((node: RowNode<TRow>) => boolean)[] = []

    for (const [columnId, filter] of Object.entries(filters)) {
        const def = columns.find((candidate) => candidate.id === columnId)
        if (!def || filterTypeOf(def) === null) continue

        const custom = customPredicateOf(def)
        if (custom) {
            compiled.push((node) => custom(getCellValue(node.row, def), node.row, filter))
            continue
        }
        const predicate = valuePredicateFor(filter)
        compiled.push((node) => predicate(getCellValue(node.row, def)))
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

const textOpLabels: Record<TextFilterOp, string> = {
    contains: 'contains',
    equals: '=',
    startsWith: 'starts with',
    endsWith: 'ends with',
    blank: 'is blank'
}
const numberOpLabels: Record<Exclude<NumberFilterOp, 'blank' | 'between'>, string> = {
    eq: '=',
    neq: '≠',
    gt: '>',
    gte: '≥',
    lt: '<',
    lte: '≤'
}

function describeText(filter: Extract<ColumnFilter, { kind: 'text' }>): string {
    return filter.op === 'blank'
        ? textOpLabels.blank
        : `${textOpLabels[filter.op]} "${filter.value}"`
}

function describeNumber(filter: Extract<ColumnFilter, { kind: 'number' }>): string {
    if (filter.op === 'blank') return 'is blank'
    if (filter.op === 'between') return `${filter.value} – ${filter.to}`
    return `${numberOpLabels[filter.op]} ${filter.value}`
}

function describeSet(filter: Extract<ColumnFilter, { kind: 'set' }>): string {
    const shown = filter.values.slice(0, 2).map(String).join(', ')
    const more = filter.values.length - 2
    return more > 0 ? `${shown} +${more}` : shown
}

export function describeFilter(filter: ColumnFilter): string {
    switch (filter.kind) {
        case 'text':
            return describeText(filter)
        case 'number':
            return describeNumber(filter)
        case 'date':
            return filter.op === 'between'
                ? `${filter.value} – ${filter.to}`
                : `${filter.op} ${filter.value}`
        case 'set':
            return describeSet(filter)
        case 'boolean':
            return filter.value ? 'true' : 'false'
    }
}
