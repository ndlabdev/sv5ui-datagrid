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
    const date = value instanceof Date ? value : typeof value === 'number' ? new Date(value) : null

    if (date) {
        if (Number.isNaN(date.getTime())) return undefined
        const pad = (part: number, width = 2) => String(part).padStart(width, '0')
        return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
    }
    return value === null || value === undefined ? undefined : String(value)
}

function asBooleanFilter(condition: FilterCondition): ColumnFilter | null {
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

export function toColumnFilter(condition: FilterCondition, kind: FilterKind): ColumnFilter | null {
    if (condition.op === 'in') {
        return { kind: 'set', values: (condition.values ?? []) as SetFilterValue[] }
    }

    if (kind === 'boolean') return asBooleanFilter(condition)
    if (kind === 'number') return asNumberFilter(condition)
    if (kind === 'date') return asDateFilter(condition)
    return asTextFilter(condition)
}
