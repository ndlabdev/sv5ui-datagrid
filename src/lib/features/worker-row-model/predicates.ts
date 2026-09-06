import { type ColumnFilter } from '../../core/types/index.js'
import { isBlank, setKeyOf, toEpochDay } from './columnar.js'

const PASSES = (): boolean => true

function folded(filter: Extract<ColumnFilter, { kind: 'text' }>) {
    const fold = filter.caseSensitive
        ? (text: string) => text
        : (text: string) => text.toLowerCase()
    return { query: fold(String(filter.value ?? '').trim()), fold }
}

function textPredicate(
    filter: Extract<ColumnFilter, { kind: 'text' }>
): (value: unknown) => boolean {
    if (filter.op === 'blank') return (value) => isBlank(value)
    if (filter.op === 'notBlank') return (value) => !isBlank(value)

    const { query, fold } = folded(filter)
    const read = (value: unknown) => fold(String(value))

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

const NUMBER_TESTS: Record<string, (value: number, target: number) => boolean> = {
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

    const compare = NUMBER_TESTS[filter.op]
    if (!compare) return PASSES
    return (value) => !isBlank(value) && compare(Number(value), target)
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
        default:
            return PASSES
    }
}

function setPredicate(filter: Extract<ColumnFilter, { kind: 'set' }>): (value: unknown) => boolean {
    if (!Array.isArray(filter.values)) return PASSES
    const allowed = new Set(filter.values.map((entry) => setKeyOf(entry)))
    return (value) => allowed.has(setKeyOf(value))
}

export function predicateFor(filter: ColumnFilter): (value: unknown) => boolean {
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
            return (value) => Boolean(value) === filter.value
        default:
            return PASSES
    }
}
