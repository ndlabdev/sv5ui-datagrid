import { type ColumnDef } from '../../core/types/index.js'
import type { AdvancedFilterOp } from './advanced-filter.types.js'

export type FilterKind = 'text' | 'number' | 'date' | 'boolean' | 'set'

const PRESENCE: AdvancedFilterOp[] = ['blank', 'notBlank']

export const OPS_BY_KIND: Record<FilterKind, AdvancedFilterOp[]> = {
    text: ['contains', 'notContains', 'equals', 'notEqual', 'startsWith', 'endsWith', ...PRESENCE],
    number: ['equals', 'notEqual', 'gt', 'gte', 'lt', 'lte', 'between', ...PRESENCE],
    date: ['equals', 'notEqual', 'before', 'after', 'between', ...PRESENCE],
    boolean: ['equals', 'notEqual', ...PRESENCE],
    set: ['in', 'equals', 'notEqual', ...PRESENCE]
}

const BY_COLUMN_TYPE: Record<string, FilterKind> = {
    number: 'number',
    currency: 'number',
    percent: 'number',
    progress: 'number',
    rating: 'number',
    date: 'date',
    datetime: 'date',
    boolean: 'boolean'
}

const UNREADABLE = new Set(['actions'])

export function isFilterable<TRow>(def: ColumnDef<TRow> | undefined): boolean {
    if (!def) return false
    if (def.filter === false) return false
    return !UNREADABLE.has(def.type ?? 'text')
}

export function kindOf<TRow>(def: ColumnDef<TRow> | undefined): FilterKind {
    if (!def) return 'text'

    const declared = def.filter
    if (typeof declared === 'string' && declared in OPS_BY_KIND) return declared as FilterKind
    if (declared && typeof declared === 'object' && declared.type in OPS_BY_KIND) {
        return declared.type as FilterKind
    }

    return BY_COLUMN_TYPE[def.type ?? 'text'] ?? 'text'
}

export function opsFor(kind: FilterKind): AdvancedFilterOp[] {
    return OPS_BY_KIND[kind]
}

export function needsValue(op: AdvancedFilterOp): boolean {
    return !PRESENCE.includes(op)
}

export function needsRange(op: AdvancedFilterOp): boolean {
    return op === 'between'
}

export function needsList(op: AdvancedFilterOp): boolean {
    return op === 'in'
}

export function opForKind(op: AdvancedFilterOp, kind: FilterKind): AdvancedFilterOp {
    const allowed = opsFor(kind)
    return allowed.includes(op) ? op : allowed[0]!
}

export function distinctValues(
    read: (index: number) => unknown,
    count: number,
    limit: number
): string[] {
    const seen = new Set<string>()
    for (let index = 0; index < count && seen.size < limit; index++) {
        const value = read(index)
        if (value === null || value === undefined || value === '') continue
        seen.add(String(value))
    }
    return [...seen].sort()
}
