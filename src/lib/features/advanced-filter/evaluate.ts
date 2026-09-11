import type {
    AdvancedFilterOp,
    FilterCondition,
    FilterGroup,
    FilterNode
} from './advanced-filter.types.js'
import { valuePredicateFor } from '../filtering/filter-predicates.js'
import { isBlank } from '../../core/utils/index.js'
import type { FilterKind } from './operators.js'
import { toColumnFilter } from './to-column-filter.js'

const PRESENCE = new Set<AdvancedFilterOp>(['blank', 'notBlank'])

function matchesPresence(cell: unknown, op: AdvancedFilterOp): boolean {
    const blank = isBlank(cell)
    return op === 'blank' ? blank : !blank
}

function isComplete(condition: FilterCondition): boolean {
    if (PRESENCE.has(condition.op)) return true
    if (condition.op === 'in') return (condition.values?.length ?? 0) > 0
    if (isBlank(condition.value)) return false
    return condition.op === 'between' ? !isBlank(condition.to) : true
}

export function matchesCondition(
    cell: unknown,
    condition: FilterCondition,
    kind: FilterKind = 'text'
): boolean {
    if (!isComplete(condition)) return true
    if (PRESENCE.has(condition.op)) return matchesPresence(cell, condition.op)

    const filter = toColumnFilter(condition, kind)
    return filter ? valuePredicateFor(filter)(cell) : true
}

export function matchesNode(
    node: FilterNode,
    read: (columnId: string) => unknown,
    kindOf: (columnId: string) => FilterKind = () => 'text'
): boolean {
    if (node.kind === 'condition') {
        return matchesCondition(read(node.columnId), node, kindOf(node.columnId))
    }

    const children = node.children
    if (children.length === 0) return true

    const join = node.join ?? 'and'
    const matched =
        join === 'and'
            ? children.every((child) => matchesNode(child, read, kindOf))
            : children.some((child) => matchesNode(child, read, kindOf))

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

function columnIdsOf(node: FilterNode, into: Set<string> = new Set()): Set<string> {
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
