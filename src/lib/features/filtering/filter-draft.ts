import type {
    ColumnFilter,
    ColumnFilterEntry,
    DateFilterOp,
    FilterJoin,
    FilterType,
    NumberFilterOp,
    SetFilterValue,
    TextFilterOp
} from '../../core/types/index.js'
import { normalizeFilterEntry } from './filter-model.js'

/** How many conditions one column's filter may hold. */
export const MAX_CONDITIONS = 2

/** Operators that test presence, so their value inputs are hidden. */
const PRESENCE_OPS = new Set(['blank', 'notBlank'])

export function isPresenceOp(op: string): boolean {
    return PRESENCE_OPS.has(op)
}

/** One editable condition row of the filter panel. */
export interface ConditionDraft {
    op: string
    value: string
    to: string
}

export interface FilterDraft {
    join: FilterJoin
    conditions: ConditionDraft[]
    caseSensitive: boolean
    boolValue: string
    setSelected: SetFilterValue[]
}

function defaultOp(type: FilterType): string {
    if (type === 'text') return 'contains'
    if (type === 'number') return 'eq'
    return 'equals'
}

export function emptyCondition(type: FilterType): ConditionDraft {
    return { op: defaultOp(type), value: '', to: '' }
}

export function emptyDraft(type: FilterType): FilterDraft {
    return {
        join: 'and',
        conditions: [emptyCondition(type)],
        caseSensitive: false,
        boolValue: 'true',
        setSelected: []
    }
}

const numToStr = (value: number | undefined): string => (value !== undefined ? String(value) : '')

// sv5ui Input type="number" binds a number, so drafts may hold non-strings.
const str = (value: unknown): string => (value === null || value === undefined ? '' : String(value))

function conditionDraft(type: FilterType, filter: ColumnFilter): ConditionDraft {
    if (filter.kind === 'text') return { op: filter.op, value: filter.value, to: '' }
    if (filter.kind === 'number') {
        return { op: filter.op, value: numToStr(filter.value), to: numToStr(filter.to) }
    }
    if (filter.kind === 'date') {
        return { op: filter.op, value: filter.value ?? '', to: filter.to ?? '' }
    }
    return emptyCondition(type)
}

function caseSensitivityOf(filter: ColumnFilter): boolean {
    return filter.kind === 'text' && filter.caseSensitive === true
}

export function draftFromFilter(
    type: FilterType,
    entry: ColumnFilterEntry | undefined
): FilterDraft {
    const draft = emptyDraft(type)
    if (!entry) return draft

    const { join, conditions } = normalizeFilterEntry(entry)
    const first = conditions[0]
    if (!first) return draft

    if (first.kind === 'set') return { ...draft, setSelected: [...first.values] }
    if (first.kind === 'boolean') return { ...draft, boolValue: first.value ? 'true' : 'false' }

    return {
        ...draft,
        join,
        conditions: conditions
            .slice(0, MAX_CONDITIONS)
            .map((filter) => conditionDraft(type, filter)),
        caseSensitive: caseSensitivityOf(first)
    }
}

function buildText(draft: FilterDraft, condition: ConditionDraft): ColumnFilter | null {
    const op = condition.op as TextFilterOp
    if (isPresenceOp(op)) return { kind: 'text', op, value: '' }
    const value = str(condition.value)
    if (value.trim() === '') return null
    return draft.caseSensitive
        ? { kind: 'text', op, value, caseSensitive: true }
        : { kind: 'text', op, value }
}

function buildNumber(condition: ConditionDraft): ColumnFilter | null {
    if (isPresenceOp(condition.op)) {
        return { kind: 'number', op: condition.op as NumberFilterOp }
    }
    const value = str(condition.value)
    const parsed = Number(value)
    if (value.trim() === '' || Number.isNaN(parsed)) return null
    if (condition.op === 'between') {
        const to = str(condition.to)
        const parsedTo = Number(to)
        if (to.trim() === '' || Number.isNaN(parsedTo)) return null
        return { kind: 'number', op: 'between', value: parsed, to: parsedTo }
    }
    return { kind: 'number', op: condition.op as NumberFilterOp, value: parsed }
}

function buildDate(condition: ConditionDraft): ColumnFilter | null {
    if (isPresenceOp(condition.op)) return { kind: 'date', op: condition.op as DateFilterOp }
    const value = str(condition.value)
    if (value === '') return null
    if (condition.op === 'between') {
        const to = str(condition.to)
        return to === '' ? null : { kind: 'date', op: 'between', value, to }
    }
    return { kind: 'date', op: condition.op as DateFilterOp, value }
}

function buildCondition(
    type: FilterType,
    draft: FilterDraft,
    condition: ConditionDraft
): ColumnFilter | null {
    if (type === 'text') return buildText(draft, condition)
    if (type === 'number') return buildNumber(condition)
    if (type === 'date') return buildDate(condition)
    return null
}

/**
 * The filter a draft describes, or null when nothing usable was entered.
 * A group is only produced once two conditions are actually valid, so the
 * common case keeps the plain single-condition shape.
 */
export function buildColumnFilter(type: FilterType, draft: FilterDraft): ColumnFilterEntry | null {
    if (type === 'set') {
        return draft.setSelected.length > 0 ? { kind: 'set', values: draft.setSelected } : null
    }
    if (type === 'boolean') return { kind: 'boolean', value: draft.boolValue === 'true' }

    const built = draft.conditions
        .map((condition) => buildCondition(type, draft, condition))
        .filter((filter): filter is ColumnFilter => filter !== null)

    if (built.length === 0) return null
    if (built.length === 1) return built[0]
    return { kind: 'group', join: draft.join, conditions: built }
}
