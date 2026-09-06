import type {
    ColumnFilter,
    DateFilterOp,
    NumberFilterOp,
    SetFilterValue,
    TextFilterOp
} from '../../core/types/index.js'
import { numericOrNull } from '../../core/utils/index.js'
import type { AdvancedFilterOp, FilterCondition } from './advanced-filter.types.js'
import type { FilterKind } from './operators.js'

/**
 * One condition of the tree, said in the language the column filter speaks.
 *
 * The builder and the column filter used to compare values twice, in two
 * files, kept in step by a test. There is one comparison now and this is the
 * seam: everything above it is a tree, everything below it is
 * `valuePredicateFor`.
 *
 * Presence never arrives here. `blank` and `notBlank` are answered before the
 * mapping, because the column filter has no shape for them on a boolean or a
 * set and the answer is the same for every kind anyway.
 */

/** `equals` is the same word on both sides; a number spells it `eq`. */
const NUMBER_OPS: Partial<Record<AdvancedFilterOp, NumberFilterOp>> = {
    equals: 'eq',
    notEqual: 'neq',
    gt: 'gt',
    gte: 'gte',
    lt: 'lt',
    lte: 'lte',
    between: 'between'
}

const DATE_OPS: Partial<Record<AdvancedFilterOp, DateFilterOp>> = {
    equals: 'equals',
    notEqual: 'notEqual',
    before: 'before',
    after: 'after',
    between: 'between'
}

const TEXT_OPS: Partial<Record<AdvancedFilterOp, TextFilterOp>> = {
    contains: 'contains',
    notContains: 'notContains',
    equals: 'equals',
    notEqual: 'notEqual',
    startsWith: 'startsWith',
    endsWith: 'endsWith'
}

function asIsoDay(value: unknown): string | undefined {
    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? undefined : value.toISOString().slice(0, 10)
    }
    return value === null || value === undefined ? undefined : String(value)
}

function asBooleanFilter(condition: FilterCondition): ColumnFilter | null {
    // The column filter has no operator here, only the value to match, so
    // `notEqual true` is `equals false`.
    const { op, value } = condition
    if (op !== 'equals' && op !== 'notEqual') return null
    const wanted = value === true || value === 'true'
    return { kind: 'boolean', value: op === 'notEqual' ? !wanted : wanted }
}

function asNumberFilter(condition: FilterCondition): ColumnFilter | null {
    const mapped = NUMBER_OPS[condition.op]
    if (!mapped) return null
    return {
        kind: 'number',
        op: mapped,
        value: numericOrNull(condition.value) ?? undefined,
        to: numericOrNull(condition.to) ?? undefined
    }
}

function asDateFilter(condition: FilterCondition): ColumnFilter | null {
    const mapped = DATE_OPS[condition.op]
    if (!mapped) return null
    return {
        kind: 'date',
        op: mapped,
        value: asIsoDay(condition.value),
        to: asIsoDay(condition.to)
    }
}

function asTextFilter(condition: FilterCondition): ColumnFilter | null {
    const mapped = TEXT_OPS[condition.op]
    if (!mapped) return null
    const { value } = condition
    return {
        kind: 'text',
        op: mapped,
        value: value === null || value === undefined ? '' : String(value),
        caseSensitive: condition.caseSensitive
    }
}

/**
 * A condition the column filter cannot express answers `null`, and the caller
 * treats that as a test nothing fails: an operator a column does not offer is
 * a half-built condition, not a filter that hides every row.
 */
export function toColumnFilter(condition: FilterCondition, kind: FilterKind): ColumnFilter | null {
    // Membership, whatever the column holds. `in` is the one operator that
    // does not read as the column's kind: it asks whether the cell is one of
    // the entries, and a set filter is exactly that question.
    if (condition.op === 'in') {
        return { kind: 'set', values: (condition.values ?? []) as SetFilterValue[] }
    }

    if (kind === 'boolean') return asBooleanFilter(condition)
    if (kind === 'number') return asNumberFilter(condition)
    if (kind === 'date') return asDateFilter(condition)
    return asTextFilter(condition)
}
