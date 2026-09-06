import type {
    AdvancedFilterOp,
    FilterCondition,
    FilterGroup,
    FilterNode
} from './advanced-filter.types.js'
import { numericOrNull } from '../../core/utils/index.js'

const PRESENCE = new Set<AdvancedFilterOp>(['blank', 'notBlank'])

export function isBlankValue(value: unknown): boolean {
    return value === null || value === undefined || value === ''
}

function asText(value: unknown, caseSensitive: boolean): string {
    const text = value instanceof Date ? value.toISOString() : String(value ?? '')
    return caseSensitive ? text : text.toLowerCase()
}

const MS_PER_DAY = 86_400_000
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function localDay(date: Date): number {
    return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / MS_PER_DAY
}

function asDay(value: unknown): number | null {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : localDay(value)
    if (typeof value === 'number') return localDay(new Date(value))
    if (typeof value !== 'string') return null

    const text = value.trim()
    if (DATE_ONLY.test(text)) return Date.parse(text) / MS_PER_DAY

    const parsed = new Date(text)
    return Number.isNaN(parsed.getTime()) ? null : localDay(parsed)
}

function compareText(cell: unknown, condition: FilterCondition): boolean {
    const sensitive = condition.caseSensitive ?? false
    const left = asText(cell, sensitive)
    const right = asText(condition.value, sensitive)

    switch (condition.op) {
        case 'contains':
            return left.includes(right)
        case 'notContains':
            return !left.includes(right)
        case 'startsWith':
            return left.startsWith(right)
        case 'endsWith':
            return left.endsWith(right)
        case 'equals':
            return left === right
        case 'notEqual':
            return left !== right
        default:
            return false
    }
}

const NUMERIC_TESTS: Partial<Record<AdvancedFilterOp, (left: number, right: number) => boolean>> = {
    equals: (left, right) => left === right,
    notEqual: (left, right) => left !== right,
    gt: (left, right) => left > right,
    gte: (left, right) => left >= right,
    lt: (left, right) => left < right,
    lte: (left, right) => left <= right
}

function compareNumbers(cell: unknown, condition: FilterCondition): boolean | null {
    const left = numericOrNull(cell)
    const right = numericOrNull(condition.value)
    if (left === null || right === null) return null

    if (condition.op === 'between') {
        const upper = numericOrNull(condition.to)
        return upper === null ? null : left >= right && left <= upper
    }

    const test = NUMERIC_TESTS[condition.op]
    return test ? test(left, right) : null
}

function compareDays(cell: unknown, condition: FilterCondition): boolean | null {
    const left = asDay(cell)
    const right = asDay(condition.value)
    if (left === null || right === null) return null

    switch (condition.op) {
        case 'before':
            return left < right
        case 'after':
            return left > right
        case 'equals':
            return left === right
        case 'notEqual':
            return left !== right
        case 'between': {
            const upper = asDay(condition.to)
            return upper === null ? null : left >= right && left <= upper
        }
        default:
            return null
    }
}

function matchesIn(cell: unknown, condition: FilterCondition): boolean {
    const sensitive = condition.caseSensitive ?? false
    const values = condition.values ?? []

    return values.some((value) =>
        value instanceof Date || cell instanceof Date
            ? asDay(value) === asDay(cell)
            : value === cell || asText(value, sensitive) === asText(cell, sensitive)
    )
}

function matchesPresence(cell: unknown, op: AdvancedFilterOp): boolean {
    const blank = isBlankValue(cell)
    return op === 'blank' ? blank : !blank
}

function matchesBoolean(cell: unknown, condition: FilterCondition): boolean | null {
    const equality = condition.op === 'equals' || condition.op === 'notEqual'
    if (!equality) return null
    if (typeof cell !== 'boolean' && typeof condition.value !== 'boolean') return null

    const same = cell === condition.value || asText(cell, false) === asText(condition.value, false)
    return condition.op === 'notEqual' ? !same : same
}

export function isComplete(condition: FilterCondition): boolean {
    if (PRESENCE.has(condition.op)) return true
    if (condition.op === 'in') return (condition.values?.length ?? 0) > 0
    if (isBlankValue(condition.value)) return false
    return condition.op === 'between' ? !isBlankValue(condition.to) : true
}

export function matchesCondition(cell: unknown, condition: FilterCondition): boolean {
    if (!isComplete(condition)) return true

    if (PRESENCE.has(condition.op)) return matchesPresence(cell, condition.op)
    if (condition.op === 'in') return matchesIn(cell, condition)

    const asBoolean = matchesBoolean(cell, condition)
    if (asBoolean !== null) return asBoolean

    const asNumbers = compareNumbers(cell, condition)
    if (asNumbers !== null) return asNumbers

    const asDates = compareDays(cell, condition)
    if (asDates !== null) return asDates

    return compareText(cell, condition)
}

export function matchesNode(node: FilterNode, read: (columnId: string) => unknown): boolean {
    if (node.kind === 'condition') return matchesCondition(read(node.columnId), node)

    const children = node.children
    if (children.length === 0) return true

    const join = node.join ?? 'and'
    const matched =
        join === 'and'
            ? children.every((child) => matchesNode(child, read))
            : children.some((child) => matchesNode(child, read))

    return node.not === true ? !matched : matched
}

export function isEmptyModel(model: FilterGroup): boolean {
    return model.children.length === 0
}

export function countConditions(node: FilterNode): number {
    return node.kind === 'condition'
        ? 1
        : node.children.reduce((total, child) => total + countConditions(child), 0)
}

export function countActive(node: FilterNode): number {
    if (node.kind === 'condition') return isComplete(node) ? 1 : 0
    return node.children.reduce((total, child) => total + countActive(child), 0)
}

export const MAX_DEPTH = 20

const OPS = new Set<AdvancedFilterOp>([
    'contains',
    'notContains',
    'equals',
    'notEqual',
    'startsWith',
    'endsWith',
    'gt',
    'gte',
    'lt',
    'lte',
    'between',
    'before',
    'after',
    'in',
    'blank',
    'notBlank'
])

function sanitizeCondition(input: Record<string, unknown>): FilterCondition | null {
    const columnId = input.columnId
    const op = input.op
    if (typeof columnId !== 'string' || typeof op !== 'string') return null
    if (!OPS.has(op as AdvancedFilterOp)) return null

    const condition: FilterCondition = { kind: 'condition', columnId, op: op as AdvancedFilterOp }
    if ('value' in input) condition.value = input.value
    if ('to' in input) condition.to = input.to
    if (Array.isArray(input.values)) condition.values = input.values
    if (typeof input.caseSensitive === 'boolean') condition.caseSensitive = input.caseSensitive
    return condition
}

function sanitizeNode(input: unknown, depth: number): FilterNode | null {
    if (depth > MAX_DEPTH || input === null || typeof input !== 'object') return null

    const node = input as Record<string, unknown>
    if (node.kind === 'condition') return sanitizeCondition(node)
    if (node.kind !== 'group' || !Array.isArray(node.children)) return null

    const children = node.children
        .map((child) => sanitizeNode(child, depth + 1))
        .filter((child) => child !== null)

    const group: FilterGroup = {
        kind: 'group',
        join: node.join === 'or' ? 'or' : 'and',
        children
    }
    if (node.not === true) group.not = true
    return group
}

export function sanitizeModel(input: unknown): FilterGroup | null {
    const node = sanitizeNode(input, 0)
    return node?.kind === 'group' ? node : null
}

export function columnIdsOf(node: FilterNode, into: Set<string> = new Set()): Set<string> {
    if (node.kind === 'condition') into.add(node.columnId)
    else for (const child of node.children) columnIdsOf(child, into)
    return into
}

export function resolveColumns<TDef>(
    model: FilterNode,
    lookup: (columnId: string) => TDef | undefined
): Map<string, TDef> {
    const defs = new Map<string, TDef>()
    for (const columnId of columnIdsOf(model)) {
        const def = lookup(columnId)
        if (def !== undefined) defs.set(columnId, def)
    }
    return defs
}
